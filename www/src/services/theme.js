// ==============================================================================
// TRANSMOVE GLOBAL THEME MANAGEMENT SERVICE
// Controls Light / Dark Theme switching, system preference detection & persistence
// Primary Storage Key: transmove-theme
// ==============================================================================

export const ThemeService = {
  /**
   * Retrieves stored theme preference, falling back to system prefers-color-scheme.
   * @returns {"light" | "dark"}
   */
  getStoredTheme() {
    if (typeof localStorage === "undefined") return "light";
    const stored = localStorage.getItem("transmove-theme")
      || localStorage.getItem("transmove_theme")
      || localStorage.getItem("transmove_theme_preference");

    if (stored === "dark" || stored === "light") {
      return stored;
    }

    // Default to system preference if user hasn't explicitly set one
    if (typeof window !== "undefined" && window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches) {
      return "dark";
    }

    return "light";
  },

  /**
   * Returns current active theme ("light" or "dark").
   */
  getCurrentTheme() {
    if (typeof document !== "undefined" && document.documentElement) {
      const active = document.documentElement.dataset.theme || document.documentElement.getAttribute("data-theme");
      if (active === "dark" || active === "light") return active;
    }
    return this.getStoredTheme();
  },

  /**
   * Applies theme to DOM, localStorage, and PWA meta tags.
   * @param {"light" | "dark"} theme
   */
  setTheme(theme) {
    const targetTheme = theme === "dark" ? "dark" : "light";

    // Persist choice
    if (typeof localStorage !== "undefined") {
      try {
        localStorage.setItem("transmove-theme", targetTheme);
        localStorage.setItem("transmove_theme", targetTheme);
        localStorage.setItem("transmove_theme_preference", targetTheme);
      } catch (_) {}
    }

    if (typeof document !== "undefined" && document.documentElement) {
      document.documentElement.dataset.theme = targetTheme;
      document.documentElement.setAttribute("data-theme", targetTheme);

      // Update PWA theme-color meta tag
      const metaThemeColor = document.querySelector('meta[name="theme-color"]');
      if (metaThemeColor) {
        metaThemeColor.setAttribute("content", targetTheme === "dark" ? "#0b1120" : "#059669");
      }
    }

    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("themechanged", { detail: { theme: targetTheme } }));
    }

    return targetTheme;
  },

  /**
   * Toggles between light and dark themes.
   * @returns {"light" | "dark"} New active theme
   */
  toggleTheme() {
    const current = this.getCurrentTheme();
    const next = current === "dark" ? "light" : "dark";
    return this.setTheme(next);
  },

  /**
   * Initializes theme on application boot.
   */
  init() {
    if (typeof window === "undefined") return;
    const initial = this.getStoredTheme();
    this.setTheme(initial);

    // Watch for OS preference changes only if user hasn't explicitly set a preference
    if (window.matchMedia) {
      try {
        window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", (e) => {
          const hasManualPreference = typeof localStorage !== "undefined" && localStorage.getItem("transmove-theme");
          if (!hasManualPreference) {
            this.setTheme(e.matches ? "dark" : "light");
          }
        });
      } catch (_) {}
    }
  }

};

// Auto-run initialization immediately upon module load
ThemeService.init();
