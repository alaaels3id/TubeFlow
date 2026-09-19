# Changelog

All notable changes to **TubeFlow** will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [1.2.0] - 2026-09-19

### ✨ Features & Improvements

#### 📁 Dedicated Playlist Folders & Intelligent Naming
- **Dedicated Playlist Folders**: Every playlist is now automatically saved into its own dedicated separated folder inside the Downloads directory (`Downloads/<Playlist Name>/`).
- **Intelligent Show & Series Detection**: Replaces generic fallback names (such as `"show"` or `"playlist"`) with actual series and show titles (e.g. `مسلسل عمر`) extracted from metadata, series tags, and episode title patterns.
- **Editable Playlist & Folder Name**: Added an inline edit control on the playlist overview card, allowing users to customize the playlist title and folder name directly before downloading.
- **Folder Path Preview**: Displays the exact target subfolder name next to the folder toggle option.

#### 🎯 Smart Exclusion of Already Downloaded Videos
- **Automatic Exclusion**: Videos in a playlist that have already been downloaded in history are automatically filtered out, displaying only remaining un-downloaded videos ready for download.
- **Toggle Visibility**: Added a toggle button (`Hide Downloaded` / `Show All`) with status indicators and green `Downloaded` (`تم التحميل`) badges.
- **Selection Synchronization**: "Select All" and "Download Selected" actions operate strictly on remaining un-downloaded items to prevent accidental duplicate downloads.

#### 🔀 Playlist & Queue Sorting
- **ASC / DESC / Original Sorting**: Users can sort playlist items in ascending numerical order (`1 → N`), descending (`N → 1`), or restore the original order.
- **Queue Sorting Controls**: Added queue sorting toggle to sort downloads alphabetically or by episode index.

#### 🧹 Cleaner Playlist Extraction & Queue Safeguards
- **Private & Deleted Video Skipping**: Automatically ignores deleted and private videos during playlist parsing.
- **Duplicate Prevention**: Filters out identical video entries within playlists and blocks duplicate pending/downloading jobs in the queue.

#### 🐛 Bug Fixes
- **Dashboard Layout Clipping**: Resolved a flexbox shrinking issue in `.main-content` that caused the URL analyzer card to collapse and clip its title and inputs when analyzing large playlists.

---

## [1.1.0] - 2026-09-18

### ✨ Features & Improvements

#### 🔔 Enhanced Download Notifications
- **Video Title in Notification Body**: System notifications now clearly display the exact title/name of the completed video download (`Video: <title>` / `اسم الفيديو: <العنوان>`).
- **Completion Timestamp**: Added exact localized date and time of completion to the notification body (`Downloaded at: <date>` / `تاريخ التحميل: <التاريخ>`).
- **Full Playlist Completion Notification**: Added a dedicated system notification when an entire playlist finishes downloading, detailing the playlist title, number of downloaded videos, and completion timestamp.
- **Dynamic Localization**: Automatically formats notification messages and timestamps according to user language preference (`ar` for Arabic, `en-US` for English).
- **Bilingual Failure Alerts**: Standardized download failure notifications with bilingual error titles and status icons (`فشل التحميل ❌` / `Download Failed ❌`).

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
