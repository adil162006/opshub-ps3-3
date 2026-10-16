import { create } from 'zustand';

export const useSiteStore = create((set) => ({
  activeSite: null,
  setActiveSite: (site) => set({ activeSite: site }),
  clearActiveSite: () => set({ activeSite: null }),
}));