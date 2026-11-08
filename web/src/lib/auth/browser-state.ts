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
      for (let index = storage.length - 1; index >= 0; index -= 1) {
        const key = storage.key(index);
        if (key && APP_STORAGE_PREFIXES.some(prefix => key.startsWith(prefix))) {
          storage.removeItem(key);
        }
      }
    } catch (error) {
      // Readable but uncleared state must not leak across accounts.
      throw new Error("browser_state_cleanup_failed", { cause: error });
    }
  }
}
