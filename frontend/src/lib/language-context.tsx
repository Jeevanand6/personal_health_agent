"use client";

import React, { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { Language, translations, TranslationDictionary } from "./i18n/translations";

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  isTamil: boolean;
  t: (section: keyof TranslationDictionary, key: string, fallback?: string) => string;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

const LANGUAGE_STORAGE_KEY = "health_copilot_lang";

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<Language>("en");

  // Load persisted language on mount
  useEffect(() => {
    if (typeof window !== "undefined") {
      const savedLang = localStorage.getItem(LANGUAGE_STORAGE_KEY) as Language | null;
      if (savedLang && (savedLang === "en" || savedLang === "ta")) {
        setLanguageState(savedLang);
      }
    }
  }, []);

  const setLanguage = (lang: Language) => {
    setLanguageState(lang);
    if (typeof window !== "undefined") {
      localStorage.setItem(LANGUAGE_STORAGE_KEY, lang);
      document.cookie = `health_copilot_lang=${lang}; path=/; max-age=31536000; SameSite=Lax`;

      // If user is authenticated, persist to user profile in backend asynchronously
      const token = localStorage.getItem("health_copilot_token");
      if (token) {
        import("./api").then(({ updateLanguageApi }) => {
          updateLanguageApi(lang, token).catch(() => {
            // Silently ignore if offline or session expired
          });
        });
      }
    }
  };

  const t = (
    section: keyof TranslationDictionary,
    key: string,
    fallback?: string
  ): string => {
    const dict = translations[language] || translations.en;
    const sec = dict[section];
    if (sec && typeof sec[key] === "string") {
      return sec[key];
    }
    // Fallback to English
    const fallbackSec = translations.en[section];
    if (fallbackSec && typeof fallbackSec[key] === "string") {
      return fallbackSec[key];
    }
    return fallback || key;
  };

  return (
    <LanguageContext.Provider
      value={{
        language,
        setLanguage,
        isTamil: language === "ta",
        t,
      }}
    >
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error("useLanguage must be used within a LanguageProvider");
  }
  return context;
}
