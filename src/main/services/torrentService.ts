import { app } from 'electron';
import path from 'node:path';
import fs from 'node:fs';
import WebTorrent from 'webtorrent';
import { TorrentJob, TorrentFileItem } from '../../shared/types';
import { storageService } from './storageService';
import { loggerService } from './loggerService';
import { showNotification } from '../notifications';

export class TorrentService {
  private client: WebTorrent.Instance | null = null;
  private jobs: Map<string, TorrentJob> = new Map();
  private onUpdateCallback: ((jobs: TorrentJob[]) => void) | null = null;
  private saveFile: string;
  private throttleTimer: NodeJS.Timeout | null = null;

  constructor() {
    const userData = app.getPath('userData');
    this.saveFile = path.join(userData, 'torrent_jobs.json');
    this.initClient();
    this.loadSavedJobs();
  }

  private initClient(): void {
    try {
      this.client = new WebTorrent({
        // Default torrent client options
        maxConns: 55,
        dht: true
      });

      this.client.on('error', (err: any) => {
        loggerService.error('TORRENT_CLIENT', `Global client error: ${err?.message || err}`);
      });
    } catch (e: any) {
      loggerService.error('TORRENT_CLIENT', `Failed to initialize WebTorrent: ${e?.message || e}`);
    }
  }

  public setOnUpdate(cb: (jobs: TorrentJob[]) => void): void {
    this.onUpdateCallback = cb;
  }

  private notifyUpdate(): void {
    if (this.throttleTimer) return;
    this.throttleTimer = setTimeout(() => {
      this.throttleTimer = null;
      if (this.onUpdateCallback) {
        this.onUpdateCallback(this.getAllJobs());
      }
    }, 500);
  }

  private saveJobs(): void {
    try {
      const data = Array.from(this.jobs.values()).map((job) => ({
        id: job.id,
        infoHash: job.infoHash,
        name: job.name,
        magnet: job.magnet,
        destination: job.destination,
        status: job.status === 'downloading' ? 'paused' : job.status,
        progress: job.progress,
        downloadedBytes: job.downloadedBytes,
        totalBytes: job.totalBytes,
        createdAt: job.createdAt,
        completedAt: job.completedAt
      }));
      fs.writeFileSync(this.saveFile, JSON.stringify(data, null, 2), 'utf-8');
    } catch (e) {
      loggerService.error('TORRENT_SERVICE', `Failed to save torrent jobs: ${e}`);
    }
  }

  private loadSavedJobs(): void {
    try {
      if (fs.existsSync(this.saveFile)) {
        const data = JSON.parse(fs.readFileSync(this.saveFile, 'utf-8'));
        if (Array.isArray(data)) {
          for (const item of data) {
            const job: TorrentJob = {
              id: item.id || `tor-${Date.now()}-${Math.random()}`,
              infoHash: item.infoHash || '',
              name: item.name || 'Torrent Download',
              magnet: item.magnet,
              destination: item.destination || app.getPath('downloads'),
              status: item.status || 'paused',
              progress: item.progress || 0,
              downloadedBytes: item.downloadedBytes || 0,
              totalBytes: item.totalBytes || 0,
              downloadSpeed: 0,
              uploadSpeed: 0,
              numPeers: 0,
              eta: 0,
              files: [],
              createdAt: item.createdAt || new Date().toISOString(),
              completedAt: item.completedAt
            };
            this.jobs.set(job.id, job);
          }
        }
      }
    } catch (e) {
      loggerService.error('TORRENT_SERVICE', `Failed to load saved torrent jobs: ${e}`);
    }
  }

  public getAllJobs(): TorrentJob[] {
    return Array.from(this.jobs.values()).sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }

  public async addTorrent(options: {
    magnet: string;
    name?: string;
    destination?: string;
  }): Promise<string> {
    if (!this.client) {
      this.initClient();
    }

    if (!this.client) {
      throw new Error('WebTorrent client is not available');
    }

    const { magnet, name } = options;
    const settings = storageService.getSettings();
    const downloadDir = options.destination || settings.downloadDirectory || app.getPath('downloads');

    // Ensure target download directory exists
    if (!fs.existsSync(downloadDir)) {
      try {
        fs.mkdirSync(downloadDir, { recursive: true });
      } catch (err: any) {
        loggerService.error('TORRENT_SERVICE', `Failed to create download dir ${downloadDir}: ${err}`);
      }
    }

    // Check if torrent already exists in our jobs
    for (const [id, existing] of this.jobs.entries()) {
      if (existing.magnet === magnet) {
        if (existing.status === 'paused') {
          await this.resumeTorrent(id);
        }
        return id;
      }
    }

    const jobId = `tor-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    const job: TorrentJob = {
      id: jobId,
      infoHash: '',
      name: name || 'Torrent Download',
      magnet,
      destination: downloadDir,
      status: 'downloading',
      progress: 0,
      downloadedBytes: 0,
      totalBytes: 0,
      downloadSpeed: 0,
      uploadSpeed: 0,
      numPeers: 0,
      eta: 0,
      files: [],
      createdAt: new Date().toISOString()
    };

    this.jobs.set(jobId, job);
    this.notifyUpdate();

    try {
      this.client.add(magnet, { path: downloadDir }, (torrent: WebTorrent.Torrent) => {
        job.infoHash = torrent.infoHash;
        if (torrent.name && !name) {
          job.name = torrent.name;
        }
        job.totalBytes = torrent.length || 0;
        job.files = torrent.files.map((f: WebTorrent.TorrentFile) => ({
          name: f.name,
          path: f.path,
          length: f.length,
          downloaded: f.downloaded,
          progress: f.progress * 100
        }));

        this.notifyUpdate();
        this.saveJobs();

        torrent.on('download', () => {
          job.progress = Math.round(torrent.progress * 1000) / 10;
          job.downloadedBytes = torrent.downloaded;
          job.totalBytes = torrent.length;
          job.downloadSpeed = torrent.downloadSpeed;
          job.uploadSpeed = torrent.uploadSpeed;
          job.numPeers = torrent.numPeers;
          job.eta = torrent.timeRemaining ? Math.round(torrent.timeRemaining / 1000) : 0;

          // Update file item progress
          if (torrent.files && torrent.files.length) {
            job.files = torrent.files.map((f: WebTorrent.TorrentFile) => ({
              name: f.name,
              path: f.path,
              length: f.length,
              downloaded: f.downloaded,
              progress: Math.round(f.progress * 1000) / 10
            }));
          }

          this.notifyUpdate();
        });

        torrent.on('upload', () => {
          job.uploadSpeed = torrent.uploadSpeed;
          this.notifyUpdate();
        });

        torrent.on('done', () => {
          job.status = 'completed';
          job.progress = 100;
          job.downloadedBytes = torrent.length;
          job.completedAt = new Date().toISOString();
          job.downloadSpeed = 0;
          job.eta = 0;

          loggerService.info('TORRENT_SERVICE', `Completed torrent: ${job.name}`);
          this.notifyUpdate();
          this.saveJobs();

          // Native desktop notification
          showNotification('Torrent Download Completed', `${job.name} has been downloaded to Downloads.`);

          // Record in download history
          storageService.addHistoryItem({
            id: job.id,
            url: job.magnet,
            type: 'video',
            title: job.name,
            thumbnail: '',
            quality: 'Torrent',
            format: 'torrent',
            fileSize: job.totalBytes,
            filePath: path.join(job.destination, torrent.name || ''),
            status: 'completed',
            downloadDate: new Date().toISOString()
          });
        });

        torrent.on('error', (err: any) => {
          job.status = 'error';
          job.errorMessage = err?.message || 'Download error occurred';
          loggerService.error('TORRENT_SERVICE', `Torrent error on ${job.name}: ${job.errorMessage}`);
          this.notifyUpdate();
          this.saveJobs();
        });
      });
    } catch (e: any) {
      job.status = 'error';
      job.errorMessage = e?.message || 'Failed to start torrent';
      this.notifyUpdate();
      this.saveJobs();
    }

    return jobId;
  }

  public async pauseTorrent(id: string): Promise<boolean> {
    const job = this.jobs.get(id);
    if (!job) return false;

    if (this.client) {
      const torrent = this.client.torrents.find(
        (t) => t.infoHash === job.infoHash || t.magnetURI === job.magnet
      );
      if (torrent) {
        torrent.pause();
      }
    }

    job.status = 'paused';
    job.downloadSpeed = 0;
    job.uploadSpeed = 0;
    this.notifyUpdate();
    this.saveJobs();
    return true;
  }

  public async resumeTorrent(id: string): Promise<boolean> {
    const job = this.jobs.get(id);
    if (!job) return false;

    if (this.client) {
      const torrent = this.client.torrents.find(
        (t) => t.infoHash === job.infoHash || t.magnetURI === job.magnet
      );
      if (torrent) {
        torrent.resume();
        job.status = 'downloading';
        this.notifyUpdate();
        this.saveJobs();
        return true;
      }
    }

    // If client wasn't seeding/downloading, re-add it
    job.status = 'downloading';
    this.notifyUpdate();
    try {
      await this.addTorrent({
        magnet: job.magnet,
        name: job.name,
        destination: job.destination
      });
      return true;
    } catch {
      return false;
    }
  }

  public async removeTorrent(id: string, deleteFiles: boolean = false): Promise<boolean> {
    const job = this.jobs.get(id);
    if (!job) return false;

    if (this.client) {
      const torrent = this.client.torrents.find(
        (t) => t.infoHash === job.infoHash || t.magnetURI === job.magnet
      );
      if (torrent) {
        try {
          torrent.destroy({ destroyStore: deleteFiles });
        } catch (e) {
          loggerService.error('TORRENT_SERVICE', `Error destroying torrent: ${e}`);
        }
      }
    }

    this.jobs.delete(id);
    this.notifyUpdate();
    this.saveJobs();
    return true;
  }

  public destroy(): void {
    if (this.client) {
      try {
        this.client.destroy();
        this.client = null;
      } catch {}
    }
  }
}

export const torrentService = new TorrentService();
