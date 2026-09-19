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
  process: ChildProcess;
  killedIntentional?: boolean;
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
      const cmp = a.title.localeCompare(b.title, undefined, { numeric: true, sensitivity: 'base' });
      return order === 'asc' ? cmp : -cmp;
    });

    this.queue = [...active, ...others];
    return this.queue;
  }

  public async startDownload(options: {
    url: string;
    type: 'video' | 'playlist-item';
    title: string;
    thumbnail: string;
    channel?: string;
    quality: string;
    format: 'mp4' | 'webm' | 'mp3' | 'm4a' | 'opus';
    destination?: string;
    playlistId?: string;
    playlistTitle?: string;
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

    // If part of a playlist and "create dedicated folder" is enabled
    if (options.playlistTitle && settings.createPlaylistFolder) {
      destDir = path.join(destDir, sanitizeFilename(options.playlistTitle));
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

    const job: DownloadJob = {
      id: jobId,
      url: options.url,
      type: options.type,
      playlistId: options.playlistId,
      playlistTitle: options.playlistTitle,
      title: options.title,
      thumbnail: options.thumbnail,
      channel: options.channel,
      quality: options.quality || settings.defaultQuality || '1080p',
      format: options.format || settings.defaultFormat || 'mp4',
      destination: destDir,
      status: 'pending',
      progress: 0,
      downloadedBytes: 0,
      totalBytes: 0,
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
    job.status = 'downloading';
    this.emitProgress(job);

    const ytDlp = binaryService.getYtDlpPath();
    const ffmpeg = binaryService.getFfmpegPath();
    const settings = storageService.getSettings();

    // Output template
    const filenameTemplate = job.type === 'playlist-item'
      ? '%(playlist_index&{:02d} - |)s%(title)s.%(ext)s'
      : '%(title)s.%(ext)s';

    const outputPattern = path.join(job.destination, filenameTemplate);

    const isAudioOnly =
      ['mp3', 'm4a', 'opus'].includes(job.format) || job.quality === 'audio';

    const args: string[] = [
      job.url,
      '--newline',
      '--no-playlist',
      '--ffmpeg-location', ffmpeg,
      '-o', outputPattern,
      '--progress-template', '%(progress._percent_str)s|%(progress._downloaded_bytes_str)s|%(progress._total_bytes_str)s|%(progress._speed_str)s|%(progress._eta_str)s'
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

    const proc = spawn(ytDlp, args);
    const activeItem: ActiveProcess = { job, process: proc };
    this.activeProcesses.set(job.id, activeItem);

    proc.stdout.on('data', (data) => {
      const text = data.toString();
      const lines = text.split('\n');

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;

        // Check for output file indication
        // [download] Destination: /path/to/file or [Merger] Merging formats into "/path/to/file"
        const destMatch = trimmed.match(/\[(?:download|Merger|ExtractAudio)\] (?:Destination:|Merging formats into )"?([^"\n]+)"?/);
        if (destMatch && destMatch[1]) {
          detectedFilePath = destMatch[1].trim();
          job.filePath = detectedFilePath;
        }

        // Parse custom progress template: percent|downloaded|total|speed|eta
        const parts = trimmed.split('|');
        if (parts.length === 5) {
          const rawPercent = parts[0].replace('%', '').trim();
          const percent = parseFloat(rawPercent);
          if (!isNaN(percent)) {
            job.progress = Math.min(100, Math.max(0, Math.round(percent)));
          }

          // Parse bytes / human strings
          const downloadedStr = parts[1].trim();
          const totalStr = parts[2].trim();
          job.downloadedBytes = this.parseSize(downloadedStr);
          job.totalBytes = this.parseSize(totalStr);

          // Speed
          const speedStr = parts[3].trim();
          job.speed = this.parseSize(speedStr);

          // ETA
          const etaStr = parts[4].trim();
          job.remainingSeconds = this.parseEta(etaStr);

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

      if (code === 0) {
        job.status = 'completed';
        job.progress = 100;
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
      active.process.kill('SIGTERM');
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
      active.process.kill('SIGKILL');
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
