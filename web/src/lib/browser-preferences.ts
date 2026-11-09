export const PREFERENCE_KEYS = {
  textSize: "mercado-cero:text-size", contrast: "mercado-cero:contrast",
  voiceRate: "mercado-cero:voice-rate", muted: "mercado-cero:muted",
} as const;
export const PREFERENCES_CHANGED_EVENT = "mercado-cero:preferences-changed";
export type BrowserPreferences = {
  textSize: "normal" | "large" | "xlarge";
  contrast: "normal" | "high";
  voiceRate: "slow" | "normal" | "fast";
  muted: boolean;
};
// Only failed writes live here. Full navigation on account changes discards them.
// Never move these overrides to another store or server.
const session: Partial<BrowserPreferences> = {};
export function readBrowserPreferences(): BrowserPreferences {
  const raw: Partial<Record<keyof BrowserPreferences, string | null>> = {};
  if (typeof window !== "undefined") {
    for (const field of Object.keys(PREFERENCE_KEYS) as (keyof BrowserPreferences)[]) {
      try { raw[field] = window.localStorage.getItem(PREFERENCE_KEYS[field]); }
      catch { /* A denied store cannot override this session's choice. */ }
    }
  }
  return {
    textSize: raw.textSize === "large" || raw.textSize === "xlarge" ? raw.textSize : "normal",
    contrast: raw.contrast === "high" ? "high" : "normal",
    voiceRate: raw.voiceRate === "slow" || raw.voiceRate === "fast" ? raw.voiceRate : "normal",
    muted: raw.muted === "1",
    ...(typeof window === "undefined" ? {} : session),
  };
}
export function applyBrowserPreferences(preferences = readBrowserPreferences()) {
  const root = document.documentElement;
  if (preferences.textSize === "normal") delete root.dataset.textSize;
  else root.dataset.textSize = preferences.textSize;
  if (root.dataset.forcedContrast === "1") return;
  if (preferences.contrast === "high") root.dataset.contrast = "high";
  else delete root.dataset.contrast;
}
export function updateBrowserPreferences(patch: Partial<BrowserPreferences>) {
  for (const field of Object.keys(patch) as (keyof BrowserPreferences)[]) {
    const value = patch[field];
    if (value === undefined) continue;
    // Write only chosen fields; another tab can change unrelated preferences.
    Object.assign(session, { [field]: value });
    try {
      window.localStorage.setItem(PREFERENCE_KEYS[field], field === "muted" ? (value ? "1" : "0") : String(value));
      delete session[field];
    } catch { /* Share the current session choice when storage is denied/full. */ }
  }
  const next = readBrowserPreferences();
  applyBrowserPreferences(next);
  window.dispatchEvent(new Event(PREFERENCES_CHANGED_EVENT));
  return next;
}
export function subscribeBrowserPreferences(notify: () => void) {
  const changed = (event: StorageEvent) => {
    const field = (Object.keys(PREFERENCE_KEYS) as (keyof BrowserPreferences)[]).find(key => PREFERENCE_KEYS[key] === event.key);
    if (event.key !== null && !field) return;
    if (field) delete session[field];
    else for (const key of Object.keys(session) as (keyof BrowserPreferences)[]) delete session[key];
    notify();
  };
  window.addEventListener(PREFERENCES_CHANGED_EVENT, notify);
  window.addEventListener("storage", changed);
  return () => {
    window.removeEventListener(PREFERENCES_CHANGED_EVENT, notify);
    window.removeEventListener("storage", changed);
  };
}
