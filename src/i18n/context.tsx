"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { dictionaries, statusLabel, translate } from "./dictionaries";
import {
  DEFAULT_LOCALE,
  LOCALE_STORAGE_KEY,
  type Locale,
} from "./types";

type I18nContextValue = {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: (key: string, vars?: Record<string, string | number>) => string;
  ts: (status: string) => string;
  ready: boolean;
};

const I18nContext = createContext<I18nContextValue | null>(null);

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(DEFAULT_LOCALE);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(LOCALE_STORAGE_KEY) as Locale | null;
      if (saved === "id" || saved === "en") {
        setLocaleState(saved);
      } else {
        const nav = navigator.language?.toLowerCase() || "";
        if (nav.startsWith("en")) setLocaleState("en");
      }
    } catch {
      /* ignore */
    }
    setReady(true);
  }, []);

  useEffect(() => {
    if (!ready) return;
    try {
      localStorage.setItem(LOCALE_STORAGE_KEY, locale);
      document.documentElement.lang = locale;
    } catch {
      /* ignore */
    }
  }, [locale, ready]);

  const setLocale = useCallback((next: Locale) => {
    setLocaleState(next);
  }, []);

  const t = useCallback(
    (key: string, vars?: Record<string, string | number>) =>
      translate(locale, key, vars),
    [locale]
  );

  const ts = useCallback(
    (status: string) => statusLabel(locale, status),
    [locale]
  );

  const value = useMemo(
    () => ({ locale, setLocale, t, ts, ready }),
    [locale, setLocale, t, ts, ready]
  );

  return (
    <I18nContext.Provider value={value}>{children}</I18nContext.Provider>
  );
}

export function useI18n() {
  const ctx = useContext(I18nContext);
  if (!ctx) {
    // Fallback if used outside provider (SSR edge)
    return {
      locale: DEFAULT_LOCALE as Locale,
      setLocale: () => {},
      t: (key: string, vars?: Record<string, string | number>) =>
        translate(DEFAULT_LOCALE, key, vars),
      ts: (status: string) => statusLabel(DEFAULT_LOCALE, status),
      ready: true,
    };
  }
  return ctx;
}

export function useDictionary() {
  const { locale } = useI18n();
  return dictionaries[locale];
}
