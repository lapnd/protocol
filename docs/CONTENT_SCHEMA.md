# Content schema

An explainer is **pure data** in TypeScript. You never write UI code to add a
topic: you describe lessons, steps and what changes on the stage, and the kit
plays it. The full type definitions live in [`src/kit/types.ts`](../src/kit/types.ts);
this page is the guided version.

```
Explainer            (one topic / "system", e.g. Git)
 └─ Lesson[]         (one idea each, 4–9 steps)
     ├─ stage        (the visual: diagram | sequence | code | table | chart | cards | custom)
     └─ Step[]       (title + narration + state = what changes on the stage)
```

## Explainer

```ts
import { defineExplainer } from "../../kit/define";

export default defineExplainer({
  id: "git",                       // URL: /git/  (kebab-case)
  icon: "🌿",                      // emoji or 1–3 characters
  accent: "green",                 // blue | green | amber | violet | teal | red | slate
  status: "stable",                // draft (hidden in production) | beta | stable
  category: { vi: "Lập trình", en: "Programming" },
  locales: ["en", "vi"],           // first = fallback
  title: { vi: "Git từ bên trong", en: "Git from the inside" },
  tagline: { vi: "…", en: "…" },   // one short line
  description: { vi: "…", en: "…" },
  groups: [{ id: "basics", title: { vi: "Cơ bản", en: "Basics" } }], // optional sidebar sections
  lessons: [threeAreas, branches],
  glossary: [{ term: "HEAD", definition: { vi: "…", en: "…" } }],      // optional
});
```

Register it in [`src/explainers/index.ts`](../src/explainers/index.ts)
(`npm run new:explainer -- <id>` does this for you).

## Text and translations

Every user-facing string is a `Text`:

- `"HTTP"`: same in every locale.
- `{ vi: "Nhánh", en: "Branch" }`: per locale. Missing locales fall back to
  the first one in `locales`; `npm run validate` warns about them.

Prose fields (`body`, `detail`, `intro.body`, `outro.body`, card bodies, table
cells, facts) support a tiny Markdown subset: `**bold**`, `*italic*`, `` `code` ``,
`[link](https://…)`, `- ` bullet lines, and a blank line between paragraphs.
Nothing else, and no HTML.

## Lesson

| Field | Required | Notes |
|---|---|---|
| `id` | ✓ | kebab-case, unique; becomes the URL hash `/git/#branches` |
| `title`, `summary` | ✓ | summary = one sentence: what the learner will understand |
| `stage` | ✓ | the visual (see below) |
| `steps` | ✓ | 4–9 is the sweet spot; the validator warns above 12 |
| `intro` | | `{ body, facts? }` shown before step 1 |
| `outro` | | `{ title, body, facts? }` shown after the last step |
| `legend` | | `[{ tone, label }]` color key under the stage |
| `group`, `icon`, `level`, `minutes`, `sources` | | sidebar and outro extras |

## Step

```ts
{
  title: { vi: "git add: chọn thay đổi", en: "git add: pick the change" },
  body: { vi: "1–3 câu ngắn…", en: "1–3 short sentences…" },
  detail: { … },          // optional "go deeper", collapsed
  facts: [["Port", "443"]],
  state: { … },           // what changes on the stage
  visual: { … },          // optional scene change (see below)
  quiz: { question, options: [...], answer: 1, explain },
  duration: 8,            // optional autoplay seconds (default: reading time)
}
```

## Step state

`state` is how a step animates the stage. Keys are either **cumulative** (they
stay for later steps) or **momentary** (only during this step).

| Key | Kind | Works on | Meaning |
|---|---|---|---|
| `show: ids[]` | cumulative | diagram, cards | reveal elements declared with `hidden: true` |
| `hide: ids[]` | cumulative | diagram, cards | hide elements again |
| `update: { id: patch }` | cumulative | diagram | change a node's `label`, `sublabel`, `x`, `y`, `icon`, `tone`, `shape` (animates moves) |
| `messages: [...]` | cumulative | sequence | messages sent in this step; earlier ones stay, faded |
| `values: { id: n }` | cumulative | chart | new bar values |
| `code: string` | cumulative | code | replace the listing |
| `highlight: ids[]` | momentary | all | emphasize nodes, edges, groups, actors, cards, bars |
| `focus: true` | momentary | all | dim everything that is not highlighted |
| `flows: [...]` | momentary | diagram | animated token `{ from, to, label?, tone? }` travelling between nodes |
| `notes: [...]` | momentary | diagram, sequence | speech bubble `{ at, text, tone? }` |
| `lines: "3-5,8"` | momentary | code | highlighted line ranges (1-based) |
| `rows: [0, 2]` | momentary | table | highlighted rows (0-based) |
| `custom: {...}` | momentary | custom | anything a custom visual reads |

To refer to an edge in `show` / `hide` / `highlight`, give the edge an `id`.

### Scene changes

A step with `visual` switches the stage from that step onward. Accumulated
state (shown nodes, messages, values) resets for the new scene. Use it to
end a diagram lesson with a code listing or a summary table.

## Visuals

### `diagram`: systems, architectures, data structures

```ts
{
  type: "diagram",
  width: 800, height: 450,               // coordinate space (defaults)
  groups: [{ id, label, x, y, w, h, tone }],   // dashed regions, x/y = top-left
  nodes: [{ id, label, sublabel?, x, y, icon?, tone?, shape?, w?, h?, hidden? }],
  edges: [{ id?, from, to, label?, dashed?, directed?, curve?, tone?, hidden? }],
}
```

- Node `x`, `y` is the **center**. Default size 150×60; shapes: `box`,
  `round`, `pill` (labels/pointers), `circle` (76×76), `db`, `doc`.
- Keep ~40 px between node edges. Lay out left→right in the order things
  happen; keep labels under ~18 characters.
- `curve` bends an edge (±40…±160). Use it for return paths so they do not
  overlap the forward edge.
- Edges draw arrows at `to` unless `directed: false`.

### `sequence`: protocols, APIs, conversations over time

```ts
{ type: "sequence", actors: [{ id, label, icon?, tone? }] }
```

Messages live in steps: `state.messages: [{ from, to, label, note?, tone?, dashed?, lost? }]`.
`from === to` draws a self-call. `dashed` for replies, `lost: true` for a
message that never arrives.

### `code`

```ts
{ type: "code", title?, language?, code: "…" }
```
Highlight with `state.lines`. Replace the listing in a later step with
`state.code`.

### `table`

```ts
{ type: "table", title?, columns: Text[], rows: Text[][] }
```
Highlight with `state.rows`. Every row must have as many cells as `columns`.

### `chart`: comparisons, growth, sizes

```ts
{ type: "chart", title?, unit?, max?, bars: [{ id, label, value, tone? }] }
```
Animate with `state.values`. Set `max` when values grow across steps so the
scale does not jump.

### `cards`: taxonomies, pros/cons, summaries

```ts
{ type: "cards", columns?: 1–4, items: [{ id, title, body?, icon?, tone?, hidden? }] }
```

### `custom`: anything else

```ts
{ type: "custom", component: "big-number", props: { unit: "ms" } }
```
Register the React component in [`src/explainers/custom-visuals.tsx`](../src/explainers/custom-visuals.tsx).
It receives `{ visual, frame, t, speed }`; per-step data is in
`frame.current.custom`. Prefer the built-ins: custom visuals are code to
maintain.

## Validation

`npm run validate` (also part of `next build`) checks:

- ids are kebab-case and unique; lesson `group`s exist
- every id in `show`, `hide`, `highlight`, `update`, `values` exists in the
  active visual
- `flows`, `messages`, `notes` point at real nodes/actors and are used on the
  right visual type
- table rows match the column count; quiz answers are in range
- every `Text` has every locale (warning)

`npm run validate -- --strict` turns warnings into errors.
