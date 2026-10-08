import { execFile } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { binaryService } from './binaryService';
import { storageService } from './storageService';
import { sanitizeFilename } from '../utils/sanitize';
import { SubtitleTrack, TranscriptResult } from '../../shared/types';
import { metadataService } from './metadataService';

export function parseVttOrSrtToCleanText(rawContent: string, withTimestamps = false): string {
  const lines = rawContent.split(/\r?\n/);
  const result: string[] = [];
  let currentTime = '';

  for (let line of lines) {
    line = line.trim();
    if (!line) continue;
    if (
      line.startsWith('WEBVTT') ||
      line.startsWith('Kind:') ||
      line.startsWith('Language:') ||
      line.startsWith('NOTE')
    ) {
      continue;
    }

    // Timestamp line: 00:00:01.360 --> 00:00:03.040
    if (line.includes('-->')) {
      const match = line.match(/^(\d{2}:)?(\d{2}:\d{2})/);
      currentTime = match ? match[0] : '';
      continue;
    }

    // SRT cue index (pure numbers)
    if (/^\d+$/.test(line)) continue;

    // Strip VTT / HTML formatting tags like <c>, </c>, <v Speaker>, <00:01.000>
    const cleanText = line.replace(/<[^>]+>/g, '').trim();
    if (!cleanText) continue;

    if (withTimestamps && currentTime) {
      const timestampTag = `[${currentTime}]`;
      const combined = `${timestampTag} ${cleanText}`;
      if (result.length === 0 || result[result.length - 1] !== combined) {
        result.push(combined);
      }
    } else {
      // Deduplicate consecutive identical lines common in rolling auto-generated subtitles
      if (result.length === 0 || result[result.length - 1] !== cleanText) {
        result.push(cleanText);
      }
    }
  }

  return result.join('\n');
}

export class TranscriptService {
  public async getTranscript(
    url: string,
    requestedLang = 'en',
    withTimestamps = false
  ): Promise<TranscriptResult> {
    const targetUrl = metadataService.normalizeVideoUrl(url);
    const ytDlp = binaryService.getYtDlpPath();

    // 1. Fetch JSON metadata first to identify title and available subtitle tracks
    const meta = await this.fetchMetadataWithTracks(ytDlp, targetUrl);
    const availableLanguages = meta.availableLanguages;
    const title = meta.title || 'Transcript';

    // Determine target language code to fetch
    const langToFetch = this.resolveBestLanguage(availableLanguages, requestedLang);

    // 2. Download subtitles using yt-dlp to a temporary directory with --skip-download
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'tubeflow-transcript-'));

    try {
      const args = [
        targetUrl,
        '--skip-download',
        '--write-subs',
        '--write-auto-subs',
        '--sub-lang',
        langToFetch ? `${langToFetch}.*,${langToFetch},en.*,en` : 'en.*,en,ar.*,ar',
        '--convert-subs',
        'vtt',
        '--no-warnings',
        '-P',
        `temp:${tempDir}`,
        '-o',
        'transcript.%(ext)s'
      ];

      await new Promise<void>((resolve, reject) => {
        execFile(ytDlp, args, { timeout: 45000 }, (err) => {
          // If error occurs, check if subtitle files were still written
          const files = fs.existsSync(tempDir)
            ? fs.readdirSync(tempDir).filter((f) => f.endsWith('.vtt') || f.endsWith('.srt'))
            : [];
          if (files.length > 0) {
            return resolve();
          }
          if (err) {
            return reject(
              new Error(
                `Could not download transcript for this video. Subtitles may not be available from the host platform.`
              )
            );
          }
          resolve();
        });
      });

      // Find downloaded subtitle file
      const files = fs.readdirSync(tempDir).filter((f) => f.endsWith('.vtt') || f.endsWith('.srt'));
      if (files.length === 0) {
        throw new Error(
          `No transcript or subtitle tracks found for this video. Subtitles may not be available from the host platform.`
        );
      }

      // Read preferred language file or first available
      const chosenFile =
        files.find((f) => f.toLowerCase().includes(`.${langToFetch.toLowerCase()}.`)) ||
        files.find((f) => f.toLowerCase().includes(`.${requestedLang.toLowerCase()}.`)) ||
        files[0];

      const rawContent = fs.readFileSync(path.join(tempDir, chosenFile), 'utf-8');
      const cleanText = parseVttOrSrtToCleanText(rawContent, withTimestamps);

      return {
        title,
        text: cleanText,
        lang: langToFetch || requestedLang,
        availableLanguages
      };
    } finally {
      // Clean up temporary folder
      try {
        if (fs.existsSync(tempDir)) {
          fs.rmSync(tempDir, { recursive: true, force: true });
        }
      } catch {}
    }
  }

  public async saveTranscript(options: {
    title: string;
    text: string;
    format?: 'txt' | 'srt';
    destination?: string;
  }): Promise<string> {
    const settings = storageService.getSettings();
    const destDir =
      options.destination || settings.downloadDirectory || path.join(os.homedir(), 'Downloads');

    if (!fs.existsSync(destDir)) {
      try {
        fs.mkdirSync(destDir, { recursive: true });
      } catch (err: any) {
        throw new Error(`Failed to create destination folder: ${err.message}`);
      }
    }

    const ext = options.format === 'srt' ? 'srt' : 'txt';
    const filename = `${sanitizeFilename(options.title || 'Transcript')}.${ext}`;
    const filePath = path.join(destDir, filename);

    fs.writeFileSync(filePath, options.text, 'utf-8');
    return filePath;
  }

  private fetchMetadataWithTracks(
    ytDlp: string,
    url: string
  ): Promise<{ title: string; availableLanguages: SubtitleTrack[] }> {
    return new Promise((resolve, reject) => {
      const args = ['-J', '--no-playlist', '--skip-download', '--no-warnings', url];
      execFile(ytDlp, args, { maxBuffer: 25 * 1024 * 1024, timeout: 30000 }, (err, stdout) => {
        if (err || !stdout) {
          // If dump-json fails, resolve with fallback
          return resolve({ title: 'Transcript', availableLanguages: [] });
        }

        try {
          const data = JSON.parse(stdout);
          const tracks = this.extractSubtitleTracks(data);
          resolve({
            title: data.title || 'Transcript',
            availableLanguages: tracks
          });
        } catch {
          resolve({ title: 'Transcript', availableLanguages: [] });
        }
      });
    });
  }

  public extractSubtitleTracks(data: any): SubtitleTrack[] {
    const tracks: SubtitleTrack[] = [];
    const seen = new Set<string>();

    if (data.subtitles && typeof data.subtitles === 'object') {
      for (const [code, items] of Object.entries(data.subtitles)) {
        if (!seen.has(code)) {
          seen.add(code);
          const first = Array.isArray(items) && items[0] ? (items[0] as any) : null;
          tracks.push({
            code,
            name: first?.name || code,
            isAuto: false
          });
        }
      }
    }

    if (data.automatic_captions && typeof data.automatic_captions === 'object') {
      for (const [code, items] of Object.entries(data.automatic_captions)) {
        if (!seen.has(code)) {
          seen.add(code);
          const first = Array.isArray(items) && items[0] ? (items[0] as any) : null;
          tracks.push({
            code,
            name: first?.name ? `${first.name} (Auto)` : `${code} (Auto)`,
            isAuto: true
          });
        }
      }
    }

    return tracks;
  }

  private resolveBestLanguage(tracks: SubtitleTrack[], requested: string): string {
    if (!tracks || tracks.length === 0) return requested || 'en';

    // 1. Exact match
    const exact = tracks.find((t) => t.code.toLowerCase() === requested.toLowerCase());
    if (exact) return exact.code;

    // 2. Prefix match (e.g. 'en' matches 'en-US' or 'en-orig')
    const prefix = tracks.find((t) => t.code.toLowerCase().startsWith(requested.toLowerCase()));
    if (prefix) return prefix.code;

    // 3. Prefer English manual, then English auto
    const enManual = tracks.find((t) => t.code.startsWith('en') && !t.isAuto);
    if (enManual) return enManual.code;

    const enAuto = tracks.find((t) => t.code.startsWith('en'));
    if (enAuto) return enAuto.code;

    // 4. Return first track
    return tracks[0]?.code || requested;
  }
}

export const transcriptService = new TranscriptService();
