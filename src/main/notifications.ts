import { Notification, nativeImage } from 'electron';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs';
import { spawn } from 'node:child_process';
import { storageService } from './services/storageService';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const activeNotifications = new Set<Notification>();

export function getAppIconPath(customIcon?: string): string {
  if (customIcon) {
    const candidates = [
      customIcon,
      path.join(process.cwd(), customIcon),
      path.join(__dirname, '../../', customIcon)
    ];
    for (const c of candidates) {
      if (fs.existsSync(c)) return c;
    }
  }

  const candidates = [
    path.join(__dirname, '../../build/icon.png'),
    path.join(__dirname, '../../public/icon.png'),
    path.join(__dirname, '../../dist/icon.png'),
    path.join(process.cwd(), 'public/icon.png'),
    path.join(process.cwd(), 'assets/icon.png')
  ];

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }
  return path.join(process.cwd(), 'public/icon.png');
}

export function showNotification(title: string, body: string, customIcon?: string, force: boolean = false): void {
  const settings = storageService.getSettings();
  console.log('[NOTIF] showNotification called. settings.notifications =', settings.notifications, 'force =', force);
  if (!settings.notifications && !force) {
    console.warn('[NOTIF] Notifications are disabled in settings, skipping.');
    return;
  }

  // Electron Native Notification
  if (Notification.isSupported()) {
    try {
      const iconPath = getAppIconPath(customIcon);
      const icon = fs.existsSync(iconPath) ? nativeImage.createFromPath(iconPath) : undefined;

      // On macOS, the app logo is displayed on the left automatically from the bundle.
      // Passing an icon option on macOS displays a secondary image attached on the right side.
      // So on macOS we omit icon to avoid the duplicate image on the right.
      const isMac = process.platform === 'darwin';

      const notification = new Notification({
        title: title || 'TubeFlow',
        body: body || '',
        icon: isMac ? undefined : (icon && !icon.isEmpty() ? icon : undefined),
        silent: false
      });

      activeNotifications.add(notification);

      notification.on('show', () => {
        console.log('[NOTIF] Electron native notification show event received');
      });

      notification.on('close', () => {
        activeNotifications.delete(notification);
      });

      notification.on('failed', (_event, error) => {
        console.error('[NOTIF] Electron native notification failed:', error);
        activeNotifications.delete(notification);
      });

      notification.show();
      console.log('[NOTIF] Electron native notification.show() executed successfully');
    } catch (e) {
      console.error('[NOTIF] Notification initialization failed:', e);
    }
  }
}



