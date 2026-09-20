import { create } from 'zustand';
import { DownloadJob } from '@shared/types';
import { useAppStore } from './useAppStore';

interface QueueStore {
  jobs: DownloadJob[];
  activeCount: number;
  initialized: boolean;
  initListeners: () => void;
  addJob: (options: {
    url: string;
    type: 'video' | 'playlist-item';
    title: string;
    thumbnail: string;
    channel?: string;
    quality: string;
    format: 'mp4' | 'webm' | 'mp3' | 'm4a' | 'opus';
    destination?: string;
    playlistId?: string;
    playlistTitle?: string;
    playlistIndex?: number;
    filesizeApprox?: number;
    totalBytes?: number;
  }) => Promise<string | null>;
  pauseJob: (id: string) => Promise<void>;
  pauseAll: () => Promise<void>;
  resumeJob: (id: string) => Promise<void>;
  resumeAll: () => Promise<void>;
  cancelJob: (id: string) => Promise<void>;
  stopAll: () => Promise<void>;
  retryJob: (id: string) => Promise<void>;
  removeJob: (id: string) => Promise<void>;
  sortQueue: (order?: 'asc' | 'desc') => Promise<void>;
  openFile: (filePath: string) => Promise<void>;
  openFolder: (filePath: string) => Promise<void>;
}

export const useQueueStore = create<QueueStore>((set, get) => ({
  jobs: [],
  activeCount: 0,
  initialized: false,

  initListeners: () => {
    if (get().initialized || !window.api) return;

    window.api.onDownloadProgress((updatedJob: DownloadJob) => {
      set((state) => {
        const index = state.jobs.findIndex((j) => j.id === updatedJob.id);
        let newJobs: DownloadJob[];
        if (index >= 0) {
          newJobs = [...state.jobs];
          const existing = newJobs[index];
          const safeProgress = Math.max(existing.progress || 0, updatedJob.progress || 0);
          const safeDownloaded = Math.max(existing.downloadedBytes || 0, updatedJob.downloadedBytes || 0);
          newJobs[index] = {
            ...existing,
            ...updatedJob,
            progress: safeProgress,
            downloadedBytes: safeDownloaded
          };
        } else {
          newJobs = [...state.jobs, updatedJob];
        }

        const activeCount = newJobs.filter(
          (j) => j.status === 'downloading' || j.status === 'processing'
        ).length;

        return { jobs: newJobs, activeCount };
      });
    });

    window.api.onDownloadCompleted((completedJob: DownloadJob) => {
      set((state) => {
        const newJobs = state.jobs.map((j) => (j.id === completedJob.id ? completedJob : j));
        const activeCount = newJobs.filter(
          (j) => j.status === 'downloading' || j.status === 'processing'
        ).length;
        // Check if full playlist completed
        if (completedJob.type === 'playlist-item' && (completedJob.playlistId || completedJob.playlistTitle)) {
          const playlistJobs = newJobs.filter(
            (j) =>
              j.type === 'playlist-item' &&
              ((completedJob.playlistId && j.playlistId === completedJob.playlistId) ||
                (completedJob.playlistTitle && j.playlistTitle === completedJob.playlistTitle))
          );
          const hasRemaining = playlistJobs.some(
            (j) => j.status === 'pending' || j.status === 'downloading' || j.status === 'processing' || j.status === 'paused'
          );
          if (!hasRemaining && playlistJobs.length > 0 && playlistJobs.every((j) => j.status === 'completed')) {
            useAppStore
              .getState()
              .addToast(
                `Playlist "${completedJob.playlistTitle || 'Playlist'}" (${playlistJobs.length} videos) completed! 📂🎉`,
                'success'
              );
          }
        }

        return { jobs: newJobs, activeCount };
      });
      useAppStore.getState().addToast(`Finished downloading: ${completedJob.title}`, 'success');
    });

    window.api.onDownloadFailed((failedJob: DownloadJob) => {
      set((state) => {
        const newJobs = state.jobs.map((j) => (j.id === failedJob.id ? failedJob : j));
        const activeCount = newJobs.filter(
          (j) => j.status === 'downloading' || j.status === 'processing'
        ).length;
        return { jobs: newJobs, activeCount };
      });
      useAppStore
        .getState()
        .addToast(`Failed: ${failedJob.title} (${failedJob.errorMessage || 'Error'})`, 'error');
    });

    if (window.api && window.api.getQueue) {
      window.api.getQueue().then((initialJobs) => {
        if (Array.isArray(initialJobs) && initialJobs.length > 0) {
          set({
            jobs: initialJobs,
            activeCount: initialJobs.filter((j) => j.status === 'downloading' || j.status === 'processing').length
          });
        }
      }).catch(console.error);
    }

    set({ initialized: true });
  },

  addJob: async (options) => {
    try {
      if (window.api && window.api.startDownload) {
        const jobId = await window.api.startDownload(options);
        return jobId;
      }
      return null;
    } catch (e: any) {
      console.error('Failed to start download:', e);
      useAppStore.getState().addToast(e.message || 'Failed to start download', 'error');
      return null;
    }
  },

  pauseJob: async (id) => {
    try {
      if (window.api && window.api.pauseDownload) {
        await window.api.pauseDownload(id);
      }
    } catch (e) {
      console.error('Failed to pause job:', e);
    }
  },

  pauseAll: async () => {
    try {
      if (window.api && window.api.pauseAll) {
        await window.api.pauseAll();
      }
    } catch (e) {
      console.error('Failed to pause all jobs:', e);
    }
  },

  resumeJob: async (id) => {
    try {
      if (window.api && window.api.resumeDownload) {
        await window.api.resumeDownload(id);
      }
    } catch (e) {
      console.error('Failed to resume job:', e);
    }
  },

  resumeAll: async () => {
    try {
      if (window.api && window.api.resumeAll) {
        await window.api.resumeAll();
      }
    } catch (e) {
      console.error('Failed to resume all jobs:', e);
    }
  },

  cancelJob: async (id) => {
    try {
      if (window.api && window.api.cancelDownload) {
        await window.api.cancelDownload(id);
      }
    } catch (e) {
      console.error('Failed to cancel job:', e);
    }
  },

  stopAll: async () => {
    try {
      if (window.api && window.api.stopAll) {
        await window.api.stopAll();
      }
    } catch (e) {
      console.error('Failed to stop all jobs:', e);
    }
  },

  retryJob: async (id) => {
    try {
      if (window.api && window.api.retryDownload) {
        await window.api.retryDownload(id);
      }
    } catch (e) {
      console.error('Failed to retry job:', e);
    }
  },

  removeJob: async (id) => {
    try {
      if (window.api && window.api.removeDownload) {
        await window.api.removeDownload(id);
      }
      set((state) => ({
        jobs: state.jobs.filter((j) => j.id !== id),
        activeCount: state.jobs
          .filter((j) => j.id !== id)
          .filter((j) => j.status === 'downloading' || j.status === 'processing').length
      }));
    } catch (e) {
      console.error('Failed to remove job:', e);
    }
  },

  sortQueue: async (order = 'asc') => {
    try {
      if (window.api && (window.api as any).sortQueue) {
        const sorted = await (window.api as any).sortQueue(order);
        set({ jobs: sorted });
      } else {
        set((state) => {
          const active = state.jobs.filter((j) => j.status === 'downloading' || j.status === 'processing');
          const others = state.jobs.filter((j) => j.status !== 'downloading' && j.status !== 'processing');
          others.sort((a, b) => {
            if (typeof a.playlistIndex === 'number' && typeof b.playlistIndex === 'number') {
              return order === 'asc' ? a.playlistIndex - b.playlistIndex : b.playlistIndex - a.playlistIndex;
            }
            const cmp = a.title.localeCompare(b.title, undefined, { numeric: true, sensitivity: 'base' });
            return order === 'asc' ? cmp : -cmp;
          });
          return { jobs: [...active, ...others] };
        });
      }
    } catch (e) {
      console.error('Failed to sort queue:', e);
    }
  },

  openFile: async (filePath) => {
    try {
      if (window.api && window.api.openFile) {
        const ok = await window.api.openFile(filePath);
        if (!ok) {
          useAppStore.getState().addToast('Could not open file directly', 'warning');
        }
      }
    } catch (e) {
      console.error('Failed to open file:', e);
    }
  },

  openFolder: async (filePath) => {
    try {
      if (window.api && window.api.openFolder) {
        await window.api.openFolder(filePath);
      }
    } catch (e) {
      console.error('Failed to reveal folder:', e);
    }
  }
}));
