# Changelog

All notable changes to **TubeFlow** will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [1.0.0] - 2026-09-18

### 🚀 Initial Release

Welcome to the first official release of **TubeFlow** — a modern, fast, and feature-rich YouTube Video & Playlist Downloader desktop application built with Electron, React, TypeScript, and Vite.

---

### ✨ Features & Highlights

#### 🎥 Video & Audio Downloading
- **Powered by `yt-dlp` & `ffmpeg`**: High-speed, multi-threaded downloading with automatic format merging (MP4, MKV, WebM, MP3, M4A, WAV, FLAC).
- **Quality & Format Selection**: Full resolution choices up to 4K/8K, 60fps video, and high-bitrate audio extraction (up to 320 kbps).
- **Batch & Playlist Support**: Automatically analyze and download complete YouTube playlists or selected videos with individual progress tracking.
- **Queue Management**: Pause, resume, retry, cancel, and clear downloads with configurable concurrency limits (1 to 5 concurrent jobs).

#### 🎨 Modern User Interface
- **Premium Aesthetics**: Night Bordeaux dark mode, crisp light mode, and system default themes with glassmorphism touches.
- **Full Bilingual Support (i18n)**: Seamless Arabic (RTL) and English (LTR) with native typography and smooth layout switching.
- **macOS Native TitleBar**: Clean hidden-inset titlebar with carefully balanced traffic-light alignment in both LTR and RTL directions.
- **Responsive Dashboard & History**: Live download speeds, time estimates, percentage progress bars, and searchable download history with one-click Finder / File Explorer reveal.

#### 🔔 Native System Notifications
- **Operating System Integration**: Native macOS (`UNUserNotificationCenter`), Windows (Toast Notifications), and Linux desktop notification banners.
- **Custom Branding**: Notifications feature the official TubeFlow logo and system alert sound upon download completion or failure.
- **In-App Control**: Dedicated toggle and test notification button in the Settings page.

#### 🛠️ Robust System & Logging Architecture
- **Automatic Dependency Detection**: Detects, validates, and reports installed `yt-dlp` and `ffmpeg` binary versions.
- **Persistent Rotating Logger**: Automatically records system lifecycle, console output, and unhandled exceptions to `app.log` (5MB rotating limit).
- **Settings & Preferences**: Configurable download directory, duplicate file handling, theme, font size, and language.

---

### 📦 Distribution Packages
- **macOS**: `TubeFlow-1.0.0-arm64.dmg` & `TubeFlow-1.0.0-arm64-mac.zip` (Code-signed for Apple Silicon).
