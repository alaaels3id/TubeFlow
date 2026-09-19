export type ThemeMode = 'system' | 'light' | 'dark';
export type FontSize = 'small' | 'medium' | 'large' | 'xlarge';
export type Language = 'en' | 'ar';
export type DuplicateAction = 'replace' | 'copy' | 'skip';

export type DownloadStatus =
  | 'pending'
  | 'analyzing'
  | 'downloading'
  | 'processing'
  | 'completed'
  | 'paused'
  | 'cancelled'
  | 'failed';

export interface FormatOption {
  formatId: string;
  resolution: string; // e.g., '2160p', '1440p', '1080p', '720p', '480p', '360p', 'audio'
  extension: 'mp4' | 'webm' | 'mp3' | 'm4a' | 'opus';
  hasVideo: boolean;
  hasAudio: boolean;
  filesizeApprox?: number; // in bytes
  fps?: number;
  note?: string;
}

export interface VideoMetadata {
  id: string;
  url: string;
  title: string;
  thumbnail: string;
  channel: string;
  channelUrl?: string;
  duration: number; // in seconds
  durationString: string;
  viewCount?: number;
  uploadDate?: string;
  formats: FormatOption[];
  availableResolutions: string[]; // sorted desc: ['2160p', '1440p', '1080p', '720p', '480p', '360p', 'audio']
}

export interface PlaylistItem {
  id: string;
  url: string;
  title: string;
  thumbnail: string;
  channel: string;
  duration: number;
  durationString: string;
  index: number;
  selected?: boolean;
  isDownloaded?: boolean;
}

export interface PlaylistMetadata {
  id: string;
  url: string;
  title: string;
  thumbnail: string;
  channel: string;
  itemCount: number;
  items: PlaylistItem[];
}

export interface DownloadJob {
  id: string;
  url: string;
  type: 'video' | 'playlist-item';
  playlistId?: string;
  playlistTitle?: string;
  title: string;
  thumbnail: string;
  channel?: string;
  duration?: number;
  quality: string; // e.g. '1080p' or 'best' or 'audio'
  format: 'mp4' | 'webm' | 'mp3' | 'm4a' | 'opus';
  destination: string;
  filePath?: string;
  status: DownloadStatus;
  progress: number; // 0 to 100
  downloadedBytes: number;
  totalBytes: number;
  speed: number; // bytes per sec
  remainingSeconds: number; // ETA in seconds
  errorMessage?: string;
  createdAt: string;
  completedAt?: string;
}

export interface HistoryItem {
  id: string;
  url: string;
  type: 'video' | 'playlist';
  title: string;
  thumbnail: string;
  channel?: string;
  quality: string;
  format: string;
  fileSize?: number;
  filePath?: string;
  status: 'completed' | 'failed' | 'cancelled';
  errorMessage?: string;
  downloadDate: string;
  playlistTitle?: string;
}

export interface AppSettings {
  theme: ThemeMode;
  language: Language;
  fontSize: FontSize;
  downloadDirectory: string;
  defaultQuality: string;
  defaultFormat: 'mp4' | 'webm' | 'mp3' | 'm4a' | 'opus';
  concurrentDownloads: number;
  notifications: boolean;
  confirmBeforeDelete: boolean;
  duplicateAction: DuplicateAction;
  createPlaylistFolder: boolean;
}

export interface SystemDependencies {
  ytDlp: {
    available: boolean;
    path: string;
    version?: string;
  };
  ffmpeg: {
    available: boolean;
    path: string;
    version?: string;
  };
}

export interface AnalyzeResult {
  type: 'video' | 'playlist';
  video?: VideoMetadata;
  playlist?: PlaylistMetadata;
}

export type UpdateState =
  | 'idle'
  | 'checking'
  | 'available'
  | 'not-available'
  | 'downloading'
  | 'downloaded'
  | 'error';

export interface UpdateInfo {
  version: string;
  releaseDate?: string;
  releaseNotes?: string;
  releaseName?: string;
}

export interface UpdateProgress {
  percent: number;
  bytesPerSecond: number;
  transferred: number;
  total: number;
}

export interface UpdateStatus {
  state: UpdateState;
  currentVersion: string;
  updateInfo?: UpdateInfo | null;
  progress?: UpdateProgress | null;
  error?: string | null;
}
