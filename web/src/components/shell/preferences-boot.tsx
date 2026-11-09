"use client";

import { useEffect } from "react";
import { applyBrowserPreferences, subscribeBrowserPreferences } from "@/lib/browser-preferences";

/** Keep active pages in sync with this tab's choices and other tabs. */
export function PreferencesBoot() {
  useEffect(() => {
    const sync = () => applyBrowserPreferences();
    sync();
    return subscribeBrowserPreferences(sync);
  }, []);
  return null;
}
