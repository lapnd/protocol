/**
 * Per-viewer persistence (locale, theme, speed, progress). Every access is
 * guarded: private windows and blocked storage must never break the page.
 */
export const STORAGE_KEYS = {
  theme: "explainer:theme",
  locale: "explainer:locale",
  speed: "explainer:speed",
  progress: "explainer:progress:v1",
} as const;

export function readStorage(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

export function writeStorage(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {}
}

/** explainerId → lessonId → highest step reached (steps.length = finished). */
export type ProgressStore = Record<string, Record<string, number>>;

export function readProgress(): ProgressStore {
  try {
    const parsed = JSON.parse(readStorage(STORAGE_KEYS.progress) || "{}");
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

/** Record that a lesson reached `reached` steps. Returns true if it grew. */
export function recordProgress(
  explainerId: string,
  lessonId: string,
  reached: number,
): boolean {
  const store = readProgress();
  const current = store[explainerId]?.[lessonId] ?? 0;
  if (reached <= current) return false;
  store[explainerId] = { ...store[explainerId], [lessonId]: reached };
  writeStorage(STORAGE_KEYS.progress, JSON.stringify(store));
  return true;
}
