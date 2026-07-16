'use client';

/**
 * Slides mode. A single toggle that flips the Creatives editor between the ad
 * creator and a presentation/deck builder. Persisted to localStorage so the
 * mode survives reloads. The heavy lifting (deck layout, adding slides) lives in
 * lib/slides.ts and reuses the normal layer system.
 */
import { create } from 'zustand';

interface SlidesState {
  enabled: boolean;
  setEnabled: (v: boolean) => void;
  toggle: () => void;
}

const KEY = 'ycode-slides-mode';
const initial = typeof window !== 'undefined' && window.localStorage.getItem(KEY) === '1';

export const useSlidesStore = create<SlidesState>((set, get) => ({
  enabled: initial,
  setEnabled: (v) => {
    if (typeof window !== 'undefined') window.localStorage.setItem(KEY, v ? '1' : '0');
    set({ enabled: v });
  },
  toggle: () => get().setEnabled(!get().enabled),
}));
