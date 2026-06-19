"use client";
import i18n from "i18next";
import { initReactI18next } from "react-i18next";

import en from "./locales/en.json";

/**
 * English-only configuration.
 *
 * Arabic support has been removed from this build per user request. The
 * LanguageDetector is gone (no localStorage / navigator probing), which also
 * eliminates the hydration mismatch where the server rendered "Loading..."
 * while the client rendered "جاري التحميل...".
 *
 * To re-enable Arabic later: import ar.json, add it to resources, restore the
 * LanguageDetector, and handle `dir`/`lang` on <html>.
 */
if (!i18n.isInitialized) {
  i18n.use(initReactI18next).init({
    resources: {
      en: { translation: en },
    },
    lng: "en",
    fallbackLng: "en",
    supportedLngs: ["en"],
    interpolation: {
      escapeValue: false,
    },
    // No async detection — language is fixed to English synchronously so SSR
    // and CSR render identical text.
    react: {
      useSuspense: false,
    },
  });
}

export default i18n;
