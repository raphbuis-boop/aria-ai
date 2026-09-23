export type ThemePref = "system" | "light" | "dark";

export const THEME_KEY = "aria-theme";

/** Reads the viewer's saved appearance. Storage can be unavailable (private
 * mode, blocked site data), so every access is guarded. */
export function readThemePref(): ThemePref {
  try {
    const v = localStorage.getItem(THEME_KEY);
    return v === "light" || v === "dark" ? v : "system";
  } catch {
    return "system";
  }
}

export function applyThemePref(pref: ThemePref) {
  try {
    if (pref === "system") localStorage.removeItem(THEME_KEY);
    else localStorage.setItem(THEME_KEY, pref);
  } catch {
    /* preference just won't persist */
  }
  const dark =
    pref === "dark" ||
    (pref === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);
  document.documentElement.classList.toggle("dark", dark);
}

/** Inline, pre-paint: sets `.dark` on <html> so there's no light flash. The
 * marketing landing page ("/") is always light. */
export const THEME_BOOT_SCRIPT = `(function(){try{if(location.pathname==="/")return;var p=localStorage.getItem("${THEME_KEY}");var d=p==="dark"||(p!=="light"&&window.matchMedia("(prefers-color-scheme: dark)").matches);if(d)document.documentElement.classList.add("dark")}catch(e){}})();`;
