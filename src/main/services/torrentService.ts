import { app } from 'electron';
import path from 'node:path';
import fs from 'node:fs';
import WebTorrent, { Torrent, TorrentFile } from 'webtorrent';
import { TorrentJob, TorrentFileItem } from '../../shared/types';
import { storageService } from './storageService';
import { loggerService } from './loggerService';
import { showNotification } from '../notifications';
import { DEFAULT_TRACKERS, DHT_BOOTSTRAP_NODES } from './torrentConstants';

export class TorrentService {
  private client: WebTorrent | null = null;
  private jobs: Map<string, TorrentJob> = new Map();
  private onUpdateCallback: ((jobs: TorrentJob[]) => void) | null = null;
  private saveFile: string;
  private throttleTimer: NodeJS.Timeout | null = null;
  private heartbeatTimer: NodeJS.Timeout | null = null;

  constructor() {
    const userData = app.getPath('userData');
    this.saveFile = path.join(userData, 'torrent_jobs.json');
    this.initClient();
    this.loadSavedJobs();
    this.startHeartbeat();
  }

  private initClient(): void {
    try {
      this.client = new WebTorrent({
        maxConns: 300,
        utp: true,
        dht: {
          bootstrap: DHT_BOOTSTRAP_NODES
        },
        lsd: true,
        utPex: true,
        natUpnp: true,
        natPmp: true
      });

      this.client.on('error', (err: any) => {
        loggerService.error('TORRENT_CLIENT', `Global client error: ${err?.message || err}`);
      });
    } catch (e: any) {
      loggerService.error('TORRENT_CLIENT', `Failed to initialize WebTorrent: ${e?.message || e}`);
    }
  }

  private startHeartbeat(): void {
    if (this.heartbeatTimer) clearInterval(this.heartbeatTimer);
    this.heartbeatTimer = setInterval(() => {
      this.tickActiveJobs();
    }, 1000);
  }

  private tickActiveJobs(): void {
    if (!this.client || !this.client.torrents || this.jobs.size === 0) return;
    let changed = false;

    for (const job of this.jobs.values()) {
      if (job.status !== 'downloading') continue;
      const torrent = this.client.torrents.find(
        (t: any) => (job.infoHash && t.infoHash === job.infoHash) || t.magnetURI === job.magnet
      );

      if (!torrent) {
        if (job.downloadSpeed !== 0 || job.uploadSpeed !== 0) {
          job.downloadSpeed = 0;
          job.uploadSpeed = 0;
          job.eta = 0;
          changed = true;
        }
        continue;
      }

      const curSpeed = torrent.downloadSpeed || 0;
      const curUpload = torrent.uploadSpeed || 0;
      const curPeers = torrent.numPeers || 0;
      const curEta = (curSpeed > 0 && torrent.timeRemaining && isFinite(torrent.timeRemaining))
        ? Math.round(torrent.timeRemaining / 1000)
        : 0;
      const curProgress = Math.round(torrent.progress * 1000) / 10;
      const curDownloaded = torrent.downloaded || 0;
      const curTotal = torrent.length || job.totalBytes || 0;

      // When connected peers are low, periodically poke DHT lookup to keep finding new seeds
      if (curPeers < 5 && torrent.infoHash && (this.client as any).dht && Math.random() < 0.15) {
        try {
          (this.client as any).dht.lookup(torrent.infoHash);
        } catch {}
      }

      if (
        job.downloadSpeed !== curSpeed ||
        job.uploadSpeed !== curUpload ||
        job.numPeers !== curPeers ||
        job.eta !== curEta ||
        job.progress !== curProgress ||
        job.downloadedBytes !== curDownloaded ||
        job.totalBytes !== curTotal
      ) {
        job.downloadSpeed = curSpeed;
        job.uploadSpeed = curUpload;
        job.numPeers = curPeers;
        job.eta = curEta;
        job.progress = curProgress;
        job.downloadedBytes = curDownloaded;
        job.totalBytes = curTotal;
        changed = true;
      }
    }

    if (changed) {
      this.notifyUpdate();
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

  private attachTorrentListeners(torrent: Torrent, job: TorrentJob, initialName?: string): void {
    torrent.on('infoHash', () => {
      job.infoHash = torrent.infoHash;
      this.notifyUpdate();
    });

    torrent.on('wire', () => {
      job.numPeers = torrent.numPeers;
      this.notifyUpdate();
    });

    torrent.on('metadata', () => {
      job.infoHash = torrent.infoHash;
      if (torrent.name && (!initialName || initialName === 'Torrent Download')) {
        job.name = torrent.name;
      }
      job.totalBytes = torrent.length || 0;
      if (torrent.files && torrent.files.length) {
        job.files = torrent.files.map((f: TorrentFile) => ({
          name: f.name,
          path: f.path,
          length: f.length,
          downloaded: f.downloaded,
          progress: f.progress * 100
        }));
      }
      // Trigger DHT peer lookup immediately once we have confirmed infoHash
      if ((this.client as any)?.dht && torrent.infoHash) {
        try {
          (this.client as any).dht.lookup(torrent.infoHash);
        } catch {}
      }

      this.notifyUpdate();
      this.saveJobs();
    });

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
        job.files = torrent.files.map((f: TorrentFile) => ({
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

    let { magnet, name } = options;

    // If a direct .torrent file URL was provided, fetch and parse it to a magnet URI
    if (magnet.startsWith('http://') || magnet.startsWith('https://')) {
      try {
        const parseTorrentModule: any = await import('parse-torrent');
        const parseTorrent = parseTorrentModule.default || parseTorrentModule;
        const toMagnetURI = parseTorrentModule.toMagnetURI;

        const res = await fetch(magnet, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
          }
        });
        if (res.ok) {
          const buf = new Uint8Array(await res.arrayBuffer());
          const parsed = await parseTorrent(buf);
          if (toMagnetURI) {
            magnet = toMagnetURI(parsed);
          }
          if (!name && parsed.name) {
            name = parsed.name;
          }
        }
      } catch (torErr: any) {
        loggerService.warn('TORRENT_SERVICE', `Could not parse torrent URL to magnet: ${torErr?.message}`);
      }
    }

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
      const torrent = this.client.add(magnet, {
        path: downloadDir,
        announce: DEFAULT_TRACKERS,
        strategy: 'rarest',
        maxWebConns: 8
      });

      this.attachTorrentListeners(torrent, job, name);
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
        (t: any) => t.infoHash === job.infoHash || t.magnetURI === job.magnet
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

    if (!this.client) {
      this.initClient();
    }

    if (!this.client) return false;

    const existingTorrent = this.client.torrents.find(
      (t: any) => t.infoHash === job.infoHash || t.magnetURI === job.magnet
    );
    if (existingTorrent) {
      existingTorrent.resume();
      job.status = 'downloading';
      this.notifyUpdate();
      this.saveJobs();
      return true;
    }

    // If client wasn't seeding/downloading in memory, add it directly to WebTorrent client
    job.status = 'downloading';
    this.notifyUpdate();
    try {
      const torrent = this.client.add(job.magnet, {
        path: job.destination,
        announce: DEFAULT_TRACKERS,
        strategy: 'rarest',
        maxWebConns: 8
      });
      this.attachTorrentListeners(torrent, job, job.name);
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
        (t: any) => t.infoHash === job.infoHash || t.magnetURI === job.magnet
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
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
    if (this.client) {
      try {
        this.client.destroy();
        this.client = null;
      } catch {}
    }
  }
}

export const torrentService = new TorrentService();
