import http from 'node:http';
import { BrowserWindow, app } from 'electron';
import { downloadService } from './downloadService';
import { torrentService } from './torrentService';
import { showNotification } from '../notifications';
import { loggerService } from './loggerService';

export const BRIDGE_PORT = 54321;

export class BridgeService {
  private server: http.Server | null = null;
  private mainWindow: BrowserWindow | null = null;

  public start(mainWindow: BrowserWindow): void {
    this.mainWindow = mainWindow;

    if (this.server) {
      return;
    }

    this.server = http.createServer((req, res) => {
      // Set CORS headers for Chrome Extension
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

      if (req.method === 'OPTIONS') {
        res.writeHead(204);
        res.end();
        return;
      }

      const url = new URL(req.url || '/', `http://${req.headers.host || '127.0.0.1'}`);

      if (req.method === 'GET' && (url.pathname === '/health' || url.pathname === '/status')) {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(
          JSON.stringify({
            status: 'ok',
            app: 'TubeFlow',
            version: app.getVersion(),
            port: BRIDGE_PORT
          })
        );
        return;
      }

      if (req.method === 'POST' && url.pathname === '/open') {
        this.focusMainWindow();
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, message: 'App brought to focus' }));
        return;
      }

      if (req.method === 'POST' && url.pathname === '/download') {
        let body = '';
        req.on('data', (chunk) => {
          body += chunk.toString();
        });

        req.on('end', async () => {
          try {
            const data = JSON.parse(body || '{}');
            const downloadUrl = (data.url || '').trim();

            if (!downloadUrl) {
              res.writeHead(400, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ success: false, error: 'URL is required' }));
              return;
            }

            loggerService.info('Bridge', `Received download request: ${downloadUrl}`);

            // Handle magnet or torrent URL
            if (downloadUrl.startsWith('magnet:') || downloadUrl.endsWith('.torrent')) {
              await torrentService.addTorrent({
                magnet: downloadUrl,
                destination: ''
              });
              showNotification('Torrent Added', `Added to TubeFlow torrents`, undefined, true);
              this.focusMainWindow();
              res.writeHead(200, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ success: true, type: 'torrent', message: 'Torrent added' }));
              return;
            }

            // Extract file name or title
            let title = data.filename || data.title;
            if (!title) {
              try {
                const parsedUrl = new URL(downloadUrl);
                const pathname = parsedUrl.pathname;
                title = decodeURIComponent(pathname.substring(pathname.lastIndexOf('/') + 1)) || 'Download';
              } catch {
                title = 'Download';
              }
            }

            // Enqueue download via downloadService
            const jobId = await downloadService.startDownload({
              url: downloadUrl,
              type: 'video', // will detect whether direct file or yt-dlp media
              title,
              thumbnail: data.thumbnail || '',
              quality: data.quality || '1080p',
              format: data.format || 'mp4'
            });

            showNotification('Download Started', `TubeFlow started downloading: ${title}`, undefined, true);
            this.focusMainWindow();

            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(
              JSON.stringify({
                success: true,
                jobId,
                title,
                message: 'Download queued successfully'
              })
            );
          } catch (err: any) {
            loggerService.error('Bridge', `Failed to process download: ${err?.message || err}`);
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: false, error: err?.message || 'Internal server error' }));
          }
        });
        return;
      }

      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Not found' }));
    });

    this.server.listen(BRIDGE_PORT, '127.0.0.1', () => {
      loggerService.info('Bridge', `TubeFlow local bridge listening on http://127.0.0.1:${BRIDGE_PORT}`);
    });

    this.server.on('error', (err: any) => {
      loggerService.error('Bridge', `Bridge server error: ${err?.message || err}`);
    });
  }

  public focusMainWindow(): void {
    if (this.mainWindow && !this.mainWindow.isDestroyed()) {
      if (this.mainWindow.isMinimized()) {
        this.mainWindow.restore();
      }
      this.mainWindow.show();
      this.mainWindow.focus();
    }
  }

  public stop(): void {
    if (this.server) {
      this.server.close();
      this.server = null;
    }
  }
}

export const bridgeService = new BridgeService();
