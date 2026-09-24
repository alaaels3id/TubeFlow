import { ChildProcess, spawn } from 'node:child_process';
import path from 'node:path';
import fs from 'node:fs';
import { DownloadJob, DownloadStatus, HistoryItem } from '../../shared/types';
import { binaryService } from './binaryService';
import { storageService } from './storageService';
import { notificationService } from './notificationService';
import { sanitizeFilename, formatDuration } from '../utils/sanitize';

interface ActiveProcess {
  job: DownloadJob;
  process?: ChildProcess;
  abortController?: AbortController;
  killedIntentional?: boolean;
}


function isDirectFileUrl(url: string): boolean {
  try {
    const pathname = new URL(url).pathname.toLowerCase();
    const directExts = [
      '.zip', '.rar', '.7z', '.tar', '.gz', '.bz2', '.xz',
      '.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx',
      '.iso', '.dmg', '.exe', '.msi', '.pkg', '.deb', '.rpm', '.apk',
      '.bin', '.csv', '.txt'
    ];
    return directExts.some((ext) => pathname.endsWith(ext));
  } catch {
    return false;
  }
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
    quality: string;
    format: 'mp4' | 'webm' | 'mp3' | 'm4a' | 'opus';
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

    // Prevent duplicate download jobs if the same video is already pending or downloading in the destination
    const existingJob = this.queue.find(
      (j) =>
        (j.status === 'pending' || j.status === 'downloading') &&
        j.url === options.url &&
        j.format === (options.format || settings.defaultFormat || 'mp4') &&
        j.destination === destDir
    );
    if (existingJob) {
      console.log(`[DOWNLOAD] Skipping duplicate download for: ${options.title} (already in queue with id: ${existingJob.id})`);
      return existingJob.id;
    }

    const jobId = `job-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
    const totalBytes = options.totalBytes || options.filesizeApprox || 0;

    const job: DownloadJob = {
      id: jobId,
      url: options.url,
      type: options.type,
      playlistId: options.playlistId,
      playlistTitle: options.playlistTitle,
      playlistIndex: options.playlistIndex,
      filesizeApprox: options.filesizeApprox || options.totalBytes,
      title: options.title,
      thumbnail: options.thumbnail,
      channel: options.channel,
      quality: options.quality || settings.defaultQuality || '1080p',
      format: options.format || settings.defaultFormat || 'mp4',
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
    if (job.type === 'file' || isDirectFileUrl(job.url)) {
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
      if (height && !isNaN(height)) {
        args.push('-f', `bestvideo[height<=${height}]+bestaudio/best[height<=${height}]/best`);
      } else {
        args.push('-f', 'bestvideo+bestaudio/best');
      }
      args.push('--merge-output-format', job.format);
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
    if (active) {
      active.killedIntentional = true;
      if (active.abortController) active.abortController.abort(); if (active.process) active.process.kill('SIGKILL');
      this.activeProcesses.delete(id);
      active.job.status = 'cancelled';
      this.emitProgress(active.job);
      this.processNextInQueue();
      return true;
    }
    const job = this.queue.find((j) => j.id === id);
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
      job.errorMessage = undefined;
      this.emitProgress(job);
      this.processNextInQueue();
      return true;
    }
    return false;
  }

  public removeDownload(id: string): boolean {
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
