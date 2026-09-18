# Electron Native System Notifications on macOS

This rule documents the exact, production-ready pattern for implementing desktop notifications in Electron (supporting macOS Sequoia / Sonoma, Windows, and Linux).

---

## 1. Core Problem & macOS Requirements

1. **Unpackaged Dev Mode (`npm run dev`)**:
   - Modern macOS (`UNUserNotificationCenter`) suppresses notification banners if `CFBundleIdentifier` is `com.github.Electron` and authorization is denied or unregistered.
   - For dev mode to show notifications with the application's real identity and logo, the dev bundle in `node_modules/electron/dist/Electron.app/Contents/Info.plist` must have its `CFBundleIdentifier` updated to the app's bundle ID (e.g., `com.tubeflow.desktop`), `CFBundleDisplayName` set to the app name, and re-signed via `codesign --force --deep -s -`.

2. **Left Icon vs. Right Icon on macOS**:
   - **Left side icon**: macOS displays the application's bundle icon (`CFBundleIconFile` / `icon.icns`) automatically.
   - **Right side icon**: If you pass `icon: pathOrNativeImage` to `new Notification({ ... })` on macOS, macOS treats this as an attached content preview thumbnail and renders it on the **right side**.
   - **Rule**: On macOS (`process.platform === 'darwin'`), always pass `icon: undefined` to `new Notification()` so only the crisp app logo appears on the left without any unwanted duplicate image on the right.
   - On Windows/Linux, pass `icon: nativeImage` or path so the OS toast displays the app logo.

3. **No AppleScript / `osascript` in Production**:
   - Do not use `osascript` fallback once native notifications are configured, because macOS attributes `osascript` to "Script Editor" and displays the paper scroll icon.

---

## 2. Standard Implementation (`src/main/notifications.ts`)

```typescript
import { Notification, nativeImage } from 'electron';
import path from 'node:path';
import fs from 'node:fs';

const activeNotifications = new Set<Notification>();

export function getAppIconPath(customIcon?: string): string {
  if (customIcon && fs.existsSync(customIcon)) return customIcon;

  const candidates = [
    path.join(process.cwd(), 'build/icon.png'),
    path.join(process.cwd(), 'public/icon.png'),
    path.join(process.cwd(), 'assets/icon.png')
  ];

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) return candidate;
  }
  return path.join(process.cwd(), 'public/icon.png');
}

export function showNotification(
  title: string,
  body: string,
  customIcon?: string,
  force: boolean = false
): void {
  if (!Notification.isSupported()) {
    console.warn('[NOTIF] Notification.isSupported() returned false');
    return;
  }

  try {
    const isMac = process.platform === 'darwin';
    const iconPath = getAppIconPath(customIcon);
    const icon = fs.existsSync(iconPath) ? nativeImage.createFromPath(iconPath) : undefined;

    const notification = new Notification({
      title: title || 'App Name',
      body: body || '',
      // On macOS omit icon so macOS only shows the app bundle icon on the left
      icon: isMac ? undefined : (icon && !icon.isEmpty() ? icon : undefined),
      silent: false
    });

    activeNotifications.add(notification);

    notification.on('close', () => {
      activeNotifications.delete(notification);
    });

    notification.on('failed', (_event, error) => {
      console.error('[NOTIF] Notification failed:', error);
      activeNotifications.delete(notification);
    });

    notification.show();
  } catch (e) {
    console.error('[NOTIF] Notification initialization failed:', e);
  }
}
```

---

## 3. Dev Mode Automation Script (npm postinstall / setup)

To automate branding `node_modules/electron/dist/Electron.app` for dev mode in any project, add a setup script:

```bash
# Update Info.plist & App Icon
plutil -replace CFBundleIdentifier -string "com.yourdomain.app" node_modules/electron/dist/Electron.app/Contents/Info.plist
plutil -replace CFBundleDisplayName -string "YourApp" node_modules/electron/dist/Electron.app/Contents/Info.plist
plutil -replace CFBundleName -string "YourApp" node_modules/electron/dist/Electron.app/Contents/Info.plist
cp build/icon.icns node_modules/electron/dist/Electron.app/Contents/Resources/electron.icns
codesign --force --deep -s - node_modules/electron/dist/Electron.app
```
