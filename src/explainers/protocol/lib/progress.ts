import type { Lesson, ProtocolId, SimulationState } from "../types/protocol";

const PROGRESS_STORAGE_KEY = "protocol-explorer:progress:v1";

export interface LessonProgressRecord {
  seen: number[];
  done: boolean;
}

export type ProgressMap = Partial<Record<ProtocolId, LessonProgressRecord>>;

function loadProgressFromStorage(): ProgressMap {
  if (typeof window === "undefined") return {};
  try {
    const parsed = JSON.parse(localStorage.getItem(PROGRESS_STORAGE_KEY) || "null");
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

let progressStore: ProgressMap | null = null;

function getStore(): ProgressMap {
  if (!progressStore) {
    progressStore = loadProgressFromStorage();
  }
  return progressStore;
}

function saveProgressToStorage(): void {
  if (typeof window === "undefined" || !progressStore) return;
  try {
    localStorage.setItem(PROGRESS_STORAGE_KEY, JSON.stringify(progressStore));
  } catch {}
}

/**
 * Records step progress for a lesson and persists to localStorage if updated.
 * Returns true if the progress state changed.
 */
export function recordLessonProgress(
  lesson: Lesson,
  state: SimulationState,
): boolean {
  const store = getStore();
  const entry = (store[lesson.id] ??= { seen: [], done: false });
  let changed = false;

  if (state.started && !state.done && !entry.seen.includes(state.activeStep)) {
    entry.seen.push(state.activeStep);
    changed = true;
  }
  if (state.done && !entry.done) {
    entry.done = true;
    entry.seen = lesson.steps.map((_, idx) => idx);
    changed = true;
  }
  if (changed) {
    saveProgressToStorage();
  }
  return changed;
}

/**
 * Returns the completion ratio (0 to 1) for a given lesson.
 */
export function getLessonCompletionRatio(lesson: Lesson): number {
  const entry = getStore()[lesson.id];
  if (!entry) return 0;
  return entry.done
    ? 1
    : Math.min(entry.seen.length, lesson.steps.length - 1) / lesson.steps.length;
}

export type LessonProgressStatus = "new" | "progress" | "done";

/**
 * Returns the badge status ("new" | "progress" | "done") for a given lesson.
 */
export function getLessonStatus(lesson: Lesson): LessonProgressStatus {
  const entry = getStore()[lesson.id];
  return entry?.done ? "done" : entry?.seen.length ? "progress" : "new";
}
