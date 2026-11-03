import type { LocaleCode, Text } from "./types";

/**
 * Resolve translatable text for a locale.
 * Order: requested locale → fallback locales → first available value.
 */
export function tx(
  text: Text | undefined | null,
  locale: LocaleCode,
  fallbacks: LocaleCode[] = [],
): string {
  if (text == null) return "";
  if (typeof text === "string") return text;
  const direct = text[locale];
  if (direct != null) return direct;
  for (const code of fallbacks) {
    const value = text[code];
    if (value != null) return value;
  }
  const first = Object.values(text).find((v) => v != null);
  return first ?? "";
}

/** Locales a Text value is missing, given the locales it should cover. */
export function missingLocales(text: Text, locales: LocaleCode[]): LocaleCode[] {
  if (typeof text === "string") return [];
  return locales.filter((code) => !text[code]);
}

/** Strip the Markdown subset to plain text (for titles, aria labels, timing). */
export function plain(value: string): string {
  return value
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/[*`_]/g, "")
    .replace(/^- /gm, "");
}

/** Seconds a person needs to read a narration, used for autoplay. */
export function readingSeconds(value: string): number {
  const words = plain(value).split(/\s+/).filter(Boolean).length;
  return Math.min(14, Math.max(4, words / 3 + 1.5));
}
