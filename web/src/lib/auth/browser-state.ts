const APP_STORAGE_PREFIXES = ["mercado-cero:", "trangui:"];

/** Remove this app's persisted state when switching accounts, preserving other apps. */
export function clearAppBrowserState(
  local: Storage = window.localStorage,
  session: Storage = window.sessionStorage,
) {
  for (const storage of [local, session]) {
    for (let index = storage.length - 1; index >= 0; index -= 1) {
      const key = storage.key(index);
      if (key && APP_STORAGE_PREFIXES.some(prefix => key.startsWith(prefix))) {
        storage.removeItem(key);
      }
    }
  }
}
