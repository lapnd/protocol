# Architecture

```
src/
├─ app/                      Next.js routes (static export)
│  ├─ layout.tsx             site shell: theme script, kit.css
│  ├─ page.tsx               hub: every system as a card
│  ├─ [explainer]/           one page per kit explainer (/git/, /compound-interest/…)
│  └─ protocol/              Protocol Explorer route (custom system, own CSS)
├─ kit/                      ★ reusable engine — topic-agnostic, no content
│  ├─ types.ts               content schema (Explainer → Lesson → Step → state)
│  ├─ define.ts              defineExplainer / defineLesson (typing helpers)
│  ├─ frame.ts               resolves "what the stage shows at step N"
│  ├─ validate.ts            content checks used by build + npm run validate
│  ├─ usePlayer.ts           play / pause / step / speed / autoplay timing
│  ├─ locale.tsx, text.ts    multilingual Text + kit UI strings (ui-strings.ts)
│  ├─ theme.ts, storage.ts   shared theme + per-viewer progress
│  ├─ catalog.ts             hub/menu entries (kit + custom systems)
│  ├─ components/            ExplainerApp, Hub, Narration, Controls, LessonNav, Chrome, Markdown
│  ├─ visuals/               Stage + diagram, sequence, code, table, chart, cards
│  └─ styles/kit.css         all styles, scoped to .ex-root, --ex-* tokens
├─ explainers/               ★ content — one folder per topic
│  ├─ index.ts               registry (KIT_EXPLAINERS, CUSTOM_SYSTEMS, CATALOG)
│  ├─ custom-visuals.tsx     named React visuals for { type: "custom" }
│  ├─ git/                   sample kit explainer (en + vi)
│  ├─ compound-interest/     sample non-technical explainer
│  └─ protocol/              Protocol Explorer: its own engine, plugged in as a system
└─ site.config.ts            site name, tagline, hub locales
```

## Two kinds of systems

| | Kit explainer | Custom system |
|---|---|---|
| Example | `git`, `compound-interest` | `protocol` |
| You write | data only (`src/explainers/<id>/`) | a full app + route |
| Gets for free | hub card, menu, player, i18n, theme, progress, keyboard, validation, mobile layout | hub card + menu entry + shared theme |
| Use when | 95% of topics | the topic needs a bespoke simulator (packet dissector, physics…) |

## Data flow on a kit page

1. `app/[explainer]/page.tsx` (server) finds the explainer, runs
   `assertValidExplainer`, and passes the plain data to the client.
2. `ExplainerApp` keeps the active lesson; `usePlayer` keeps the step index.
3. `resolveFrame(lesson, index)` folds the cumulative state of every step in
   the current scene and adds the current step's momentary state.
4. `Stage` picks the renderer for `frame.visual.type`.

Nothing in `src/kit` knows about any topic. Nothing in `src/explainers/<id>`
contains UI code (except optional custom visuals).

## Adding a custom system (like Protocol Explorer)

1. Put its code in `src/explainers/<id>/` (components, data, styles).
2. Add a route `src/app/<id>/page.tsx` (+ `layout.tsx` importing its CSS, so
   the CSS only loads on that page).
3. Export a `CatalogEntry` with `kind: "custom"` and `href: "/<id>/"`, and add
   it to `CUSTOM_SYSTEMS` in `src/explainers/index.ts`.
4. Read/write the theme with the `explainer:theme` storage key (see
   `src/kit/theme.ts`) and link back to the hub (`withBase("/")`).

Links between systems are plain `<a>` (full page load), so each system's
global CSS stays isolated.

## Theme

All systems share Protocol Explorer's look: Iosevka, navy ink on near-white
(`#fdfdfe`) or deep navy (`#0b1020`) in dark mode, square framed panels and a
blueprint grid. Kit tokens live at the top of `src/kit/styles/kit.css`
(`--ex-*`); change them there to re-skin every kit explainer.
