import type { RunStats, Settings } from "./types";
import { STORAGE_KEYS } from "./types";

export function saveBestRun(stats: RunStats): void {
  try {
    localStorage.setItem(STORAGE_KEYS.bestRun, JSON.stringify(stats));
  } catch (error) {
    console.warn("Failed to save best run", error);
  }
}

export function loadBestRun(): RunStats | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.bestRun);
    if (!raw) {
      return null;
    }
    return JSON.parse(raw) as RunStats;
  } catch (error) {
    console.warn("Failed to load best run", error);
    return null;
  }
}

export function saveSettings(settings: Settings): void {
  try {
    localStorage.setItem(STORAGE_KEYS.settings, JSON.stringify(settings));
  } catch (error) {
    console.warn("Failed to persist settings", error);
  }
}

export function loadSettings(defaults: Settings): Settings {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.settings);
    if (!raw) {
      return defaults;
    }
    const parsed = JSON.parse(raw) as Partial<Settings>;
    return { ...defaults, ...parsed };
  } catch (error) {
    console.warn("Failed to restore settings", error);
    return defaults;
  }
}
