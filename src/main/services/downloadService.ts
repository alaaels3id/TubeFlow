import { ChildProcess, spawn } from 'node:child_process';
import path from 'node:path';
import fs from 'node:fs';
import { DownloadJob, DownloadStatus, HistoryItem } from '../../shared/types';
import { binaryService } from './binaryService';
import { storageService } from './storageService';
import { notificationService } from './notificationService';
import { sanitizeFilename, formatDuration } from '../utils/sanitize';
import { transcriptService } from './transcriptService';

interface ActiveProcess {
  job: DownloadJob;
  process?: ChildProcess;
  abortController?: AbortController;
  killedIntentional?: boolean;
}


export const DIRECT_FILE_EXTENSIONS = new Set([
  // Archives & Compressed
  'zip', 'rar', '7z', 'tar', 'gz', 'bz2', 'xz', 'tgz', 'tbz2', 'zst', 'iso', 'cab', 'dmg', 'lz', 'lzma',
  // Installers & Executables & Packages
  'exe', 'msi', 'pkg', 'deb', 'rpm', 'apk', 'bin', 'run', 'appimage', 'jar',
  // Documents & eBooks
  'pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'txt', 'csv', 'rtf', 'epub', 'mobi', 'azw3', 'odt', 'ods', 'odp',
  // Audio files
  'mp3', 'flac', 'wav', 'aac', 'ogg', 'm4a', 'opus', 'wma', 'aiff', 'alac',
  // Direct Video files (direct downloads)
  'mp4', 'mkv', 'webm', 'avi', 'mov', 'flv', 'wmv', 'm4v', '3gp',
  // Images
  'jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'bmp', 'ico', 'tiff', 'psd',
  // Data & Code
  'json', 'xml', 'sql', 'sqlite', 'db', 'torrent'
]);

export function detectFileExtension(url: string, title?: string): string | null {
  if (title) {
    const cleanTitle = title.split('?')[0].split('#')[0].trim();
    const lastDot = cleanTitle.lastIndexOf('.');
    if (lastDot !== -1 && lastDot < cleanTitle.length - 1) {
      const ext = cleanTitle.slice(lastDot + 1).toLowerCase();
      if (ext.length >= 1 && ext.length <= 10 && /^[a-z0-9]+$/i.test(ext)) {
        return ext;
      }
    }
  }

  try {
    const parsed = new URL(url);
    const pathname = parsed.pathname;
    const lastSlash = pathname.lastIndexOf('/');
    const filenameFromPath = lastSlash !== -1 ? pathname.slice(lastSlash + 1) : pathname;
    const lastDot = filenameFromPath.lastIndexOf('.');
    if (lastDot !== -1 && lastDot < filenameFromPath.length - 1) {
      const ext = filenameFromPath.slice(lastDot + 1).toLowerCase();
      if (ext.length >= 1 && ext.length <= 10 && /^[a-z0-9]+$/i.test(ext)) {
        return ext;
      }
    }

    for (const [key, val] of parsed.searchParams.entries()) {
      if (key.toLowerCase().includes('file') || key.toLowerCase().includes('name')) {
        const lastDotParam = val.lastIndexOf('.');
        if (lastDotParam !== -1 && lastDotParam < val.length - 1) {
          const ext = val.slice(lastDotParam + 1).toLowerCase();
          if (ext.length >= 1 && ext.length <= 10 && /^[a-z0-9]+$/i.test(ext)) {
            return ext;
          }
        }
      }
    }
  } catch {}

  return null;
}

export function isDirectFile(url: string, title?: string, type?: string): boolean {
  if (type === 'file') return true;
  if (!url) return false;

  const isVideoPlatform = /^(https?:\/\/)?(www\.)?(youtube\.com|youtu\.be|vimeo\.com|tiktok\.com|twitter\.com|x\.com|facebook\.com|fb\.watch|instagram\.com|twitch\.tv|dailymotion\.com|soundcloud\.com|bilibili\.com|vk\.com|vkvideo\.ru|ok\.ru|rumble\.com)/i.test(url);
  if (isVideoPlatform) {
    return false;
  }

  const ext = detectFileExtension(url, title);
  if (ext && DIRECT_FILE_EXTENSIONS.has(ext)) {
    return true;
  }

  try {
    const parsed = new URL(url);
    const lastPart = parsed.pathname.split('/').pop() || '';
    if (lastPart.includes('.')) {
      const parts = lastPart.split('.');
      const potentialExt = parts[parts.length - 1].toLowerCase();
      if (potentialExt && potentialExt.length <= 8 && /^[a-z0-9]+$/i.test(potentialExt)) {
        return true;
      }
    }
  } catch {}

  return false;
}

export function isDirectFileUrl(url: string): boolean {
  return isDirectFile(url);
}

export function parseContentDispositionFilename(header: string | null | undefined): string | null {
  if (!header) return null;
  const utf8Match = header.match(/filename\*\s*=\s*(?:UTF-8|utf-8)''([^;]+)/i);
  if (utf8Match && utf8Match[1]) {
    try {
      return decodeURIComponent(utf8Match[1].trim());
    } catch {
      return utf8Match[1].trim();
    }
  }
  const standardMatch = header.match(/filename\s*=\s*(?:"([^"]+)"|'([^']+)'|([^;\s]+))/i);
  if (standardMatch) {
    const raw = standardMatch[1] || standardMatch[2] || standardMatch[3];
    if (raw) {
      try {
        return decodeURIComponent(raw.trim());
      } catch {
        return raw.trim();
      }
    }
  }
  return null;
}

export function getFilenameFromUrl(url: string, defaultName: string = 'download'): string {
  try {
    const parsed = new URL(url);
    const pathname = parsed.pathname;
    const lastSlash = pathname.lastIndexOf('/');
    if (lastSlash !== -1 && lastSlash < pathname.length - 1) {
      const decoded = decodeURIComponent(pathname.slice(lastSlash + 1));
      if (decoded && decoded !== '/') return sanitizeFilename(decoded);
    }
    for (const [key, val] of parsed.searchParams.entries()) {
      if ((key.toLowerCase().includes('file') || key.toLowerCase().includes('name')) && val) {
        return sanitizeFilename(decodeURIComponent(val));
      }
    }
  } catch {}
  return defaultName;
}

export class DownloadService {
  private queue: DownloadJob[] = [];
  private activeProcesses: Map<string, ActiveProcess> = new Map();
  private notifiedPlaylists: Set<string> = new Set();
  private onProgressCallback?: (job: DownloadJob) => void;
  private onCompletedCallback?: (job: DownloadJob) => void;
  private onFailedCallback?: (job: DownloadJob) => void;

  public setCallbacks(callbacks: {
    onProgress: (job: DownloadJob) => void;
    onCompleted: (job: DownloadJob) => void;
    onFailed: (job: DownloadJob) => void;
  }) {
    this.onProgressCallback = callbacks.onProgress;
    this.onCompletedCallback = callbacks.onCompleted;
    this.onFailedCallback = callbacks.onFailed;
  }

  public getQueue(): DownloadJob[] {
    return this.queue;
  }

  public sortQueue(order: 'asc' | 'desc' = 'asc'): DownloadJob[] {
    const active = this.queue.filter((j) => j.status === 'downloading' || j.status === 'processing');
    const others = this.queue.filter((j) => j.status !== 'downloading' && j.status !== 'processing');

    others.sort((a, b) => {
      if (typeof a.playlistIndex === 'number' && typeof b.playlistIndex === 'number') {
        return order === 'asc' ? a.playlistIndex - b.playlistIndex : b.playlistIndex - a.playlistIndex;
      }
      const cmp = a.title.localeCompare(b.title, undefined, { numeric: true, sensitivity: 'base' });
      return order === 'asc' ? cmp : -cmp;
    });

    this.queue = [...active, ...others];
    return this.queue;
  }

  public async startDownload(options: {
    url: string;
    type: 'video' | 'playlist-item' | 'file';
    title: string;
    thumbnail: string;
    channel?: string;
    quality?: string;
    format?: string;
    destination?: string;
    playlistId?: string;
    playlistTitle?: string;
    playlistIndex?: number;
    filesizeApprox?: number;
    totalBytes?: number;
  }): Promise<string> {
    const settings = storageService.getSettings();
    let destDir = options.destination || settings.downloadDirectory || process.env.HOME || '/tmp';

    // If part of a playlist, reset notification lock for this playlist so new batch alerts properly
    if (options.playlistId) {
      this.notifiedPlaylists.delete(options.playlistId);
    }
    if (options.playlistTitle) {
      this.notifiedPlaylists.delete(options.playlistTitle);
    }

    // Ensure every playlist is placed in its own dedicated separated folder inside downloads directory
    const isPlaylistItem = options.type === 'playlist-item' || !!options.playlistId || !!options.playlistTitle;
    if (isPlaylistItem) {
      const playlistName = options.playlistTitle || (options.playlistId ? `Playlist_${options.playlistId}` : 'Playlist');
      const folderName = sanitizeFilename(playlistName);
      if (folderName) {
        const normalizedDest = path.normalize(destDir);
        if (path.basename(normalizedDest) !== folderName) {
          destDir = path.join(destDir, folderName);
        }
      }
    }

    if (!fs.existsSync(destDir)) {
      try {
        fs.mkdirSync(destDir, { recursive: true });
      } catch (e) {
        console.error('Failed to create destination folder:', e);
      }
    }

    // Determine if this is a direct non-video file or general file
    const isDirect = options.type === 'file' || isDirectFile(options.url, options.title, options.type);
    const jobType: 'video' | 'playlist-item' | 'file' = isDirect ? 'file' : options.type;

    const detectedExt = detectFileExtension(options.url, options.title);
    const jobFormat = isDirect
      ? (detectedExt || (options.format && options.format !== 'mp4' ? options.format : 'file'))
      : (options.format || settings.defaultFormat || 'mp4');

    // Never assign video quality like 1080p to a non-video direct file
    const jobQuality = isDirect
      ? ''
      : (options.quality || settings.defaultQuality || '1080p');

    const jobTitle = options.title && options.title !== 'Download' && options.title !== 'download'
      ? options.title
      : getFilenameFromUrl(options.url, 'Download');

    // Prevent duplicate download jobs if the same video or file is already pending or downloading in the destination
    const existingJob = this.queue.find(
      (j) =>
        (j.status === 'pending' || j.status === 'downloading') &&
        j.url === options.url &&
        j.destination === destDir
    );
    if (existingJob) {
      console.log(`[DOWNLOAD] Skipping duplicate download for: ${jobTitle} (already in queue with id: ${existingJob.id})`);
      return existingJob.id;
    }

    const jobId = `job-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
    const totalBytes = options.totalBytes || options.filesizeApprox || 0;

    const job: DownloadJob = {
      id: jobId,
      url: options.url,
      type: jobType,
      playlistId: options.playlistId,
      playlistTitle: options.playlistTitle,
      playlistIndex: options.playlistIndex,
      filesizeApprox: options.filesizeApprox || options.totalBytes,
      title: jobTitle,
      thumbnail: options.thumbnail,
      channel: options.channel,
      quality: jobQuality,
      format: jobFormat,
      destination: destDir,
      status: 'pending',
      progress: 0,
      downloadedBytes: 0,
      totalBytes,
      speed: 0,
      remainingSeconds: 0,
      createdAt: new Date().toISOString()
    };

    this.queue.push(job);
    this.emitProgress(job);
    this.processNextInQueue();

    return jobId;
  }

  private processNextInQueue(): void {
    const settings = storageService.getSettings();
    const maxConcurrent = Math.max(1, Math.min(5, settings.concurrentDownloads || 3));

    const currentlyRunning = Array.from(this.activeProcesses.values()).length;
    if (currentlyRunning >= maxConcurrent) {
      return;
    }

    const nextJob = this.queue.find((j) => j.status === 'pending');
    if (!nextJob) {
      return;
    }

    this.executeJob(nextJob);
  }

  private executeJob(job: DownloadJob): void {
    if (job.format === 'txt' || job.quality === 'transcript') {
      this.executeTranscriptJob(job);
      return;
    }
    if (job.type === 'file' || isDirectFile(job.url, job.title, job.type)) {
      this.executeDirectFileJob(job);
      return;
    }
    job.status = 'downloading';
    this.emitProgress(job);

    const ytDlp = binaryService.getYtDlpPath();
    const ffmpeg = binaryService.getFfmpegPath();
    const settings = storageService.getSettings();

    // Ensure hidden temp directory exists inside destination folder
    const tempDir = path.join(job.destination, '.tubeflow-temp');
    try {
      if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true });
      }
    } catch (e) {
      console.error('Failed to create tempDir:', e);
    }

    // Output template
    const prefix = job.playlistIndex ? `${String(job.playlistIndex).padStart(2, '0')} - ` : '';
    const filenameTemplate = job.type === 'playlist-item'
      ? (prefix ? `${prefix}%(title)s.%(ext)s` : '%(playlist_index&{:02d} - |)s%(title)s.%(ext)s')
      : '%(title)s.%(ext)s';

    const isAudioOnly =
      ['mp3', 'm4a', 'opus'].includes(job.format) || job.quality === 'audio';

    const args: string[] = [
      job.url,
      '--newline',
      '--no-playlist',
      '--ffmpeg-location', ffmpeg,
      '-P', `home:${job.destination}`,
      '-P', `temp:${tempDir}`,
      '-o', filenameTemplate,
      '--progress-template', '%(info.vcodec)s|%(progress._percent_str)s|%(progress._downloaded_bytes_str)s|%(progress._total_bytes_str)s|%(progress._speed_str)s|%(progress._eta_str)s'
    ];

    // Duplicate behavior
    if (settings.duplicateAction === 'skip') {
      args.push('--no-overwrites');
    } else if (settings.duplicateAction === 'replace') {
      args.push('--force-overwrites');
    }

    // Format selection
    if (isAudioOnly) {
      args.push('-x');
      args.push('--audio-format', job.format === 'webm' || job.format === 'mp4' ? 'mp3' : job.format);
      args.push('--audio-quality', '0');
    } else {
      const height = parseInt(job.quality, 10);
      if (job.format === 'mp4') {
        // Enforce maximum universal compatibility (H.264/AVC video + AAC audio)
        // Vital for Smart TVs (Samsung Series 5, LG, Sony), USB sticks, and legacy media players
        if (height && !isNaN(height)) {
          args.push(
            '-f',
            `bestvideo[height<=${height}][vcodec^=avc1]+bestaudio[acodec^=mp4a]/bestvideo[height<=${height}][ext=mp4]+bestaudio[ext=m4a]/bestvideo[height<=${height}]+bestaudio/best[height<=${height}]/best`
          );
        } else {
          args.push(
            '-f',
            'bestvideo[vcodec^=avc1]+bestaudio[acodec^=mp4a]/bestvideo[ext=mp4]+bestaudio[ext=m4a]/bestvideo+bestaudio/best'
          );
        }
        args.push('--merge-output-format', 'mp4');
        args.push('--postprocessor-args', 'Merger:-movflags +faststart');
      } else {
        if (height && !isNaN(height)) {
          args.push('-f', `bestvideo[height<=${height}]+bestaudio/best[height<=${height}]/best`);
        } else {
          args.push('-f', 'bestvideo+bestaudio/best');
        }
        args.push('--merge-output-format', job.format);
      }
    }

    let detectedFilePath = '';
    let isDualStream = !isAudioOnly; // Assume dual-stream for video unless format line says otherwise
    let videoDownloaded = 0;
    let videoTotal = 0;
    let audioDownloaded = 0;
    let audioTotal = 0;
    let emaSpeed = 0;
    let lastEtaUpdate = Date.now();
    let currentEta = 0;
    let stdoutBuffer = '';

    const proc = spawn(ytDlp, args);
    const activeItem: ActiveProcess = { job, process: proc };
    this.activeProcesses.set(job.id, activeItem);

    proc.stdout.on('data', (data) => {
      stdoutBuffer += data.toString();
      const lines = stdoutBuffer.split(/\r\n|\r|\n/);
      // Keep unfinished fragment in buffer
      stdoutBuffer = lines.pop() || '';

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;

        // Check if format output specifies multi-stream (e.g. "Downloading 1 format(s): 395+251")
        const formatMatch = trimmed.match(/Downloading \d+ format\(s\):\s*(\S+)/);
        if (formatMatch) {
          isDualStream = formatMatch[1].includes('+');
        }

        // Check for output file indication
        // [MoveFiles] Moving file "..." to "..." or [download] Destination: ...
        const moveMatch = trimmed.match(/\[MoveFiles\] Moving file "[^"]+" to "?([^"\n]+)"?/);
        if (moveMatch && moveMatch[1]) {
          detectedFilePath = moveMatch[1].trim();
          job.filePath = detectedFilePath;
        } else {
          const destMatch = trimmed.match(/\[(?:download|Merger|ExtractAudio)\] (?:Destination:|Merging formats into )"?([^"\n]+)"?/);
          if (destMatch && destMatch[1]) {
            let captured = destMatch[1].trim();
            if (captured.includes('.tubeflow-temp')) {
              captured = path.join(job.destination, path.basename(captured));
            }
            detectedFilePath = captured;
            job.filePath = detectedFilePath;
          }
        }

        // Check for merger or postprocess
        if (trimmed.includes('[Merger]') || trimmed.includes('[ExtractAudio]') || trimmed.includes('[Fixup')) {
          job.status = 'processing';
          job.progress = Math.max(job.progress, 99);
          job.speed = 0;
          job.remainingSeconds = 0;
          this.emitProgress(job);
          continue;
        }

        // Parse custom progress template: vcodec|percent|downloaded|total|speed|eta
        const parts = trimmed.split('|');
        if (parts.length === 6) {
          const vcodec = parts[0].trim();
          const rawPercent = parseFloat(parts[1].replace('%', '').trim());
          const percent = isNaN(rawPercent) ? 0 : Math.min(100, Math.max(0, rawPercent));
          const currentDownloaded = this.parseSize(parts[2].trim());
          const currentTotal = this.parseSize(parts[3].trim());
          const instantSpeed = this.parseSize(parts[4].trim());
          const rawEta = this.parseEta(parts[5].trim());

          // Update smoothed speed (Exponential Moving Average)
          if (instantSpeed > 0) {
            emaSpeed = emaSpeed === 0 ? instantSpeed : Math.round(0.25 * instantSpeed + 0.75 * emaSpeed);
            job.speed = emaSpeed;
          }

          if (isDualStream) {
            const isAudioStream = vcodec === 'none';
            if (!isAudioStream) {
              // Video stream phase (0% -> 85%)
              videoDownloaded = Math.max(videoDownloaded, currentDownloaded);
              if (currentTotal > 0) videoTotal = Math.max(videoTotal, currentTotal);

              const mappedPercent = Math.min(85, Math.round(percent * 0.85));
              job.progress = Math.max(job.progress, mappedPercent);
              job.downloadedBytes = Math.max(job.downloadedBytes, videoDownloaded);

              // Estimate total with ~15% audio overhead
              const estimatedTotal = videoTotal > 0 ? Math.round(videoTotal / 0.85) : 0;
              job.totalBytes = Math.max(job.totalBytes, estimatedTotal);
            } else {
              // Audio stream phase (85% -> 98%)
              audioDownloaded = Math.max(audioDownloaded, currentDownloaded);
              if (currentTotal > 0) audioTotal = Math.max(audioTotal, currentTotal);

              const mappedPercent = Math.min(98, Math.round(85 + (percent * 0.13)));
              job.progress = Math.max(job.progress, mappedPercent);

              const combinedDownloaded = videoDownloaded + audioDownloaded;
              const combinedTotal = (videoTotal || videoDownloaded) + (audioTotal || 0);
              job.downloadedBytes = Math.max(job.downloadedBytes, combinedDownloaded);
              if (combinedTotal > 0) {
                job.totalBytes = Math.max(job.totalBytes, combinedTotal);
              }
            }
          } else {
            // Single stream phase (0% -> 98%)
            const mappedPercent = Math.min(98, Math.round(percent * 0.98));
            job.progress = Math.max(job.progress, mappedPercent);
            job.downloadedBytes = Math.max(job.downloadedBytes, currentDownloaded);
            job.totalBytes = Math.max(job.totalBytes, currentTotal);
          }

          // Calculate smoothed, steadily decreasing ETA (countdown)
          const now = Date.now();
          const elapsedSec = (now - lastEtaUpdate) / 1000;
          lastEtaUpdate = now;

          // Decay previous ETA by elapsed real time
          let targetEta = currentEta > 0 ? Math.max(0, currentEta - elapsedSec) : rawEta;

          // If we have totalBytes and downloadedBytes and speed, compute whole-job ETA
          if (job.totalBytes > job.downloadedBytes && emaSpeed > 0) {
            const calculatedEta = Math.round((job.totalBytes - job.downloadedBytes) / emaSpeed);
            if (currentEta === 0) {
              targetEta = calculatedEta;
            } else {
              // Blend softly (85% countdown decay, 15% recalculated)
              targetEta = 0.85 * targetEta + 0.15 * calculatedEta;
            }
          } else if (rawEta > 0 && currentEta === 0) {
            targetEta = rawEta;
          }

          // Monotonic countdown constraint:
          // Do not allow ETA to increase wildly due to short packet delays
          const roundedTarget = Math.round(targetEta);
          if (currentEta > 0) {
            if (roundedTarget > currentEta) {
              // Dampen upward spikes: allow at most +1 second only if stalled for >= 3 seconds
              currentEta = currentEta + (elapsedSec >= 3 ? 1 : 0);
            } else {
              // Decreasing smoothly
              currentEta = roundedTarget;
            }
          } else {
            currentEta = roundedTarget;
          }

          job.remainingSeconds = currentEta;
          this.emitProgress(job);
        }
      }
    });

    proc.stderr.on('data', (data) => {
      const errorText = data.toString();
      if (errorText.includes('ERROR:')) {
        job.errorMessage = errorText.replace(/^ERROR:\s*/, '').trim();
      }
    });

    proc.on('close', (code) => {
      this.activeProcesses.delete(job.id);

      if (activeItem.killedIntentional) {
        return; // Handled by pause or cancel method
      }

      // Clean up tempDir if empty
      try {
        if (fs.existsSync(tempDir) && fs.readdirSync(tempDir).length === 0) {
          fs.rmdirSync(tempDir);
        }
      } catch {}

      if (code === 0) {
        job.status = 'completed';
        job.progress = 100;
        job.speed = 0;
        job.remainingSeconds = 0;
        if (job.totalBytes > 0) {
          job.downloadedBytes = job.totalBytes;
        }
        job.completedAt = new Date().toISOString();

        // If filePath was not captured, estimate from title
        if (!job.filePath) {
          job.filePath = path.join(job.destination, `${sanitizeFilename(job.title)}.${job.format}`);
        }

        this.emitProgress(job);
        if (this.onCompletedCallback) this.onCompletedCallback(job);

        // Add to persistent history
        storageService.addHistoryItem({
          id: job.id,
          url: job.url,
          type: job.type === 'playlist-item' ? 'playlist' : 'video',
          title: job.title,
          thumbnail: job.thumbnail,
          channel: job.channel,
          quality: job.quality,
          format: job.format,
          fileSize: job.totalBytes || job.downloadedBytes,
          filePath: job.filePath,
          status: 'completed',
          downloadDate: new Date().toISOString(),
          playlistTitle: job.playlistTitle
        });

        const currentSettings = storageService.getSettings();
        const isArabic = currentSettings.language === 'ar';
        const completedDate = new Date();
        const formattedDate = completedDate.toLocaleString(isArabic ? 'ar' : 'en-US', {
          year: 'numeric',
          month: 'short',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
          hour12: true
        });

        const notifTitle = isArabic ? 'اكتمل التحميل بنجاح 🎉' : 'Download Completed 🎉';
        const notifBody = isArabic
          ? `اسم الفيديو: ${job.title}\nتاريخ التحميل: ${formattedDate}`
          : `Video: ${job.title}\nDownloaded at: ${formattedDate}`;

        notificationService.notify(notifTitle, notifBody);

        // Check if the whole playlist has completed
        this.checkPlaylistCompletion(job, isArabic, formattedDate);
      } else {
        job.status = 'failed';
        if (!job.errorMessage) {
          job.errorMessage = `Download failed with exit code ${code}`;
        }
        this.emitProgress(job);
        if (this.onFailedCallback) this.onFailedCallback(job);

        storageService.addHistoryItem({
          id: job.id,
          url: job.url,
          type: job.type === 'playlist-item' ? 'playlist' : 'video',
          title: job.title,
          thumbnail: job.thumbnail,
          channel: job.channel,
          quality: job.quality,
          format: job.format,
          status: 'failed',
          errorMessage: job.errorMessage,
          downloadDate: new Date().toISOString(),
          playlistTitle: job.playlistTitle
        });

        const currentSettings = storageService.getSettings();
        const isArabic = currentSettings.language === 'ar';
        const notifTitle = isArabic ? 'فشل التحميل ❌' : 'Download Failed ❌';
        const notifBody = isArabic
          ? `فشل تحميل: ${job.title}`
          : `Failed to download: ${job.title}`;
        notificationService.notify(notifTitle, notifBody);

        const failedDate = new Date().toLocaleString(isArabic ? 'ar' : 'en-US', {
          year: 'numeric',
          month: 'short',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
          hour12: true
        });
        this.checkPlaylistCompletion(job, isArabic, failedDate);
      }

      // Check next queued job
      this.processNextInQueue();
    });
  }

  private async executeTranscriptJob(job: DownloadJob): Promise<void> {
    const settings = storageService.getSettings();
    const isArabic = settings.language === 'ar';
    job.status = 'downloading';
    job.progress = 15;
    job.speed = 0;
    this.emitProgress(job);

    try {
      job.progress = 40;
      this.emitProgress(job);

      const result = await transcriptService.getTranscript(job.url, 'en', false);

      job.progress = 80;
      this.emitProgress(job);

      const savedPath = await transcriptService.saveTranscript({
        title: job.title || result.title,
        text: result.text,
        format: 'txt',
        destination: job.destination
      });

      job.filePath = savedPath;
      job.status = 'completed';
      job.progress = 100;
      job.remainingSeconds = 0;
      job.completedAt = new Date().toISOString();

      const stats = fs.existsSync(savedPath) ? fs.statSync(savedPath) : null;
      if (stats) {
        job.downloadedBytes = stats.size;
        job.totalBytes = stats.size;
      }

      this.emitProgress(job);
      if (this.onCompletedCallback) this.onCompletedCallback(job);

      storageService.addHistoryItem({
        id: job.id,
        url: job.url,
        type: 'file',
        title: job.title || result.title,
        thumbnail: job.thumbnail,
        channel: job.channel,
        quality: 'Transcript',
        format: 'txt',
        filePath: savedPath,
        fileSize: stats?.size,
        duration: job.duration,
        completedAt: job.completedAt
      });

      const notifTitle = isArabic ? 'اكتمل تنزيل النص بنجاح 📝' : 'Transcript Downloaded 📝';
      const notifBody = isArabic
        ? `تم حفظ النص: ${job.title || result.title}`
        : `Saved transcript: ${job.title || result.title}`;
      notificationService.notify(notifTitle, notifBody);

      this.processNextInQueue();
    } catch (err: any) {
      job.status = 'failed';
      job.errorMessage = err.message || 'Failed to extract video transcript';
      job.speed = 0;
      job.remainingSeconds = 0;
      this.emitProgress(job);
      if (this.onFailedCallback) this.onFailedCallback(job);
      this.processNextInQueue();
    }
  }

  private async executeDirectFileJob(job: DownloadJob): Promise<void> {
    const settings = storageService.getSettings();
    job.status = 'downloading';
    this.emitProgress(job);

    const abortController = new AbortController();
    const activeItem: ActiveProcess = { job, abortController };
    this.activeProcesses.set(job.id, activeItem);

    const tempDir = path.join(job.destination, '.tubeflow-temp');
    try {
      if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true });
      }
    } catch (e) {
      console.error('Failed to create tempDir:', e);
    }

    const tempFilePath = path.join(tempDir, `${job.id}.part`);
    let fileStream: fs.WriteStream | null = null;

    try {
      let existingBytes = 0;
      if (fs.existsSync(tempFilePath)) {
        try {
          existingBytes = fs.statSync(tempFilePath).size;
        } catch {
          existingBytes = 0;
        }
      }

      // Prepare request headers with browser user-agent and optional range
      let headers: Record<string, string> = {
        'User-Agent':
          'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
        'Accept': '*/*',
        'Accept-Encoding': 'identity'
      };

      if (existingBytes > 0) {
        headers['Range'] = `bytes=${existingBytes}-`;
      }

      let response: Response;
      try {
        response = await fetch(job.url, {
          headers,
          signal: abortController.signal,
          redirect: 'follow'
        });
      } catch (fetchErr: any) {
        if (activeItem.killedIntentional) {
          return;
        }
        throw fetchErr;
      }

      if (activeItem.killedIntentional) {
        return;
      }

      // If server returned 416 (Range not satisfiable), restart download from 0
      if (response.status === 416 && existingBytes > 0) {
        try {
          fs.unlinkSync(tempFilePath);
        } catch {}
        existingBytes = 0;
        delete headers['Range'];
        response = await fetch(job.url, {
          headers,
          signal: abortController.signal,
          redirect: 'follow'
        });
      }

      if (!response.ok && response.status !== 206) {
        throw new Error(`Server returned HTTP ${response.status}: ${response.statusText}`);
      }

      const isPartial = response.status === 206;
      const startByte = isPartial ? existingBytes : 0;
      fileStream = fs.createWriteStream(tempFilePath, { flags: isPartial ? 'a' : 'w' });

      // Parse metadata from response headers
      const contentDisposition = response.headers.get('content-disposition');
      const filenameFromHeader = parseContentDispositionFilename(contentDisposition);
      if (filenameFromHeader) {
        job.title = sanitizeFilename(filenameFromHeader);
        const ext = path.extname(filenameFromHeader).replace('.', '').toLowerCase();
        if (ext) job.format = ext;
      } else if (!job.title || job.title === 'Download' || job.title === 'download') {
        const urlToInspect = response.url || job.url;
        try {
          const u = new URL(urlToInspect);
          const p = u.pathname;
          const leaf = decodeURIComponent(p.substring(p.lastIndexOf('/') + 1));
          if (leaf) {
            job.title = sanitizeFilename(leaf);
            const ext = path.extname(leaf).replace('.', '').toLowerCase();
            if (ext) job.format = ext;
          }
        } catch {}
      }

      // Content length / total bytes estimation
      const clHeader = response.headers.get('content-length');
      let contentLength = clHeader ? parseInt(clHeader, 10) : 0;
      if (isNaN(contentLength)) contentLength = 0;

      let totalBytes = 0;
      if (isPartial) {
        const crHeader = response.headers.get('content-range');
        if (crHeader) {
          const match = crHeader.match(/\/(\d+|\*)/);
          if (match && match[1] !== '*') {
            totalBytes = parseInt(match[1], 10);
          }
        }
        if (!totalBytes && contentLength > 0) {
          totalBytes = startByte + contentLength;
        }
      } else {
        totalBytes = contentLength;
      }

      if (totalBytes > 0) {
        job.totalBytes = totalBytes;
        job.filesizeApprox = totalBytes;
      }

      // Streaming data & tracking progress
      let downloaded = startByte;
      job.downloadedBytes = downloaded;
      if (job.totalBytes > 0) {
        job.progress = Math.min(99, Math.round((downloaded / job.totalBytes) * 100));
      }
      this.emitProgress(job);

      let emaSpeed = 0;
      let lastBytes = downloaded;
      let lastTime = Date.now();
      let lastEmitTime = Date.now();

      if (!response.body) {
        throw new Error('Response body stream is empty');
      }

      const reader = response.body.getReader();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        if (!value) continue;

        if (activeItem.killedIntentional) {
          try {
            await reader.cancel();
          } catch {}
          fileStream.close();
          return;
        }

        const canContinue = fileStream.write(value);
        if (!canContinue) {
          await new Promise<void>((resolve) => fileStream?.once('drain', () => resolve()));
        }

        downloaded += value.length;
        job.downloadedBytes = downloaded;

        if (job.totalBytes > 0) {
          job.progress = Math.min(99, Math.round((downloaded / job.totalBytes) * 100));
        }

        const now = Date.now();
        const elapsed = now - lastTime;
        if (elapsed >= 500) {
          const bytesDiff = downloaded - lastBytes;
          const instantSpeed = Math.round((bytesDiff / elapsed) * 1000);
          emaSpeed = emaSpeed === 0 ? instantSpeed : Math.round(0.3 * instantSpeed + 0.7 * emaSpeed);
          job.speed = emaSpeed;

          if (job.totalBytes > downloaded && emaSpeed > 0) {
            job.remainingSeconds = Math.round((job.totalBytes - downloaded) / emaSpeed);
          }

          lastBytes = downloaded;
          lastTime = now;
        }

        if (now - lastEmitTime >= 250) {
          this.emitProgress(job);
          lastEmitTime = now;
        }
      }

      // Finalize file stream
      await new Promise<void>((resolve, reject) => {
        if (!fileStream) return resolve();
        fileStream.end((err?: Error | null) => {
          if (err) reject(err);
          else resolve();
        });
      });

      if (activeItem.killedIntentional) {
        return;
      }

      this.activeProcesses.delete(job.id);

      // Final filename & destination duplicate resolution
      let finalFilename = sanitizeFilename(job.title || 'download');
      const ext = path.extname(finalFilename);
      if (!ext && job.format && job.format !== 'file') {
        finalFilename = `${finalFilename}.${job.format}`;
      }

      let finalPath = path.join(job.destination, finalFilename);

      if (fs.existsSync(finalPath)) {
        if (settings.duplicateAction === 'skip') {
          try { fs.unlinkSync(tempFilePath); } catch {}
          job.status = 'completed';
          job.progress = 100;
          job.speed = 0;
          job.remainingSeconds = 0;
          job.filePath = finalPath;
          this.emitProgress(job);
          if (this.onCompletedCallback) this.onCompletedCallback(job);
          this.processNextInQueue();
          return;
        } else if (settings.duplicateAction === 'replace') {
          try { fs.unlinkSync(finalPath); } catch {}
        } else {
          // copy: generate unique name "name (1).ext"
          const parsed = path.parse(finalFilename);
          let counter = 1;
          while (fs.existsSync(path.join(job.destination, `${parsed.name} (${counter})${parsed.ext}`))) {
            counter++;
          }
          finalFilename = `${parsed.name} (${counter})${parsed.ext}`;
          finalPath = path.join(job.destination, finalFilename);
        }
      }

      // Move temp file to final destination atomically
      try {
        fs.renameSync(tempFilePath, finalPath);
      } catch (moveErr: any) {
        if (moveErr.code === 'EXDEV') {
          fs.copyFileSync(tempFilePath, finalPath);
          try { fs.unlinkSync(tempFilePath); } catch {}
        } else {
          throw moveErr;
        }
      }

      job.filePath = finalPath;
      job.status = 'completed';
      job.progress = 100;
      job.speed = 0;
      job.remainingSeconds = 0;
      job.downloadedBytes = job.totalBytes > 0 ? job.totalBytes : downloaded;
      job.completedAt = new Date().toISOString();

      this.emitProgress(job);
      if (this.onCompletedCallback) this.onCompletedCallback(job);

      // Save to history
      storageService.addHistoryItem({
        id: job.id,
        url: job.url,
        type: 'file',
        title: job.title,
        thumbnail: job.thumbnail,
        channel: job.channel,
        quality: '',
        format: job.format,
        fileSize: job.downloadedBytes,
        filePath: job.filePath,
        status: 'completed',
        downloadDate: new Date().toISOString()
      });

      // Notification
      const isArabic = settings.language === 'ar';
      const notifTitle = isArabic ? 'اكتمل التحميل بنجاح 🎉' : 'Download Completed 🎉';
      const notifBody = isArabic
        ? `اسم الملف: ${job.title}`
        : `File: ${job.title}`;
      notificationService.notify(notifTitle, notifBody);

      this.processNextInQueue();
    } catch (err: any) {
      if (fileStream) {
        try { fileStream.close(); } catch {}
      }

      this.activeProcesses.delete(job.id);

      if (activeItem.killedIntentional) {
        return;
      }

      job.status = 'failed';
      job.speed = 0;
      job.remainingSeconds = 0;
      job.errorMessage = err.name === 'AbortError'
        ? 'Download was aborted'
        : (err.message || 'Direct file download failed');

      this.emitProgress(job);
      if (this.onFailedCallback) this.onFailedCallback(job);

      storageService.addHistoryItem({
        id: job.id,
        url: job.url,
        type: 'file',
        title: job.title,
        thumbnail: job.thumbnail,
        channel: job.channel,
        quality: '',
        format: job.format,
        status: 'failed',
        errorMessage: job.errorMessage,
        downloadDate: new Date().toISOString()
      });

      const isArabic = settings.language === 'ar';
      const notifTitle = isArabic ? 'فشل التحميل ❌' : 'Download Failed ❌';
      const notifBody = isArabic
        ? `فشل تحميل: ${job.title}`
        : `Failed to download: ${job.title}`;
      notificationService.notify(notifTitle, notifBody);

      this.processNextInQueue();
    }
  }

  public pauseDownload(id: string): boolean {
    const active = this.activeProcesses.get(id);
    if (active) {
      active.killedIntentional = true;
      if (active.abortController) active.abortController.abort(); if (active.process) active.process.kill('SIGTERM');
      this.activeProcesses.delete(id);
      active.job.status = 'paused';
      this.emitProgress(active.job);
      this.processNextInQueue();
      return true;
    }
    const queued = this.queue.find((j) => j.id === id && j.status === 'pending');
    if (queued) {
      queued.status = 'paused';
      this.emitProgress(queued);
      return true;
    }
    return false;
  }

  public resumeDownload(id: string): boolean {
    const job = this.queue.find((j) => j.id === id);
    if (job && (job.status === 'paused' || job.status === 'failed')) {
      job.status = 'pending';
      job.errorMessage = undefined;
      this.emitProgress(job);
      this.processNextInQueue();
      return true;
    }
    return false;
  }

  public cancelDownload(id: string): boolean {
    const active = this.activeProcesses.get(id);
    const job = active?.job || this.queue.find((j) => j.id === id);
    if (job) {
      try {
        const tempFilePath = path.join(job.destination, '.tubeflow-temp', `${job.id}.part`);
        if (fs.existsSync(tempFilePath)) {
          fs.unlinkSync(tempFilePath);
        }
      } catch {}
    }

    if (active) {
      active.killedIntentional = true;
      if (active.abortController) active.abortController.abort(); if (active.process) active.process.kill('SIGKILL');
      this.activeProcesses.delete(id);
      active.job.status = 'cancelled';
      this.emitProgress(active.job);
      this.processNextInQueue();
      return true;
    }
    if (job) {
      job.status = 'cancelled';
      this.emitProgress(job);
      return true;
    }
    return false;
  }

  public retryDownload(id: string): boolean {
    const job = this.queue.find((j) => j.id === id);
    if (job) {
      job.status = 'pending';
      job.progress = 0;
      job.downloadedBytes = 0;
      job.speed = 0;
      job.remainingSeconds = 0;
      job.errorMessage = undefined;
      try {
        const tempFilePath = path.join(job.destination, '.tubeflow-temp', `${job.id}.part`);
        if (fs.existsSync(tempFilePath)) {
          fs.unlinkSync(tempFilePath);
        }
      } catch {}
      this.emitProgress(job);
      this.processNextInQueue();
      return true;
    }
    return false;
  }

  public removeDownload(id: string): boolean {
    const job = this.queue.find((j) => j.id === id);
    if (job) {
      try {
        const tempFilePath = path.join(job.destination, '.tubeflow-temp', `${job.id}.part`);
        if (fs.existsSync(tempFilePath)) {
          fs.unlinkSync(tempFilePath);
        }
      } catch {}
    }
    this.cancelDownload(id);
    this.queue = this.queue.filter((j) => j.id !== id);
    return true;
  }

  public pauseAll(): boolean {
    for (const [id, active] of this.activeProcesses.entries()) {
      active.killedIntentional = true;
      if (active.abortController) active.abortController.abort(); if (active.process) active.process.kill('SIGTERM');
      active.job.status = 'paused';
      this.emitProgress(active.job);
      this.activeProcesses.delete(id);
    }
    for (const job of this.queue) {
      if (job.status === 'pending' || job.status === 'downloading' || job.status === 'processing') {
        job.status = 'paused';
        this.emitProgress(job);
      }
    }
    return true;
  }

  public resumeAll(): boolean {
    let resumedAny = false;
    for (const job of this.queue) {
      if (job.status === 'paused') {
        job.status = 'pending';
        job.errorMessage = undefined;
        this.emitProgress(job);
        resumedAny = true;
      }
    }
    if (resumedAny) {
      this.processNextInQueue();
    }
    return resumedAny;
  }

  public stopAll(): boolean {
    for (const [id, active] of this.activeProcesses.entries()) {
      active.killedIntentional = true;
      if (active.abortController) active.abortController.abort(); if (active.process) active.process.kill('SIGKILL');
      active.job.status = 'cancelled';
      this.emitProgress(active.job);
      this.activeProcesses.delete(id);
    }
    for (const job of this.queue) {
      if (
        job.status === 'pending' ||
        job.status === 'downloading' ||
        job.status === 'processing' ||
        job.status === 'paused'
      ) {
        job.status = 'cancelled';
        this.emitProgress(job);
      }
    }
    return true;
  }

  private emitProgress(job: DownloadJob): void {
    if (this.onProgressCallback) {
      this.onProgressCallback(job);
    }
  }

  private parseSize(sizeStr: string): number {
    if (!sizeStr || sizeStr === 'N/A' || sizeStr === 'Unknown') return 0;
    const match = sizeStr.match(/^([\d.]+)\s*([A-Za-z]+)/);
    if (!match) return parseFloat(sizeStr) || 0;

    const val = parseFloat(match[1]);
    const unit = match[2].toUpperCase();

    if (unit.startsWith('K')) return Math.round(val * 1024);
    if (unit.startsWith('M')) return Math.round(val * 1024 * 1024);
    if (unit.startsWith('G')) return Math.round(val * 1024 * 1024 * 1024);
    if (unit.startsWith('T')) return Math.round(val * 1024 * 1024 * 1024 * 1024);
    return Math.round(val);
  }

  private parseEta(etaStr: string): number {
    if (!etaStr || etaStr === 'N/A' || etaStr === 'Unknown') return 0;
    const parts = etaStr.split(':').map((p) => parseInt(p, 10));
    if (parts.some(isNaN)) return 0;
    if (parts.length === 3) {
      return parts[0] * 3600 + parts[1] * 60 + parts[2];
    }
    if (parts.length === 2) {
      return parts[0] * 60 + parts[1];
    }
    return parts[0] || 0;
  }

  private checkPlaylistCompletion(job: DownloadJob, isArabic: boolean, formattedDate: string): void {
    if (job.type !== 'playlist-item' || (!job.playlistId && !job.playlistTitle)) {
      return;
    }

    const playlistKey = job.playlistId || job.playlistTitle!;
    const playlistJobs = this.queue.filter(
      (j) =>
        j.type === 'playlist-item' &&
        ((job.playlistId && j.playlistId === job.playlistId) ||
          (job.playlistTitle && j.playlistTitle === job.playlistTitle))
    );

    if (playlistJobs.length === 0) return;

    // Check if any playlist items are still in progress
    const hasRemaining = playlistJobs.some(
      (j) => j.status === 'pending' || j.status === 'downloading' || j.status === 'paused'
    );

    if (!hasRemaining && !this.notifiedPlaylists.has(playlistKey)) {
      this.notifiedPlaylists.add(playlistKey);

      const completedCount = playlistJobs.filter((j) => j.status === 'completed').length;
      const failedCount = playlistJobs.filter((j) => j.status === 'failed').length;
      const totalCount = playlistJobs.length;
      const playlistName = job.playlistTitle || 'Playlist';

      // Only notify if at least one item was completed
      if (completedCount === 0) return;

      const playlistNotifTitle = isArabic
        ? 'اكتمل تحميل قائمة التشغيل بنجاح! 📂🎉'
        : 'Playlist Downloaded Successfully! 📂🎉';

      let playlistNotifBody: string;
      if (failedCount === 0) {
        playlistNotifBody = isArabic
          ? `قائمة التشغيل: ${playlistName}\nتم تحميل جميع الفيديوهات (${completedCount} فيديو) بنجاح\nتاريخ التحميل: ${formattedDate}`
          : `Playlist: ${playlistName}\nAll ${completedCount} videos downloaded successfully\nDownloaded at: ${formattedDate}`;
      } else {
        playlistNotifBody = isArabic
          ? `قائمة التشغيل: ${playlistName}\nتم تحميل ${completedCount} من ${totalCount} فيديو بنجاح (${failedCount} تعذر تحميله)\nتاريخ التحميل: ${formattedDate}`
          : `Playlist: ${playlistName}\n${completedCount} of ${totalCount} videos downloaded successfully (${failedCount} failed)\nDownloaded at: ${formattedDate}`;
      }

      notificationService.notify(playlistNotifTitle, playlistNotifBody);
    }
  }
}

export const downloadService = new DownloadService();
