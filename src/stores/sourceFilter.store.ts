import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface SourceFilterState {
  // Channels the user has toggled ON. Empty = show all.
  activeChannels: string[];
  setActiveChannels: (channels: string[]) => void;
  toggleChannel: (channel: string) => void;
  isActive: (channel: string) => boolean;
}

export const useSourceFilterStore = create<SourceFilterState>()(
  persist(
    (set, get) => ({
      activeChannels: [],

      setActiveChannels: (channels) => set({ activeChannels: channels }),

      // Exclusive mode: clicking a connector shows ONLY that connector's data.
      // Clicking the already-active one goes back to "All".
      toggleChannel: (channel) => {
        const current = get().activeChannels;
        const isOnlyThisOne = current.length === 1 && current[0] === channel;
        // If this connector is already the sole active one → go back to All
        set({ activeChannels: isOnlyThisOne ? [] : [channel] });
      },

      isActive: (channel) => {
        const { activeChannels } = get();
        if (activeChannels.length === 0) return true;
        return activeChannels.includes(channel);
      },
    }),
    {
      name: 'leadryze-source-filter',
      partialize: (s) => ({ activeChannels: s.activeChannels }),
    }
  )
);
