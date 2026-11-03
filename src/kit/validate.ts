import { sceneStartAt } from "./frame";
import { missingLocales } from "./text";
import type { Explainer, Text, Visual } from "./types";

export interface Issue {
  level: "error" | "warning";
  where: string;
  message: string;
}

const ID_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/** Ids of everything a step can refer to in a visual. */
export function visualIds(visual: Visual): {
  all: Set<string>;
  anchors: Set<string>;
} {
  const all = new Set<string>();
  const anchors = new Set<string>();
  switch (visual.type) {
    case "diagram":
      visual.nodes.forEach((n) => (all.add(n.id), anchors.add(n.id)));
      visual.edges?.forEach((e) => e.id && all.add(e.id));
      visual.groups?.forEach((g) => all.add(g.id));
      break;
    case "sequence":
      visual.actors.forEach((a) => (all.add(a.id), anchors.add(a.id)));
      break;
    case "chart":
      visual.bars.forEach((b) => all.add(b.id));
      break;
    case "cards":
      visual.items.forEach((c) => all.add(c.id));
      break;
    default:
      break;
  }
  return { all, anchors };
}

/**
 * Check an explainer for mistakes a type checker cannot catch: duplicate ids,
 * steps that reference elements that do not exist, quiz answers out of range,
 * missing translations. Errors fail the build; warnings are printed.
 */
export function validateExplainer(explainer: Explainer): Issue[] {
  const issues: Issue[] = [];
  const err = (where: string, message: string) =>
    issues.push({ level: "error", where, message });
  const warn = (where: string, message: string) =>
    issues.push({ level: "warning", where, message });

  const root = explainer.id;
  if (!ID_RE.test(explainer.id)) err(root, `id "${explainer.id}" must be kebab-case`);
  if (!explainer.locales?.length) err(root, "locales must list at least one locale");
  if (!explainer.lessons.length) err(root, "needs at least one lesson");

  const groupIds = new Set(explainer.groups?.map((g) => g.id));
  const lessonIds = new Set<string>();

  explainer.lessons.forEach((lesson, li) => {
    const lw = `${root}/${lesson.id || `lesson#${li}`}`;
    if (!ID_RE.test(lesson.id)) err(lw, `lesson id "${lesson.id}" must be kebab-case`);
    if (lessonIds.has(lesson.id)) err(lw, "duplicate lesson id");
    lessonIds.add(lesson.id);
    if (lesson.group && !groupIds.has(lesson.group)) {
      err(lw, `group "${lesson.group}" is not declared in explainer.groups`);
    }
    if (!lesson.steps.length) err(lw, "needs at least one step");
    if (lesson.steps.length > 12) {
      warn(lw, `${lesson.steps.length} steps; consider splitting (aim for 4–9)`);
    }
    checkVisual(lesson.stage, `${lw}/stage`, err);

    lesson.steps.forEach((step, si) => {
      const sw = `${lw}/step ${si + 1}`;
      if (step.visual) checkVisual(step.visual, `${sw}/visual`, err);
      const start = sceneStartAt(lesson, si);
      const visual = start >= 0 ? lesson.steps[start].visual! : lesson.stage;
      const { all, anchors } = visualIds(visual);
      const st = step.state;
      if (st) {
        const refs = [
          ...(st.show ?? []),
          ...(st.hide ?? []),
          ...(st.highlight ?? []),
          ...Object.keys(st.update ?? {}),
          ...Object.keys(st.values ?? {}),
        ];
        for (const id of refs) {
          if (!all.has(id)) err(sw, `unknown id "${id}" for ${visual.type} visual`);
        }
        for (const f of st.flows ?? []) {
          for (const id of [f.from, f.to]) {
            if (!anchors.has(id)) err(sw, `flow endpoint "${id}" is not a node`);
          }
        }
        for (const m of st.messages ?? []) {
          for (const id of [m.from, m.to]) {
            if (!anchors.has(id)) err(sw, `message endpoint "${id}" is not an actor`);
          }
        }
        for (const n of st.notes ?? []) {
          if (!anchors.has(n.at)) err(sw, `note anchor "${n.at}" does not exist`);
        }
        if (st.messages && visual.type !== "sequence") {
          err(sw, "messages only work on a sequence visual");
        }
        if (st.flows && visual.type !== "diagram") {
          err(sw, "flows only work on a diagram visual");
        }
      }
      if (step.quiz) {
        const q = step.quiz;
        if (q.options.length < 2) err(sw, "quiz needs at least 2 options");
        if (q.answer < 0 || q.answer >= q.options.length) {
          err(sw, `quiz answer ${q.answer} is out of range`);
        }
      }
    });
  });

  walkTexts(explainer, root, (text, where) => {
    const missing = missingLocales(text, explainer.locales);
    if (missing.length) warn(where, `missing translation: ${missing.join(", ")}`);
  });

  return issues;
}

function checkVisual(
  visual: Visual,
  where: string,
  err: (where: string, message: string) => void,
) {
  if (visual.type === "diagram") {
    const ids = new Set<string>();
    for (const n of visual.nodes) {
      if (ids.has(n.id)) err(where, `duplicate node id "${n.id}"`);
      ids.add(n.id);
    }
    for (const e of visual.edges ?? []) {
      if (!ids.has(e.from)) err(where, `edge from unknown node "${e.from}"`);
      if (!ids.has(e.to)) err(where, `edge to unknown node "${e.to}"`);
    }
  }
  if (visual.type === "table") {
    visual.rows.forEach((row, i) => {
      if (row.length !== visual.columns.length) {
        err(where, `table row ${i} has ${row.length} cells, expected ${visual.columns.length}`);
      }
    });
  }
}

const TEXT_KEYS = new Set([
  "title",
  "tagline",
  "description",
  "category",
  "summary",
  "body",
  "detail",
  "label",
  "sublabel",
  "text",
  "question",
  "explain",
  "term",
  "definition",
  "note",
]);
const TEXT_LIST_KEYS = new Set(["options", "columns", "facts", "rows"]);
const SKIP_KEYS = new Set(["update", "values", "props", "custom"]);

function walkTexts(
  node: unknown,
  where: string,
  visit: (text: Text, where: string) => void,
): void {
  if (Array.isArray(node)) {
    node.forEach((child, i) => walkTexts(child, `${where}[${i}]`, visit));
    return;
  }
  if (!node || typeof node !== "object") return;
  for (const [key, value] of Object.entries(node)) {
    if (SKIP_KEYS.has(key)) continue;
    const w = `${where}.${key}`;
    if (TEXT_KEYS.has(key) && value && typeof value === "object" && !Array.isArray(value)) {
      visit(value as Text, w);
    } else if (TEXT_LIST_KEYS.has(key) && Array.isArray(value)) {
      value.flat().forEach((t, i) => {
        if (t && typeof t === "object") visit(t as Text, `${w}[${i}]`);
      });
    } else {
      walkTexts(value, w, visit);
    }
  }
}

/** Throw with a readable report if any error-level issue exists. */
export function assertValidExplainer(explainer: Explainer): void {
  const issues = validateExplainer(explainer);
  const errors = issues.filter((i) => i.level === "error");
  if (errors.length) {
    throw new Error(
      `Explainer "${explainer.id}" is invalid:\n` +
        errors.map((e) => `  ✗ ${e.where}: ${e.message}`).join("\n"),
    );
  }
}
