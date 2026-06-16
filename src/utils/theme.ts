import { Theme } from "@/store/useSettingsStore";

export function applyTheme(theme: Theme) {
  const root = document.documentElement;
  let activeTheme = theme;

  if (theme === "system") {
    const systemPrefersDark = window.matchMedia(
      "(prefers-color-scheme: dark)"
    ).matches;
    activeTheme = systemPrefersDark ? "dark" : "light";
  }

  root.setAttribute("data-theme", activeTheme);

  // Update theme-color meta tag
  const metaThemeColor = document.querySelector('meta[name="theme-color"]');
  if (metaThemeColor) {
    metaThemeColor.setAttribute("content", activeTheme === "light" ? "#F9FAFB" : "#050505");
  }
}

export function initThemeListener() {
  const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");

  const handleChange = () => {
    const settingsStr = localStorage.getItem("pulse-settings");
    if (settingsStr) {
      try {
        const settings = JSON.parse(settingsStr);
        if (settings?.state?.theme === "system") {
          applyTheme("system");
        }
      } catch (e) {
        // ignore
      }
    } else {
       applyTheme("system");
    }
  };

  mediaQuery.addEventListener("change", handleChange);
  return () => mediaQuery.removeEventListener("change", handleChange);
}
