import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { RouterProvider } from "@tanstack/react-router";
import { router } from "./router";
import "./index.css";
import { useSettingsStore } from "./store/useSettingsStore";
import { applyTheme, initThemeListener } from "./utils/theme";

// Initialize theme before render
applyTheme(useSettingsStore.getState().theme);
initThemeListener();

// Subscribe to theme changes via the store
useSettingsStore.subscribe(
  (state) => applyTheme(state.theme)
);

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>,
);
