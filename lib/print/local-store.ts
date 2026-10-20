"use client";

import { useSyncExternalStore } from "react";

// A settings object kept in this browser's localStorage, readable from any component and
// updated everywhere at once. Missing keys fall back to `defaults`, so new fields need no migration.
export function localStore<T extends object>(key: string, defaults: T) {
  const listeners = new Set<() => void>();
  let cached: T | null = null;

  function read(): T {
    if (cached) return cached;
    try {
      const raw = localStorage.getItem(key);
      cached = raw ? { ...defaults, ...JSON.parse(raw) } : defaults;
    } catch {
      cached = defaults;
    }
    return cached!;
  }

  function save(patch: Partial<T>) {
    cached = { ...read(), ...patch };
    try {
      localStorage.setItem(key, JSON.stringify(cached));
    } catch {
      // private mode / storage full: keep the settings for this session only
    }
    listeners.forEach((l) => l());
  }

  function use(): T {
    return useSyncExternalStore(
      (cb) => {
        listeners.add(cb);
        return () => listeners.delete(cb);
      },
      read,
      () => defaults,
    );
  }

  return { read, save, use };
}
