import { create } from "zustand";

interface AppState {
  isInitialized: boolean;
  setInitialized: (val: boolean) => void;
}

export const useAppStore = create<AppState>((set) => ({
  isInitialized: true,
  setInitialized: (val: boolean) => set({ isInitialized: val }),
}));
