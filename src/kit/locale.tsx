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
import { STORAGE_KEYS, readStorage, writeStorage } from "./storage";
import { tx } from "./text";
import type { LocaleCode, Text } from "./types";
import { type UiKey, ui } from "./ui-strings";

interface LocaleContextValue {
  locale: LocaleCode;
  locales: LocaleCode[];
  setLocale: (code: LocaleCode) => void;
  /** Resolve content text. */
  t: (text: Text | undefined | null) => string;
  /** Resolve a kit interface string. */
  u: (key: UiKey) => string;
}

const LocaleContext = createContext<LocaleContextValue | null>(null);

/**
 * Provides the active locale. The first entry of `locales` is used for the
 * server render; the viewer's saved choice is applied after hydration.
 */
export function LocaleProvider({
  locales,
  children,
}: {
  locales: LocaleCode[];
  children: ReactNode;
}) {
  const [locale, setLocaleState] = useState<LocaleCode>(locales[0]);

  useEffect(() => {
    const saved = readStorage(STORAGE_KEYS.locale);
    if (saved && locales.includes(saved)) {
      setLocaleState(saved);
      return;
    }
    const browser = navigator.language?.slice(0, 2);
    if (browser && locales.includes(browser)) setLocaleState(browser);
  }, [locales]);

  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);

  const setLocale = useCallback((code: LocaleCode) => {
    setLocaleState(code);
    writeStorage(STORAGE_KEYS.locale, code);
  }, []);

  const value = useMemo<LocaleContextValue>(
    () => ({
      locale,
      locales,
      setLocale,
      t: (text) => tx(text, locale, locales),
      u: (key) => ui(key, locale),
    }),
    [locale, locales, setLocale],
  );

  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
}

export function useLocale(): LocaleContextValue {
  const ctx = useContext(LocaleContext);
  if (!ctx) throw new Error("useLocale must be used inside <LocaleProvider>");
  return ctx;
}
