import { useEffect, useState } from "react";

/**
 * Reads resolved design-token colors from CSS custom properties so they can be
 * passed to libraries (like Recharts) that require concrete color values rather
 * than Tailwind classes. Re-reads whenever the active theme changes.
 */
export interface ThemeColors {
  primary: string;
  text: string;
  textMuted: string;
  grid: string;
  surface: string;
  border: string;
}

function readColors(): ThemeColors {
  const styles = getComputedStyle(document.documentElement);
  const get = (name: string, fallback: string) =>
    styles.getPropertyValue(name).trim() || fallback;

  return {
    primary: get("--c-primary", "#CCFF00"),
    text: get("--c-text-primary", "#111827"),
    textMuted: get("--c-text-muted", "#9CA3AF"),
    grid: get("--c-border", "rgba(0,0,0,0.1)"),
    surface: get("--c-bg-surface", "#FFFFFF"),
    border: get("--c-border", "rgba(0,0,0,0.1)"),
  };
}

export function useThemeColors(): ThemeColors {
  const [colors, setColors] = useState<ThemeColors>(() =>
    typeof window === "undefined"
      ? {
          primary: "#CCFF00",
          text: "#111827",
          textMuted: "#9CA3AF",
          grid: "rgba(0,0,0,0.1)",
          surface: "#FFFFFF",
          border: "rgba(0,0,0,0.1)",
        }
      : readColors()
  );

  useEffect(() => {
    const update = () => setColors(readColors());
    update();

    // Re-read when the data-theme attribute flips (light/dark/system switch).
    const observer = new MutationObserver(update);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-theme"],
    });

    return () => observer.disconnect();
  }, []);

  return colors;
}
