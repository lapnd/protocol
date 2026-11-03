/**
 * Explainer Kit — content schema.
 *
 * An explainer is pure, serializable data: a list of lessons, each lesson a
 * list of steps played on a "stage" (a visual). Authors (people or AI) only
 * write data in this shape; the kit handles playback, layout, i18n, theme,
 * progress and keyboard controls.
 *
 * See docs/CONTENT_SCHEMA.md for a guided tour with examples.
 */

/* ------------------------------------------------------------------ */
/* Primitives                                                          */
/* ------------------------------------------------------------------ */

/** BCP-47-ish locale code, e.g. "vi", "en", "ja". */
export type LocaleCode = string;

/**
 * Translatable text. Either a plain string (same in every locale) or a map of
 * locale → string. Supports a tiny Markdown subset where rendered as prose:
 * **bold**, *italic*, `code`, [link](https://…), "- " bullet lists and blank
 * lines between paragraphs.
 */
export type Text = string | Partial<Record<LocaleCode, string>>;

/** Semantic color names, mapped to theme-aware CSS tokens by the kit. */
export type Tone =
  | "blue"
  | "green"
  | "amber"
  | "violet"
  | "teal"
  | "red"
  | "slate";

/** A label/value row, shown as a definition list. */
export type Fact = [Text, Text];

export interface Source {
  title: string;
  url?: string;
}

/* ------------------------------------------------------------------ */
/* Explainer & lessons                                                 */
/* ------------------------------------------------------------------ */

export type ExplainerStatus = "draft" | "beta" | "stable";

/** Everything the hub needs to show a card for an explainer. */
export interface ExplainerMeta {
  /** URL slug, kebab-case. Becomes /<id>/. */
  id: string;
  title: Text;
  /** One short line under the title. */
  tagline?: Text;
  description: Text;
  /** An emoji or 1–3 characters shown as the logo. */
  icon?: string;
  accent?: Tone;
  category?: Text;
  tags?: string[];
  /** Locales this explainer is written in. The first is the fallback. */
  locales: LocaleCode[];
  status?: ExplainerStatus;
  author?: string;
}

export interface LessonGroup {
  id: string;
  title: Text;
}

export interface GlossaryEntry {
  term: Text;
  definition: Text;
}

export interface Explainer extends ExplainerMeta {
  /** Optional sidebar sections. Lessons reference them via `group`. */
  groups?: LessonGroup[];
  lessons: Lesson[];
  glossary?: GlossaryEntry[];
}

export type LessonLevel = "beginner" | "intermediate" | "advanced";

export interface Lesson {
  /** kebab-case, unique inside the explainer. Used in the URL hash. */
  id: string;
  title: Text;
  /** One sentence: what the learner will understand at the end. */
  summary: Text;
  group?: string;
  icon?: string;
  level?: LessonLevel;
  /** Estimated reading time in minutes. */
  minutes?: number;
  /** Shown before step 1 (the "overview" card). */
  intro?: { body: Text; facts?: Fact[] };
  /** The visual every step plays on, until a step sets its own `visual`. */
  stage: Visual;
  /** Color key shown under the stage. */
  legend?: Array<{ tone: Tone; label: Text }>;
  steps: Step[];
  /** Shown after the last step. */
  outro?: { title: Text; body: Text; facts?: Fact[] };
  sources?: Source[];
}

export interface Step {
  title: Text;
  /** 1–3 short sentences. The main narration. */
  body: Text;
  /** Optional "go deeper" paragraph, collapsed by default. */
  detail?: Text;
  facts?: Fact[];
  /** What changes on the stage during this step. */
  state?: StepState;
  /**
   * Scene change: from this step on, play on this visual instead of the
   * previous one. Accumulated state (shown nodes, messages…) resets.
   */
  visual?: Visual;
  quiz?: Quiz;
  /** Autoplay duration in seconds. Defaults to reading time of `body`. */
  duration?: number;
}

export interface Quiz {
  question: Text;
  options: Text[];
  /** Index into `options`. */
  answer: number;
  explain?: Text;
}

/* ------------------------------------------------------------------ */
/* Visuals                                                             */
/* ------------------------------------------------------------------ */

export type NodeShape = "box" | "round" | "circle" | "pill" | "db" | "doc";

export interface DiagramNode {
  id: string;
  label: Text;
  sublabel?: Text;
  /** Center position in the diagram's coordinate space. */
  x: number;
  y: number;
  w?: number;
  h?: number;
  icon?: string;
  tone?: Tone;
  shape?: NodeShape;
  /** Start hidden; reveal it with `state.show`. */
  hidden?: boolean;
}

export interface DiagramEdge {
  /** Needed only if a step wants to show/hide/highlight this edge. */
  id?: string;
  from: string;
  to: string;
  label?: Text;
  dashed?: boolean;
  /** Draw an arrow head at `to`. Default true. */
  directed?: boolean;
  /** Bend: positive/negative pushes the curve to one side. */
  curve?: number;
  tone?: Tone;
  hidden?: boolean;
}

export interface DiagramGroup {
  id: string;
  label: Text;
  x: number;
  y: number;
  w: number;
  h: number;
  tone?: Tone;
  hidden?: boolean;
}

/** Nodes and arrows. Good for systems, architectures, data structures. */
export interface DiagramVisual {
  type: "diagram";
  /** Coordinate space; defaults to 800 × 450. */
  width?: number;
  height?: number;
  groups?: DiagramGroup[];
  nodes: DiagramNode[];
  edges?: DiagramEdge[];
}

export interface SequenceActor {
  id: string;
  label: Text;
  icon?: string;
  tone?: Tone;
}

/** Lifelines with messages between actors. Good for protocols, APIs. */
export interface SequenceVisual {
  type: "sequence";
  actors: SequenceActor[];
}

/** A code listing with highlighted lines. */
export interface CodeVisual {
  type: "code";
  title?: Text;
  language?: string;
  code: string;
}

export interface TableVisual {
  type: "table";
  title?: Text;
  columns: Text[];
  rows: Text[][];
}

export interface ChartBar {
  id: string;
  label: Text;
  value: number;
  tone?: Tone;
}

/** Horizontal bars. Good for comparisons, sizes, timings. */
export interface ChartVisual {
  type: "chart";
  title?: Text;
  unit?: string;
  /** Fixed scale maximum; defaults to the largest value seen. */
  max?: number;
  bars: ChartBar[];
}

export interface CardItem {
  id: string;
  title: Text;
  body?: Text;
  icon?: string;
  tone?: Tone;
  hidden?: boolean;
}

/** A grid of concept cards. Good for taxonomies, pros/cons, summaries. */
export interface CardsVisual {
  type: "cards";
  columns?: number;
  items: CardItem[];
}

/**
 * Escape hatch: a React component registered by name (see
 * src/explainers/custom-visuals.tsx). Use when no built-in visual fits.
 */
export interface CustomVisual {
  type: "custom";
  component: string;
  props?: Record<string, unknown>;
}

export type Visual =
  | DiagramVisual
  | SequenceVisual
  | CodeVisual
  | TableVisual
  | ChartVisual
  | CardsVisual
  | CustomVisual;

export type VisualType = Visual["type"];

/* ------------------------------------------------------------------ */
/* Step state                                                          */
/* ------------------------------------------------------------------ */

export interface Flow {
  from: string;
  to: string;
  label?: Text;
  tone?: Tone;
}

export interface StageNote {
  /** Node id (diagram) or actor id (sequence). */
  at: string;
  text: Text;
  tone?: Tone;
}

export interface SequenceMessage {
  from: string;
  to: string;
  label: Text;
  /** Small second line under the label. */
  note?: Text;
  tone?: Tone;
  dashed?: boolean;
  /** Draw a cross: the message never arrives. */
  lost?: boolean;
}

export type NodePatch = Partial<
  Pick<DiagramNode, "label" | "sublabel" | "x" | "y" | "icon" | "tone" | "shape">
>;

/**
 * What a step does to the stage.
 *
 * Cumulative (persist into later steps of the same scene):
 *   show, hide, update, messages, values, code
 * Momentary (only during this step):
 *   highlight, flows, notes, lines, rows, focus
 */
export interface StepState {
  /** Reveal elements (node/edge/group/card ids) that start `hidden`. */
  show?: string[];
  /** Hide elements again. */
  hide?: string[];
  /** Change node properties from now on (e.g. move a pointer). */
  update?: Record<string, NodePatch>;
  /** Sequence: messages sent in this step (kept in later steps). */
  messages?: SequenceMessage[];
  /** Chart: set bar values from now on. */
  values?: Record<string, number>;
  /** Code: replace the listing from now on. */
  code?: string;

  /** Emphasize these ids (nodes, edges, cards, bars, actors). */
  highlight?: string[];
  /** Dim everything not highlighted. */
  focus?: boolean;
  /** Diagram: animated tokens travelling between nodes. */
  flows?: Flow[];
  /** Speech-bubble notes attached to nodes or actors. */
  notes?: StageNote[];
  /** Code: highlighted line ranges, e.g. "3-5,8". 1-based. */
  lines?: string;
  /** Table: highlighted row indexes (0-based). */
  rows?: number[];
  /** Custom visuals: anything they need. */
  custom?: Record<string, unknown>;
}
