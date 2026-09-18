# TubeFlow 🌊

A modern, high-performance desktop application for downloading YouTube videos and playlists (for content you are authorized to download), built with **Electron**, **React**, **TypeScript**, and **Vite**.

Designed specifically with a macOS-native desktop aesthetic using the **Night Bordeaux** brand palette, smooth traffic-light window chrome, rich dark/light themes, full Arabic RTL internationalization, and adjustable font scaling.

---

## ✨ Features

- **Single Video Downloads**: Analyze any YouTube URL and select from 4K (2160p), 2K (1440p), 1080p, 720p, 480p, 360p, or Audio Only.
- **Playlist Downloads**: Full playlist analyzer with video multi-select (Select All / Deselect All), dedicated playlist folder creation, and batch queueing.
- **Format Conversion**: Mux high-resolution video streams with audio into MP4/WebM, or extract audio tracks as MP3, M4A, or Opus.
- **Multi-Worker Download Queue**: Configurable concurrency (1–5 simultaneous downloads), real-time progress percentages, download speed (MB/s), and estimated time remaining (ETA).
- **Controls & Actions**: Pause, Resume, Cancel, Retry, Open File, Reveal in Finder (`shell.showItemInFolder`).
- **Persistent History & Search**: Local JSON storage of previous downloads with instant search by title or channel, and status filtering (Completed, Failed, Cancelled).
- **macOS Experience**:
  - Hidden inset title bar with traffic lights integration.
  - Keyboard shortcuts: `⌘ + L` (Focus URL), `⌘ + V` (Paste), `⌘ + ,` (Settings), `Esc` (Dismiss modals).
  - Native system notifications for completion and failures.
- **Appearance & Accessibility**:
  - **Dark Theme** (Night Bordeaux palette) & **Light Theme**.
  - **Dynamic Font Scaling**: Small (88%), Medium (100%), Large (112%), Extra Large (125%).
  - **Bi-directional RTL Support**: Instant switch between English and Arabic with mirrored navigation and Arabic typography.

---

## 🎨 Design System & Palette

| Token | Name | Color Hex |
|---|---|---|
| `primary-900` | Night Bordeaux | `#461220` |
| `primary-700` | Burnt Rose | `#8C2F39` |
| `primary-500` | Dusty Mauve | `#B23A48` |
| `primary-200` | Powder Blush | `#FCB9B2` |
| `accent-500` | Cerulean | `#247BA0` |

---

## 🚀 Getting Started

### Prerequisites

- **Node.js**: v20+
- **yt-dlp**: Bundled in `bin/yt-dlp` or detected from Homebrew/system PATH.
- **FFmpeg**: Detected at `/opt/homebrew/bin/ffmpeg` or system PATH for audio muxing.

### Development

```bash
# Install dependencies
npm install

# Start development server with Electron hot reload
npm run dev
```

### Production Build

```bash
npm run build
```

---

## ⚖️ Legal / Compliance Requirement

This software does not implement mechanisms intended to bypass DRM, access-control systems, private content, or technical protections. Use this application only for content you have the right or permission to download in accordance with applicable laws and YouTube's terms of service.
