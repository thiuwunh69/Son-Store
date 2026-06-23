// Memory storage fallback keys
const memoryLocalStorageMap: Record<string, string> = {};
const memorySessionStorageMap: Record<string, string> = {};

// Safe LocalStorage API Wrapper
export const safeLocalStorage = {
  getItem(key: string): string | null {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        return window.localStorage.getItem(key);
      }
    } catch (e) {
      console.warn(`localStorage.getItem failed for key "${key}":`, e);
    }
    return memoryLocalStorageMap[key] || null;
  },

  setItem(key: string, value: string): void {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.setItem(key, value);
        return;
      }
    } catch (e) {
      console.warn(`localStorage.setItem failed for key "${key}":`, e);
    }
    memoryLocalStorageMap[key] = value;
  },

  removeItem(key: string): void {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.removeItem(key);
        return;
      }
    } catch (e) {
      console.warn(`localStorage.removeItem failed for key "${key}":`, e);
    }
    delete memoryLocalStorageMap[key];
  },

  clear(): void {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.clear();
        return;
      }
    } catch (e) {
      console.warn('localStorage.clear failed:', e);
    }
    for (const key in memoryLocalStorageMap) {
      delete memoryLocalStorageMap[key];
    }
  }
};

// Safe SessionStorage API Wrapper
export const safeSessionStorage = {
  getItem(key: string): string | null {
    try {
      if (typeof window !== 'undefined' && window.sessionStorage) {
        return window.sessionStorage.getItem(key);
      }
    } catch (e) {
      console.warn(`sessionStorage.getItem failed for key "${key}":`, e);
    }
    return memorySessionStorageMap[key] || null;
  },

  setItem(key: string, value: string): void {
    try {
      if (typeof window !== 'undefined' && window.sessionStorage) {
        window.sessionStorage.setItem(key, value);
        return;
      }
    } catch (e) {
      console.warn(`sessionStorage.setItem failed for key "${key}":`, e);
    }
    memorySessionStorageMap[key] = value;
  },

  removeItem(key: string): void {
    try {
      if (typeof window !== 'undefined' && window.sessionStorage) {
        window.sessionStorage.removeItem(key);
        return;
      }
    } catch (e) {
      console.warn(`sessionStorage.removeItem failed for key "${key}":`, e);
    }
    delete memorySessionStorageMap[key];
  },

  clear(): void {
    try {
      if (typeof window !== 'undefined' && window.sessionStorage) {
        window.sessionStorage.clear();
        return;
      }
    } catch (e) {
      console.warn('sessionStorage.clear failed:', e);
    }
    for (const key in memorySessionStorageMap) {
      delete memorySessionStorageMap[key];
    }
  }
};
