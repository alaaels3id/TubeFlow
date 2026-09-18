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
  }) => Promise<string | null>;
  pauseJob: (id: string) => Promise<void>;
  resumeJob: (id: string) => Promise<void>;
  cancelJob: (id: string) => Promise<void>;
  retryJob: (id: string) => Promise<void>;
  removeJob: (id: string) => Promise<void>;
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
          newJobs[index] = { ...newJobs[index], ...updatedJob };
        } else {
          newJobs = [updatedJob, ...state.jobs];
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

  resumeJob: async (id) => {
    try {
      if (window.api && window.api.resumeDownload) {
        await window.api.resumeDownload(id);
      }
    } catch (e) {
      console.error('Failed to resume job:', e);
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
