import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import path from 'node:path';
import fs from 'node:fs';
import { app } from 'electron';
import { SystemDependencies } from '../../shared/types';

const execFileAsync = promisify(execFile);

export class BinaryService {
  private ytDlpPath: string = '';
  private ffmpegPath: string = '';
  private ytDlpVersion?: string;
  private ffmpegVersion?: string;

  constructor() {
    this.detectPaths();
  }

  public detectPaths(): void {
    const isDev = !app.isPackaged;
    const projectRoot = isDev ? process.cwd() : path.dirname(app.getPath('exe'));
    const userData = app.getPath('userData');
    const resources = process.resourcesPath || '';

    // Candidates for yt-dlp
    const ytDlpCandidates = [
      path.join(resources, 'bin', 'yt-dlp'),
      path.join(projectRoot, 'bin', 'yt-dlp'),
      path.join(userData, 'bin', 'yt-dlp'),
      '/opt/homebrew/bin/yt-dlp',
      '/usr/local/bin/yt-dlp',
      'yt-dlp'
    ];

    for (const candidate of ytDlpCandidates) {
      if (candidate === 'yt-dlp') {
        this.ytDlpPath = candidate;
        break;
      }
      if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) {
        try {
          fs.chmodSync(candidate, 0o755);
        } catch {}
        this.ytDlpPath = candidate;
        break;
      }
    }

    // Candidates for ffmpeg
    const ffmpegCandidates = [
      path.join(resources, 'bin', 'ffmpeg'),
      '/opt/homebrew/bin/ffmpeg',
      '/usr/local/bin/ffmpeg',
      path.join(projectRoot, 'bin', 'ffmpeg'),
      'ffmpeg'
    ];

    for (const candidate of ffmpegCandidates) {
      if (candidate === 'ffmpeg') {
        this.ffmpegPath = candidate;
        break;
      }
      if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) {
        try {
          fs.chmodSync(candidate, 0o755);
        } catch {}
        this.ffmpegPath = candidate;
        break;
      }
    }
  }

  public async getDependencies(): Promise<SystemDependencies> {
    const isDev = !app.isPackaged;
    const projectRoot = isDev ? process.cwd() : path.dirname(app.getPath('exe'));
    const userData = app.getPath('userData');
    const resources = process.resourcesPath || '';

    const ytCandidates = [
      this.ytDlpPath,
      path.join(resources, 'bin', 'yt-dlp'),
      path.join(projectRoot, 'bin', 'yt-dlp'),
      path.join(userData, 'bin', 'yt-dlp'),
      '/opt/homebrew/bin/yt-dlp',
      '/usr/local/bin/yt-dlp',
      'yt-dlp'
    ].filter(Boolean);

    let ytAvailable = false;
    let ytVer = this.ytDlpVersion;

    for (const cand of ytCandidates) {
      if (cand !== 'yt-dlp') {
        if (!fs.existsSync(cand) || !fs.statSync(cand).isFile()) continue;
        try {
          fs.chmodSync(cand, 0o755);
        } catch {}
      }

      try {
        const { stdout } = await execFileAsync(cand, ['--version'], { timeout: 20000 });
        ytVer = stdout.trim();
        ytAvailable = true;
        this.ytDlpVersion = ytVer;
        this.ytDlpPath = cand;
        break;
      } catch {
        // Continue to next candidate
      }
    }

    const ffmpegCandidates = [
      this.ffmpegPath,
      path.join(resources, 'bin', 'ffmpeg'),
      '/opt/homebrew/bin/ffmpeg',
      '/usr/local/bin/ffmpeg',
      path.join(projectRoot, 'bin', 'ffmpeg'),
      'ffmpeg'
    ].filter(Boolean);

    let ffmpegAvailable = false;
    let ffmpegVer = this.ffmpegVersion;

    for (const cand of ffmpegCandidates) {
      if (cand !== 'ffmpeg') {
        if (!fs.existsSync(cand) || !fs.statSync(cand).isFile()) continue;
        try {
          fs.chmodSync(cand, 0o755);
        } catch {}
      }

      try {
        const { stdout } = await execFileAsync(cand, ['-version'], { timeout: 10000 });
        const firstLine = stdout.split('\n')[0] || '';
        ffmpegVer = firstLine.replace('ffmpeg version ', '').split(' ')[0];
        ffmpegAvailable = true;
        this.ffmpegVersion = ffmpegVer;
        this.ffmpegPath = cand;
        break;
      } catch {
        // Continue to next candidate
      }
    }

    return {
      ytDlp: {
        available: ytAvailable,
        path: this.ytDlpPath,
        version: ytVer
      },
      ffmpeg: {
        available: ffmpegAvailable,
        path: this.ffmpegPath,
        version: ffmpegVer
      }
    };
  }

  public getYtDlpPath(): string {
    return this.ytDlpPath || 'yt-dlp';
  }

  public getFfmpegPath(): string {
    return this.ffmpegPath || 'ffmpeg';
  }
}

export const binaryService = new BinaryService();
