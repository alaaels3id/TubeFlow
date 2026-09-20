import { execFile } from 'node:child_process';
import { binaryService } from './binaryService';
import {
  AnalyzeResult,
  FormatOption,
  PlaylistItem,
  PlaylistMetadata,
  VideoMetadata
} from '../../shared/types';
import { formatDuration } from '../utils/sanitize';

export class MetadataService {
  public isPlaylistUrl(url: string): boolean {
    try {
      const u = new URL(url);
      if (u.pathname.includes('/playlist') || u.pathname.includes('/show') || u.pathname.includes('/shows')) {
        return true;
      }
      if (u.pathname.includes('VLPL') || (u.searchParams.has('list') && !u.searchParams.has('v'))) {
        return true;
      }
      return false;
    } catch {
      return url.includes('list=') || url.includes('/show/') || url.includes('/playlist');
    }
  }

  public async analyze(url: string): Promise<AnalyzeResult> {
    const ytDlp = binaryService.getYtDlpPath();
    const isExplicitPlaylist = this.isPlaylistUrl(url);

    if (isExplicitPlaylist) {
      try {
        const playlist = await this.fetchPlaylistMetadata(ytDlp, url);
        return { type: 'playlist', playlist };
      } catch (playlistError: any) {
        // If explicit playlist failed, try single video as fallback if it has video param
        if (url.includes('v=')) {
          try {
            const video = await this.fetchVideoMetadata(ytDlp, url);
            return { type: 'video', video };
          } catch {
            throw this.formatHumanError(playlistError);
          }
        }
        throw this.formatHumanError(playlistError);
      }
    }

    // Try analyzing as single video first
    try {
      const video = await this.fetchVideoMetadata(ytDlp, url);
      return { type: 'video', video };
    } catch (videoError: any) {
      const errMsg = videoError.message || '';
      // If error indicates it's actually a playlist or tab, attempt playlist extraction
      const seemsLikePlaylist =
        errMsg.includes('is a playlist') ||
        errMsg.includes('--yes-playlist') ||
        errMsg.includes('youtube:tab') ||
        errMsg.includes('playlist') ||
        url.includes('list=') ||
        url.includes('/show/');

      if (seemsLikePlaylist) {
        try {
          const playlist = await this.fetchPlaylistMetadata(ytDlp, url);
          return { type: 'playlist', playlist };
        } catch (playlistError: any) {
          throw this.formatHumanError(playlistError);
        }
      }

      throw this.formatHumanError(videoError);
    }
  }

  private fetchVideoMetadata(ytDlp: string, url: string): Promise<VideoMetadata> {
    return new Promise((resolve, reject) => {
      const args = [
        '-J',
        '--no-playlist',
        '--skip-download',
        '--no-warnings',
        url
      ];

      execFile(ytDlp, args, { maxBuffer: 30 * 1024 * 1024, timeout: 35000 }, (err, stdout, stderr) => {
        if (err) {
          return reject(new Error(stderr || err.message || 'Failed to extract video metadata'));
        }

        try {
          const data = JSON.parse(stdout);
          const duration = Math.round(data.duration || 0);
          const rawFormats = Array.isArray(data.formats) ? data.formats : [];

          // Find best audio stream size to add to video-only streams or for audio downloads
          let bestAudioSize = 0;
          for (const f of rawFormats) {
            if ((!f.vcodec || f.vcodec === 'none') && f.acodec && f.acodec !== 'none') {
              const sz = f.filesize || f.filesize_approx || (f.tbr || f.abr ? Math.round(((f.tbr || f.abr) * 1000 / 8) * duration) : 0);
              if (sz > bestAudioSize) {
                bestAudioSize = sz;
              }
            }
          }
          if (!bestAudioSize && duration > 0) {
            bestAudioSize = Math.round((128 * 1000 / 8) * duration);
          }

          // Map and deduce unique resolutions
          const resMap = new Map<string, FormatOption>();
          const standardHeights = [2160, 1440, 1080, 720, 480, 360];

          for (const f of rawFormats) {
            const height = f.height || 0;
            if (height && standardHeights.includes(height)) {
              const resTag = `${height}p`;
              let size = f.filesize || f.filesize_approx;
              if (!size && (f.tbr || f.vbr) && duration > 0) {
                size = Math.round(((f.tbr || f.vbr) * 1000 / 8) * duration);
              }
              const hasAudio = !!f.acodec && f.acodec !== 'none';
              const totalSize = size ? (hasAudio ? size : size + bestAudioSize) : undefined;

              const existing = resMap.get(resTag);
              if (!existing || (totalSize && (!existing.filesizeApprox || f.ext === 'mp4'))) {
                resMap.set(resTag, {
                  formatId: f.format_id,
                  resolution: resTag,
                  extension: (f.ext === 'webm' ? 'webm' : 'mp4'),
                  hasVideo: true,
                  hasAudio: hasAudio,
                  filesizeApprox: totalSize,
                  fps: f.fps
                });
              }
            }
          }

          // Fallback resolutions if none found
          if (resMap.size === 0) {
            resMap.set('1080p', { formatId: 'best', resolution: '1080p', extension: 'mp4', hasVideo: true, hasAudio: true, filesizeApprox: duration ? Math.round((4500 * 1000 / 8) * duration) : undefined });
            resMap.set('720p', { formatId: 'best', resolution: '720p', extension: 'mp4', hasVideo: true, hasAudio: true, filesizeApprox: duration ? Math.round((2200 * 1000 / 8) * duration) : undefined });
            resMap.set('360p', { formatId: 'best', resolution: '360p', extension: 'mp4', hasVideo: true, hasAudio: true, filesizeApprox: duration ? Math.round((600 * 1000 / 8) * duration) : undefined });
          }

          // Fill in any resolution with estimated size if missing
          const defaultBitrates: Record<string, number> = {
            '2160p': 25000,
            '1440p': 12000,
            '1080p': 4500,
            '720p': 2200,
            '480p': 1000,
            '360p': 600
          };
          for (const [resTag, opt] of resMap.entries()) {
            if (!opt.filesizeApprox && duration > 0 && defaultBitrates[resTag]) {
              opt.filesizeApprox = Math.round((defaultBitrates[resTag] * 1000 / 8) * duration) + bestAudioSize;
            }
          }

          // Add audio format option
          resMap.set('audio', {
            formatId: 'bestaudio',
            resolution: 'audio',
            extension: 'mp3',
            hasVideo: false,
            hasAudio: true,
            filesizeApprox: bestAudioSize
          });

          const availableResolutions = Array.from(resMap.keys()).filter((r) => r !== 'audio').sort((a, b) => {
            const numA = parseInt(a, 10) || 0;
            const numB = parseInt(b, 10) || 0;
            return numB - numA;
          });

          // Also include 'audio' resolution at the end
          availableResolutions.push('audio');

          const video: VideoMetadata = {
            id: data.id || 'video',
            url: data.webpage_url || url,
            title: data.title || 'YouTube Video',
            thumbnail: data.thumbnail || (data.thumbnails && data.thumbnails.length ? data.thumbnails[data.thumbnails.length - 1].url : ''),
            channel: data.uploader || data.channel || 'YouTube Channel',
            channelUrl: data.uploader_url || data.channel_url,
            duration,
            durationString: formatDuration(duration),
            viewCount: data.view_count,
            uploadDate: data.upload_date,
            formats: Array.from(resMap.values()),
            availableResolutions
          };

          resolve(video);
        } catch (parseError: any) {
          reject(new Error('Failed to parse video information: ' + parseError.message));
        }
      });
    });
  }

  private fetchPlaylistMetadata(ytDlp: string, url: string): Promise<PlaylistMetadata> {
    return new Promise((resolve, reject) => {
      const args = [
        '-J',
        '--flat-playlist',
        '--skip-download',
        '--no-warnings',
        url
      ];

      execFile(ytDlp, args, { maxBuffer: 40 * 1024 * 1024, timeout: 45000 }, (err, stdout, stderr) => {
        if (err) {
          return reject(new Error(stderr || err.message || 'Failed to extract playlist metadata'));
        }

        try {
          const data = JSON.parse(stdout);
          const rawEntries = Array.isArray(data.entries) ? data.entries : [];

          if (rawEntries.length === 0) {
            return reject(new Error('This playlist or show contains no accessible videos or is unavailable in your region.'));
          }

          // Filter out duplicate entries and unavailable/private items
          const seenIds = new Set<string>();
          const seenUrls = new Set<string>();
          const seenTitles = new Set<string>();
          const uniqueEntries: any[] = [];

          for (const e of rawEntries) {
            if (!e) continue;

            const videoId = e.id ? String(e.id).trim() : '';
            const rawUrl = e.url ? String(e.url).trim() : '';
            const cleanUrl = rawUrl.startsWith('http')
              ? rawUrl.split('&')[0]
              : (videoId ? `https://www.youtube.com/watch?v=${videoId}` : '');
            const rawTitle = (e.title || '').trim();
            const normalizedTitle = rawTitle.toLowerCase();

            // Skip deleted or private placeholders
            if (
              normalizedTitle === '[deleted video]' ||
              normalizedTitle === '[private video]' ||
              normalizedTitle === 'private video' ||
              normalizedTitle === 'deleted video'
            ) {
              continue;
            }

            // Deduplicate by ID
            if (videoId && seenIds.has(videoId)) {
              continue;
            }

            // Deduplicate by URL
            if (cleanUrl && seenUrls.has(cleanUrl)) {
              continue;
            }

            // Deduplicate by Title if identical
            if (normalizedTitle && seenTitles.has(normalizedTitle)) {
              continue;
            }

            if (videoId) seenIds.add(videoId);
            if (cleanUrl) seenUrls.add(cleanUrl);
            if (normalizedTitle) seenTitles.add(normalizedTitle);
            uniqueEntries.push(e);
          }

          if (uniqueEntries.length === 0) {
            return reject(new Error('This playlist contains no accessible videos.'));
          }

          const items: PlaylistItem[] = uniqueEntries.map((e: any, index: number) => {
            const dur = Math.round(e.duration || 0);
            const size = e.filesize || e.filesize_approx || (e.tbr && dur > 0 ? Math.round((e.tbr * 1000 / 8) * dur) : undefined);
            return {
              id: e.id || `item-${index + 1}`,
              url: e.url ? (e.url.startsWith('http') ? e.url : `https://www.youtube.com/watch?v=${e.id}`) : url,
              title: e.title || `Video #${index + 1}`,
              thumbnail: e.thumbnail || (e.thumbnails && e.thumbnails.length ? e.thumbnails[0].url : ''),
              channel: e.uploader || e.channel || data.uploader || 'YouTube',
              duration: dur,
              durationString: formatDuration(dur),
              index: index + 1,
              selected: true,
              filesizeApprox: size
            };
          });

          // Intelligent and clean title resolution for playlists and shows
          let resolvedTitle = (data.playlist_title || data.title || '').trim();
          const isGeneric =
            !resolvedTitle ||
            resolvedTitle.toLowerCase() === 'show' ||
            resolvedTitle.toLowerCase() === 'playlist' ||
            resolvedTitle.toLowerCase() === 'youtube playlist';

          if (isGeneric) {
            if (data.series && typeof data.series === 'string' && data.series.trim()) {
              resolvedTitle = data.series.trim();
            } else if (data.show && typeof data.show === 'string' && data.show.trim()) {
              resolvedTitle = data.show.trim();
            } else if (items.length > 0 && items[0].title) {
              const firstTitle = items[0].title;
              // Check if first title contains standard episode markers:
              // e.g. "مسلسل عمر - الحلقة 1", "Vikings - Season 1 Episode 1", "Series #1"
              const match = firstTitle.match(/^(.*?)\s*(?:[-–—|:]\s*(?:الحلقة|حلقة|Episode|Ep\.?|Part|جزء|\d+)|#\d+)/i);
              if (match && match[1] && match[1].trim().length > 2) {
                resolvedTitle = match[1].trim();
              } else {
                // Find common prefix among items
                const sampleTitles = items.slice(0, Math.min(6, items.length)).map((i) => i.title);
                let prefix = sampleTitles[0] || '';
                for (let i = 1; i < sampleTitles.length; i++) {
                  while (!sampleTitles[i].startsWith(prefix) && prefix.length > 0) {
                    prefix = prefix.slice(0, -1);
                  }
                }
                prefix = prefix.replace(/[-–—|:_#\s]+$/, '').trim();
                if (prefix.length > 2) {
                  resolvedTitle = prefix;
                } else if (data.uploader || data.channel) {
                  resolvedTitle = `${data.uploader || data.channel} Playlist`;
                }
              }
            }
          }

          if (!resolvedTitle) {
            resolvedTitle = 'YouTube Playlist';
          }

          const totalDuration = items.reduce((acc, item) => acc + (item.duration || 0), 0);
          // Default estimation using standard 1080p (4500kbps video + 128kbps audio = ~4628kbps)
          const estimatedTotalSize = totalDuration > 0
            ? Math.round(((4500 + 128) * 1000 / 8) * totalDuration)
            : items.reduce((acc, item) => acc + (item.filesizeApprox || 0), 0);

          const playlist: PlaylistMetadata = {
            id: data.id || 'playlist',
            url: data.webpage_url || url,
            title: resolvedTitle,
            thumbnail: data.thumbnail || (items[0] ? items[0].thumbnail : ''),
            channel: data.uploader || data.channel || 'YouTube Playlist',
            itemCount: items.length,
            items,
            totalDuration,
            totalDurationString: formatDuration(totalDuration),
            filesizeApprox: estimatedTotalSize > 0 ? estimatedTotalSize : undefined
          };

          resolve(playlist);
        } catch (parseError: any) {
          reject(new Error(parseError.message || 'Failed to parse playlist information'));
        }
      });
    });
  }

  private formatHumanError(err: any): Error {
    const msg = (err && err.message ? err.message : String(err)).toLowerCase();

    if (msg.includes('playlist does not exist') || msg.includes('no accessible videos')) {
      return new Error('This playlist does not exist, is private, or contains no available videos.');
    }
    if (msg.includes('video unavailable') || msg.includes('private video') || msg.includes('members-only')) {
      return new Error('This content is unavailable, private, or cannot be downloaded.');
    }
    if (msg.includes('unable to connect') || msg.includes('network error') || msg.includes('timed out') || msg.includes('enetunreach')) {
      return new Error('Unable to connect. Please check your internet connection and try again.');
    }
    if (msg.includes('is not a valid url') || msg.includes('unsupported url')) {
      return new Error('The URL is not a valid supported YouTube video or playlist link.');
    }

    // Clean up generic CLI prefix if present
    const clean = (err.message || 'Could not analyze URL. Please check the link and try again.')
      .replace(/Command failed:[^\n]+\n/i, '')
      .replace(/ERROR:\s*/gi, '')
      .trim();

    return new Error(clean.slice(0, 180));
  }
}

export const metadataService = new MetadataService();
