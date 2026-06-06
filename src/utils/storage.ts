// Resilient localStorage wrapper for mobile APK and restricted WebView environments.
// If localStorage is unavailable, blocked by permissions, or throws security errors,
// it falls back to an in-memory dictionary cache so that the application never crashes.

const memoryCache: Record<string, string> = {};

function isLocalStorageAvailable(): boolean {
  try {
    if (typeof window === 'undefined' || !window.localStorage) {
      return false;
    }
    const testKey = '__storage_test__';
    window.localStorage.setItem(testKey, testKey);
    window.localStorage.removeItem(testKey);
    return true;
  } catch (e) {
    return false;
  }
}

const hasLocalStorage = isLocalStorageAvailable();

export const secureStorage = {
  getItem(key: string): string | null {
    try {
      if (hasLocalStorage) {
        return window.localStorage.getItem(key);
      }
    } catch (e) {
      console.warn(`[Storage] Failed to read "${key}" from localStorage, using memory backup:`, e);
    }
    return memoryCache[key] !== undefined ? memoryCache[key] : null;
  },

  setItem(key: string, value: string): void {
    try {
      if (hasLocalStorage) {
        window.localStorage.setItem(key, value);
        return;
      }
    } catch (e) {
      console.warn(`[Storage] Failed to write "${key}" to localStorage, using memory backup:`, e);
    }
    memoryCache[key] = value;
  },

  removeItem(key: string): void {
    try {
      if (hasLocalStorage) {
        window.localStorage.removeItem(key);
        return;
      }
    } catch (e) {
      console.warn(`[Storage] Failed to remove "${key}" from localStorage:`, e);
    }
    delete memoryCache[key];
  },

  clear(): void {
    try {
      if (hasLocalStorage) {
        window.localStorage.clear();
        return;
      }
    } catch (e) {
      console.warn('[Storage] Failed to clear localStorage:', e);
    }
    for (const key in memoryCache) {
      delete memoryCache[key];
    }
  }
};
