---
name: explainer-visual
description: Build a new reusable visual for the Explainer Kit (a "custom" visual React component, or a new built-in visual type), or plug a whole bespoke system (like Protocol Explorer) into the hub. Use when an explainer needs something the built-in diagram/sequence/code/table/chart/cards visuals cannot show.
---

# Explainer visual / custom system

First confirm a built-in visual cannot do it (see
`.claude/skills/explainer-author/references/visual-recipes.md`). Diagram +
`update` moves + `flows` covers most "animated system" needs.

## Option A — custom visual (one topic needs it)

1. Add a component in `src/explainers/custom-visuals.tsx` and register it in
   `CUSTOM_VISUALS` under a kebab-case name.
2. Props: `{ visual, frame, t, speed }` (`src/kit/visuals/types.ts`).
   - static config: `visual.props`
   - per-step data: `frame.current.custom` (momentary) — if you need
     cumulative data, derive it by reading `frame.stepIndex`.
   - text: always pass `Text` through `t()`.
3. Style with kit tokens only (`var(--ex-ink)`, `var(--ex-c)`, `.ex-tone-*`,
   `var(--ex-line-strong)`, Iosevka via inheritance) so light/dark and the
   Protocol look keep working. Respect `prefers-reduced-motion`.
4. Use it from content: `{ type: "custom", component: "<name>", props: {…} }`.

## Option B — new built-in visual (many topics would use it)

1. Add the type to the `Visual` union in `src/kit/types.ts` (+ any new
   `StepState` keys, documented as cumulative or momentary).
2. If cumulative, fold it in `resolveFrame` (`src/kit/frame.ts`).
3. Renderer in `src/kit/visuals/`, wired in `Stage.tsx`.
4. Teach the validator its ids in `visualIds` (`src/kit/validate.ts`).
5. Styles in `src/kit/styles/kit.css` under `.ex-root`, tokens only.
6. Document it in `docs/CONTENT_SCHEMA.md` and the visual recipes table.
7. Use it in a sample lesson; `npm run typecheck && npm run validate && npm run build`.

Keep `src/kit` topic-agnostic: no topic words, no content.

## Option C — bespoke system (own engine, like `protocol`)

Follow "Adding a custom system" in `docs/ARCHITECTURE.md`: code under
`src/explainers/<id>/`, route `src/app/<id>/` whose `layout.tsx` imports the
system's CSS, a `CatalogEntry` with `kind: "custom"` in `CUSTOM_SYSTEMS`,
shared theme key `explainer:theme`, and a link back to the hub.
