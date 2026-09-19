# Changelog

All notable changes to **TubeFlow** will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [1.3.0] - 2026-09-19

### ✨ Features & Improvements

#### 📊 Monotonic & Seamless Progress Bar
- **Multi-Stream Dual Phasing**: Separates video and audio stream tracking so high-resolution downloads (`bestvideo+bestaudio`) map video from **0% to 85%** and audio from **85% to 98%**, completely eliminating the abrupt progress bar reset from 100% back to 0%.
- **Cumulative Byte Tracking**: Combines downloaded and total bytes across both video and audio streams so displayed sizes continuously increase.
- **Monotonic Guards**: Applied strict non-decreasing safeguards on both backend and client state, guaranteeing the progress bar only moves forward.
- **Fluid Animation**: Upgraded progress fill transition with `ease-out` timing for responsive, natural forward motion.

#### ⏱️ Stabilized Monotonic Countdown Remaining Time (ETA)
- **Decaying Countdown Filter**: Replaced instantaneous burst spikes with a steady decaying countdown that decrements second-by-second towards completion (`00:00`).
- **Speed Smoothing (EMA)**: Utilizes Exponential Moving Average for speed calculation across the entire job to filter out packet stalls and burst variations.
- **Spike Dampening**: Network jitter and momentary latency no longer trigger wild swings between seconds and minutes.

#### ⚙️ Media Processing State Feedback
- **Processing Status & Spinner**: Surfaced `processing` status with a spinning activity indicator and localized badges (`معالجة الوسائط` / `Processing Media`) while `ffmpeg` is merging or converting streams.

#### 🛠️ Robust Binary & Engine Detection
- **macOS Gatekeeper Accommodation**: Increased verification timeout to 20 seconds to prevent false-negative "Not Detected" states caused by macOS Gatekeeper security verification on cold start.
- **Automated Executable Permissions**: Automatically ensures `chmod 0755` permissions on bundled binaries with fallback candidate searching.

---

## [1.2.0] - 2026-09-19

### ✨ Features & Improvements

#### 🔄 In-App Auto-Updater & Version Management
- **Automated Update Engine**: Integrated `electron-updater` configured with GitHub Releases (`alaaels3id/TubeFlow`), supporting checking, downloading, and replacing the old version with the new version seamlessly via `quitAndInstall()`.
- **Dedicated Updates Section in Settings**: Added an "Application Updates" management card in Settings featuring:
  - Dynamic version display and interactive "Check for Updates" button with animated status.
  - Release notes preview and new version details when an update is detected.
  - Live download progress bar showing percentage, bytes transferred, and transfer speed.
  - One-click "Restart & Install Update" button to apply updates and restart instantly.
- **Dynamic Versioning & Badges**: Replaced static version labels across the entire app with live versioning from Electron (`app.getVersion()`), adding an update indicator badge (`NEW`) in the Sidebar when an update is available.
- **Background Checks & Fallback**: Performs an unobtrusive background update check shortly after launch, with a direct GitHub Releases API fallback for release notes and testing.
- **Full Bilingual Localization**: Complete Arabic and English translations for all updater states, progress bars, and action buttons.

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
