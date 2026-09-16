// ==============================================================================
// TRANSMOVE GLOBAL THEME MANAGEMENT SERVICE
// Controls Light / Dark / System Theme switching and persistence
// Default: LIGHT
// ==============================================================================

export const ThemeService = {
  getThemePreference() {
    return localStorage.getItem("transmove_theme_preference") || "light";
  },

  getEffectiveTheme(pref = this.getThemePreference()) {
    if (pref === "system") {
      return window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches
        ? "dark"
        : "light";
    }
    return pref === "dark" ? "dark" : "light";
  },

  setTheme(themePreference) {
    const validPref = ["light", "dark", "system"].includes(themePreference) ? themePreference : "light";
    localStorage.setItem("transmove_theme_preference", validPref);
    
    // Legacy compatibility key
    const effective = this.getEffectiveTheme(validPref);
    localStorage.setItem("transmove_theme", effective);
    
    document.documentElement.setAttribute("data-theme", effective);
    document.documentElement.setAttribute("data-theme-preference", validPref);
    
    window.dispatchEvent(new CustomEvent("themechanged", { detail: { preference: validPref, theme: effective } }));
  },

  toggleTheme() {
    const current = this.getThemePreference();
    const nextMap = { light: "dark", dark: "system", system: "light" };
    const next = nextMap[current] || "light";
    this.setTheme(next);
    return next;
  },

  init() {
    const pref = this.getThemePreference();
    this.setTheme(pref);

    // Listen for system theme changes when preference is 'system'
    if (window.matchMedia) {
      window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => {
        if (this.getThemePreference() === "system") {
          this.setTheme("system");
        }
      });
    }
  }
};

ThemeService.init();

