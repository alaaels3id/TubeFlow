import { app } from 'electron';
import electronUpdater from 'electron-updater';
const { autoUpdater } = electronUpdater;
import https from 'node:https';
import { UpdateInfo, UpdateProgress, UpdateStatus } from '../../shared/types';
import { loggerService } from './loggerService';

export class UpdaterService {
  private status: UpdateStatus = {
    state: 'idle',
    currentVersion: app.getVersion(),
    updateInfo: null,
    progress: null,
    error: null
  };

  private onStatusChangeCallbacks: Array<(status: UpdateStatus) => void> = [];

  constructor() {
    this.initAutoUpdater();
  }

  private initAutoUpdater(): void {
    // Configure electron-updater
    autoUpdater.autoDownload = false;
    autoUpdater.autoInstallOnAppQuit = true;

    // Attach logger
    autoUpdater.logger = {
      info: (message: any) => loggerService.info(`[UPDATER] ${message}`),
      warn: (message: any) => loggerService.warn(`[UPDATER] ${message}`),
      error: (message: any) => loggerService.error(`[UPDATER] ${message}`),
      debug: (_message: any) => {}
    };

    autoUpdater.on('checking-for-update', () => {
      this.updateState('checking');
    });

    autoUpdater.on('update-available', (info: any) => {
      const updateInfo: UpdateInfo = {
        version: info.version,
        releaseDate: info.releaseDate,
        releaseName: info.releaseName || `v${info.version}`,
        releaseNotes: typeof info.releaseNotes === 'string'
          ? info.releaseNotes
          : Array.isArray(info.releaseNotes)
          ? info.releaseNotes.map((n: any) => n.note || '').join('\n')
          : ''
      };
      this.status.updateInfo = updateInfo;
      this.status.error = null;
      this.updateState('available');
    });

    autoUpdater.on('update-not-available', () => {
      this.status.updateInfo = null;
      this.status.error = null;
      this.updateState('not-available');
    });

    autoUpdater.on('download-progress', (progressObj: any) => {
      const progress: UpdateProgress = {
        percent: Math.round(progressObj.percent || 0),
        bytesPerSecond: Math.round(progressObj.bytesPerSecond || 0),
        transferred: progressObj.transferred || 0,
        total: progressObj.total || 0
      };
      this.status.progress = progress;
      this.updateState('downloading');
    });

    autoUpdater.on('update-downloaded', (info: any) => {
      if (!this.status.updateInfo) {
        this.status.updateInfo = {
          version: info.version,
          releaseDate: info.releaseDate,
          releaseName: info.releaseName || `v${info.version}`
        };
      }
      this.status.progress = {
        percent: 100,
        bytesPerSecond: 0,
        transferred: this.status.progress?.total || 0,
        total: this.status.progress?.total || 0
      };
      this.updateState('downloaded');
    });

    autoUpdater.on('error', (err: any) => {
      const errorMsg = err?.message || String(err);
      loggerService.warn(`[UPDATER] autoUpdater error: ${errorMsg}`);
      
      // If autoUpdater failed (e.g. in dev mode or missing yaml), fallback to checking GitHub releases API
      if (!app.isPackaged || errorMsg.includes('dev-app-update.yml') || errorMsg.includes('cannot find')) {
        this.checkGitHubReleasesFallback();
        return;
      }

      this.status.error = errorMsg;
      this.updateState('error');
    });
  }

  public getStatus(): UpdateStatus {
    return { ...this.status, currentVersion: app.getVersion() };
  }

  public onStatusChange(callback: (status: UpdateStatus) => void): () => void {
    this.onStatusChangeCallbacks.push(callback);
    return () => {
      this.onStatusChangeCallbacks = this.onStatusChangeCallbacks.filter((c) => c !== callback);
    };
  }

  private updateState(state: UpdateStatus['state']): void {
    this.status.state = state;
    this.status.currentVersion = app.getVersion();
    const current = this.getStatus();
    for (const callback of this.onStatusChangeCallbacks) {
      try {
        callback(current);
      } catch (e) {
        console.error('[UPDATER] Error in status callback:', e);
      }
    }
  }

  public async checkForUpdates(): Promise<UpdateStatus> {
    this.updateState('checking');
    this.status.error = null;

    if (!app.isPackaged) {
      // In development mode, query GitHub API directly to test update checking
      await this.checkGitHubReleasesFallback();
      return this.getStatus();
    }

    try {
      await autoUpdater.checkForUpdates();
    } catch (e: any) {
      loggerService.warn(`[UPDATER] checkForUpdates exception: ${e.message}`);
      await this.checkGitHubReleasesFallback();
    }

    return this.getStatus();
  }

  public async downloadUpdate(): Promise<void> {
    if (!app.isPackaged) {
      // In dev mode, simulate progress or open browser download link
      loggerService.info('[UPDATER] downloadUpdate invoked in dev mode');
      this.simulateDevDownload();
      return;
    }

    this.updateState('downloading');
    try {
      await autoUpdater.downloadUpdate();
    } catch (e: any) {
      this.status.error = e.message || 'Failed to download update';
      this.updateState('error');
    }
  }

  public installUpdate(): void {
    loggerService.info('[UPDATER] Replacing application and restarting via quitAndInstall...');
    if (!app.isPackaged) {
      this.updateState('idle');
      return;
    }
    // isSilent = false, isForceRunAfter = true
    autoUpdater.quitAndInstall(false, true);
  }

  /**
   * Direct GitHub Releases API check fallback
   */
  private checkGitHubReleasesFallback(): Promise<void> {
    return new Promise((resolve) => {
      const options = {
        hostname: 'api.github.com',
        path: '/repos/alaaels3id/TubeFlow/releases/latest',
        method: 'GET',
        headers: {
          'User-Agent': 'TubeFlow-Desktop-App',
          Accept: 'application/vnd.github.v3+json'
        }
      };

      const req = https.request(options, (res) => {
        let body = '';
        res.on('data', (chunk) => (body += chunk));
        res.on('end', () => {
          try {
            if (res.statusCode === 200) {
              const release = JSON.parse(body);
              const latestTag = (release.tag_name || '').replace(/^v/, '').trim();
              const currentVer = app.getVersion().replace(/^v/, '').trim();

              const hasUpdate = this.compareSemver(latestTag, currentVer) > 0;

              if (hasUpdate) {
                this.status.updateInfo = {
                  version: latestTag,
                  releaseName: release.name || release.tag_name,
                  releaseDate: release.published_at,
                  releaseNotes: release.body || ''
                };
                this.status.error = null;
                this.updateState('available');
              } else {
                this.status.updateInfo = null;
                this.status.error = null;
                this.updateState('not-available');
              }
            } else if (res.statusCode === 404) {
              // No releases found yet
              this.status.updateInfo = null;
              this.status.error = null;
              this.updateState('not-available');
            } else {
              this.status.error = `GitHub API error: ${res.statusCode}`;
              this.updateState('error');
            }
          } catch (e: any) {
            this.status.error = e.message;
            this.updateState('error');
          }
          resolve();
        });
      });

      req.on('error', (err) => {
        loggerService.warn(`[UPDATER] GitHub API fallback request failed: ${err.message}`);
        this.status.error = err.message;
        this.updateState('error');
        resolve();
      });

      req.end();
    });
  }

  private simulateDevDownload(): void {
    let percent = 0;
    this.updateState('downloading');
    const interval = setInterval(() => {
      percent += 20;
      this.status.progress = {
        percent,
        bytesPerSecond: 2500000,
        transferred: percent * 1000000,
        total: 100000000
      };
      this.updateState('downloading');

      if (percent >= 100) {
        clearInterval(interval);
        this.updateState('downloaded');
      }
    }, 400);
  }

  private compareSemver(v1: string, v2: string): number {
    const parts1 = v1.split('.').map((p) => parseInt(p, 10) || 0);
    const parts2 = v2.split('.').map((p) => parseInt(p, 10) || 0);
    for (let i = 0; i < Math.max(parts1.length, parts2.length); i++) {
      const p1 = parts1[i] || 0;
      const p2 = parts2[i] || 0;
      if (p1 > p2) return 1;
      if (p1 < p2) return -1;
    }
    return 0;
  }
}

export const updaterService = new UpdaterService();
