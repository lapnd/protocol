import type {
  Lesson,
  NodePatch,
  SequenceMessage,
  StepState,
  Visual,
} from "./types";

/** Everything a visual needs to draw one moment of a lesson. */
export interface Frame {
  visual: Visual;
  /** Index of the step that opened the current scene (-1 = lesson stage). */
  sceneStart: number;
  /** -1 = intro, steps.length = outro. */
  stepIndex: number;
  /** Visibility toggles collected from show/hide. */
  toggles: Map<string, boolean>;
  updates: Record<string, NodePatch>;
  messages: Array<SequenceMessage & { step: number }>;
  values: Record<string, number>;
  code?: string;
  /** The momentary part of the current step (empty on intro/outro). */
  current: StepState;
}

const EMPTY: StepState = {};

/** Index of the step whose `visual` is active at `stepIndex` (or -1). */
export function sceneStartAt(lesson: Lesson, stepIndex: number): number {
  const last = Math.min(stepIndex, lesson.steps.length - 1);
  for (let i = last; i >= 0; i--) {
    if (lesson.steps[i].visual) return i;
  }
  return -1;
}

export function resolveFrame(lesson: Lesson, stepIndex: number): Frame {
  const sceneStart = sceneStartAt(lesson, stepIndex);
  const visual =
    sceneStart >= 0 ? lesson.steps[sceneStart].visual! : lesson.stage;
  const frame: Frame = {
    visual,
    sceneStart,
    stepIndex,
    toggles: new Map(),
    updates: {},
    messages: [],
    values: {},
    current: EMPTY,
  };

  const lastApplied = Math.min(stepIndex, lesson.steps.length - 1);
  for (let i = Math.max(0, sceneStart); i <= lastApplied; i++) {
    const state = lesson.steps[i].state;
    if (!state) continue;
    state.show?.forEach((id) => frame.toggles.set(id, true));
    state.hide?.forEach((id) => frame.toggles.set(id, false));
    if (state.update) {
      for (const [id, patch] of Object.entries(state.update)) {
        frame.updates[id] = { ...frame.updates[id], ...patch };
      }
    }
    state.messages?.forEach((m) => frame.messages.push({ ...m, step: i }));
    if (state.values) Object.assign(frame.values, state.values);
    if (state.code != null) frame.code = state.code;
  }

  if (stepIndex >= 0 && stepIndex < lesson.steps.length) {
    frame.current = lesson.steps[stepIndex].state ?? EMPTY;
  }
  return frame;
}

export function isVisible(
  frame: Frame,
  id: string | undefined,
  hiddenByDefault = false,
): boolean {
  if (!id) return !hiddenByDefault;
  const toggled = frame.toggles.get(id);
  return toggled ?? !hiddenByDefault;
}

export function isHighlighted(frame: Frame, id: string | undefined): boolean {
  return Boolean(id && frame.current.highlight?.includes(id));
}

/** Highlight/dim class for an element id. */
export function emphasisClass(frame: Frame, id: string | undefined): string {
  if (isHighlighted(frame, id)) return "is-hl";
  if (frame.current.focus && frame.current.highlight?.length) return "is-dim";
  return "";
}

/** Parse "3-5,8" into a Set of 1-based line numbers. */
export function parseLineRanges(spec: string | undefined): Set<number> {
  const out = new Set<number>();
  if (!spec) return out;
  for (const part of spec.split(",")) {
    const [a, b] = part.trim().split("-").map((n) => Number(n));
    if (!Number.isFinite(a)) continue;
    const end = Number.isFinite(b) ? b : a;
    for (let n = Math.min(a, end); n <= Math.max(a, end); n++) out.add(n);
  }
  return out;
}
