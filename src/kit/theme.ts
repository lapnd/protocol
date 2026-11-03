import { STORAGE_KEYS } from "./storage";

/**
 * Inline script for <head>: applies the saved or system theme before first
 * paint, so there is no flash. Shared by every explainer, including custom
 * systems such as Protocol Explorer.
 */
export const THEME_INIT_SCRIPT = `
try {
  var saved = localStorage.getItem('${STORAGE_KEYS.theme}');
  var dark = saved ? saved === 'dark' : matchMedia('(prefers-color-scheme: dark)').matches;
  document.documentElement.dataset.theme = dark ? 'dark' : 'light';
  document.documentElement.classList.toggle('dark', dark);
} catch (e) {
  document.documentElement.dataset.theme = 'light';
}
`;

export type ThemeName = "light" | "dark";

export function currentTheme(): ThemeName {
  return document.documentElement.dataset.theme === "dark" ? "dark" : "light";
}

export function applyTheme(theme: ThemeName): void {
  const docEl = document.documentElement;
  docEl.dataset.theme = theme;
  docEl.classList.toggle("dark", theme === "dark");
  try {
    localStorage.setItem(STORAGE_KEYS.theme, theme);
  } catch {}
}
