const APP_STORAGE_PREFIXES = ["mercado-cero:", "trangui:"];

function availableBrowserStorage(name: "localStorage" | "sessionStorage"): Storage | undefined {
  try { return window[name]; }
  catch (error) {
    // Some iPhone browser/privacy contexts deny the storage getter entirely.
    // Such a store cannot supply stale account state either; still clear the other one.
    if (error instanceof DOMException && error.name === "SecurityError") return undefined;
    throw error;
  }
}

/** Remove this app's persisted state when switching accounts, preserving other apps. */
export function clearAppBrowserState(
  local?: Storage,
  session?: Storage,
) {
  for (const storage of [local ?? availableBrowserStorage("localStorage"), session ?? availableBrowserStorage("sessionStorage")]) {
    if (!storage) continue;
    try {
      // Storage key order is implementation-defined and can change on removal.
      // Snapshot first so WebKit cannot skip a previous account's entry.
      const appKeys: string[] = [];
      for (let index = 0; index < storage.length; index += 1) {
        const key = storage.key(index);
        if (key && APP_STORAGE_PREFIXES.some(prefix => key.startsWith(prefix))) {
          appKeys.push(key);
        }
      }
      for (const key of appKeys) storage.removeItem(key);
      for (let index = 0; index < storage.length; index += 1) {
        const key = storage.key(index);
        if (key && APP_STORAGE_PREFIXES.some(prefix => key.startsWith(prefix))) {
          throw new Error("App storage remains after cleanup");
        }
      }
    } catch (error) {
      // Readable but uncleared state must not leak across accounts.
      throw new Error("browser_state_cleanup_failed", { cause: error });
    }
  }
}
