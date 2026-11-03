import type { LocaleCode, LocaleDictionary, LocaleInfo } from "../types/protocol";

export const escapeHtml = (value: unknown): string =>
  String(value).replace(
    /[&<>"]/g,
    (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[ch]!,
  );

const LANG_STORAGE_KEY = "protocol-explorer:lang";

export const LANGUAGES: LocaleInfo[] = [
  { code: "en", name: "English", short: "EN", html: "en" },
  {
    code: "es",
    name: "Español",
    short: "ES",
    html: "es",
    load: () => import("./locales/es"),
  },
  {
    code: "pt",
    name: "Português",
    short: "PT",
    html: "pt-BR",
    load: () => import("./locales/pt"),
  },
  {
    code: "fr",
    name: "Français",
    short: "FR",
    html: "fr",
    load: () => import("./locales/fr"),
  },
  {
    code: "de",
    name: "Deutsch",
    short: "DE",
    html: "de",
    load: () => import("./locales/de"),
  },
  {
    code: "tr",
    name: "Türkçe",
    short: "TR",
    html: "tr",
    load: () => import("./locales/tr"),
  },
  {
    code: "id",
    name: "Bahasa Indonesia",
    short: "ID",
    html: "id",
    load: () => import("./locales/id"),
  },
  {
    code: "ja",
    name: "日本語",
    short: "JA",
    html: "ja",
    load: () => import("./locales/ja"),
  },
  {
    code: "zh",
    name: "简体中文",
    short: "ZH",
    html: "zh-CN",
    load: () => import("./locales/zh"),
  },
  {
    code: "zh-TW",
    name: "繁體中文",
    short: "TW",
    html: "zh-TW",
    load: () => import("./locales/zh-TW"),
  },
  {
    code: "ko",
    name: "한국어",
    short: "KO",
    html: "ko",
    load: () => import("./locales/ko"),
  },
  {
    code: "hi",
    name: "हिन्दी",
    short: "HI",
    html: "hi",
    load: () => import("./locales/hi"),
  },
  {
    code: "ar",
    name: "العربية",
    short: "AR",
    html: "ar",
    dir: "rtl",
    load: () => import("./locales/ar"),
  },
  {
    code: "he",
    name: "עברית",
    short: "HE",
    html: "he",
    dir: "rtl",
    load: () => import("./locales/he"),
  },
];

let currentLang: LocaleCode = "en";
let activeDictionary: LocaleDictionary | null = null;
const languageChangeListeners = new Set<(lang: LocaleCode) => void>();

const interpolateVariables = (
  template: string,
  vars?: Record<string, string | number>,
): string =>
  vars
    ? template.replace(/\{(\w+)\}/g, (match, key) =>
        key in vars ? String(vars[key]) : match,
      )
    : template;

/**
 * Translates an English source string into the active language, applying regex pattern
 * fallbacks, variable interpolation, and locale-specific typographic post-processing.
 */
export function t(
  sourceText: string,
  vars?: Record<string, string | number>,
): string {
  if (typeof sourceText !== "string" || !sourceText) return sourceText;
  let result = sourceText;
  if (activeDictionary) {
    const directMatch = activeDictionary.strings[sourceText];
    if (directMatch !== undefined) {
      result = directMatch;
    } else if (activeDictionary.patterns) {
      for (const [pattern, replacement] of activeDictionary.patterns) {
        if (pattern.test(sourceText)) {
          result =
            typeof replacement === "function"
              ? sourceText.replace(pattern, replacement)
              : sourceText.replace(pattern, replacement);
          break;
        }
      }
    }
  }
  result = interpolateVariables(result, vars);
  return activeDictionary?.post ? activeDictionary.post(result) : result;
}

export const getCurrentLang = (): LocaleCode => currentLang;

export const isRtl = (): boolean =>
  LANGUAGES.find((entry) => entry.code === currentLang)?.dir === "rtl";

export const isolateBidi = (text: string): string =>
  isRtl() ? `\u2066${text}\u2069` : text;

const RTL_SCRIPT_REGEX = /[\u0590-\u08ff\ufb1d-\ufdff\ufe70-\ufefc]/;

export const isPureLatinInRtl = (text: string): boolean =>
  isRtl() && !RTL_SCRIPT_REGEX.test(text);

export const toLocaleUpper = (text: string): string => {
  const htmlLang =
    LANGUAGES.find((entry) => entry.code === currentLang)?.html ?? "en";
  return text.toLocaleUpperCase(htmlLang);
};

export const toUpperLocale = toLocaleUpper;

/**
 * Returns the HTML attribute + content fragment `data-t="..." [data-t-upper]>Translated`
 * used for reactive DOM re-translation.
 */
export const tAttr = (sourceText: string, uppercase = false): string => {
  const translated = t(sourceText);
  return `data-t="${escapeHtml(sourceText)}"${uppercase ? " data-t-upper" : ""}>${escapeHtml(
    uppercase ? toLocaleUpper(translated) : translated,
  )}`;
};

/**
 * Updates all `[data-t]`, `[data-t-title]`, and `[data-t-label]` elements inside `root`.
 */
export function translateDomTree(root: ParentNode): void {
  root.querySelectorAll<HTMLElement>("[data-t]").forEach((el) => {
    const key = el.dataset.t!;
    const translated = t(key);
    el.textContent = el.hasAttribute("data-t-upper")
      ? toLocaleUpper(translated)
      : translated;
  });
  root.querySelectorAll<HTMLElement>("[data-t-title]").forEach((el) => {
    el.title = t(el.dataset.tTitle!);
  });
  root.querySelectorAll<HTMLElement>("[data-t-label]").forEach((el) => {
    el.setAttribute("aria-label", t(el.dataset.tLabel!));
  });
}

async function loadLocaleDictionary(
  code: LocaleCode,
): Promise<LocaleDictionary | null> {
  const entry = LANGUAGES.find((item) => item.code === code);
  if (!entry?.load) return null;
  const loaded = (await entry.load()).default;
  return {
    strings: loaded.strings,
    patterns: loaded.patterns ?? [],
    post: loaded.post,
  };
}

let requestSequence = 0;

export async function setLanguage(
  requestedCode: string,
  persist = true,
): Promise<void> {
  const token = ++requestSequence;
  const validCode: LocaleCode = LANGUAGES.some(
    (entry) => entry.code === requestedCode,
  )
    ? (requestedCode as LocaleCode)
    : "en";
  const dictionary = await loadLocaleDictionary(validCode);
  if (token !== requestSequence) return;
  activeDictionary = dictionary;
  currentLang = validCode;
  const entry = LANGUAGES.find((item) => item.code === validCode)!;
  document.documentElement.lang = entry.html;
  document.documentElement.dir = entry.dir ?? "ltr";
  if (persist) {
    try {
      localStorage.setItem(LANG_STORAGE_KEY, validCode);
    } catch {}
  }
  languageChangeListeners.forEach((listener) => listener(validCode));
}

export const onLanguageChange = (
  listener: (lang: LocaleCode) => void,
): void => {
  languageChangeListeners.add(listener);
};

export async function initSavedLanguage(): Promise<void> {
  let saved: string | null = null;
  try {
    saved = localStorage.getItem(LANG_STORAGE_KEY);
  } catch {}
  if (saved && saved !== "en") {
    await setLanguage(saved, false).catch(() => {});
  }
}
