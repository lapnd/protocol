---
name: explainer-author
description: Write a new interactive explainer (or add/extend lessons) on ANY topic for this repo's Explainer Kit — research the topic, design a lesson plan, choose visuals, and produce valid TypeScript content in src/explainers/<id>/. Use when asked to explain, teach or visualize a topic, "tạo explainer", "viết bài giải thích", "thêm bài học", or to turn an article/notes into an explainer.
---

# Explainer author

You turn a topic into **data** for the Explainer Kit. The kit already does
playback, layout, i18n, theme, progress and validation. You write lessons.

Read before writing: `docs/CONTENT_SCHEMA.md` (the schema, 5 min) and one
sample: `src/explainers/git/lessons/branches.ts` (diagram + pointer moves),
`src/explainers/git/lessons/remotes.ts` (sequence + table scene),
`src/explainers/compound-interest/index.ts` (chart, cards, table).

## Workflow

1. **Frame the brief.** Settle (ask only if truly unclear; otherwise state
   your assumption): audience & level, locales (default `["en", "vi"]`, first
   = fallback), scope (how many lessons), id (kebab-case).
2. **Get the facts right.** Use your knowledge; when the topic is factual,
   recent, numeric or niche, check sources (web search if available). Record
   2–4 authoritative `sources` per lesson. Never invent numbers, quotes,
   RFC/paper names or APIs. If unsure, say so in the hand-off.
3. **Plan before coding.** Write a short outline (in chat, or in the PR
   description): lessons → for each: the one idea, the visual, 4–9 step
   titles. Use `references/pedagogy.md`.
4. **Pick the visual per lesson** with `references/visual-recipes.md`.
   Prefer built-ins; only use `custom` when nothing fits (then also use the
   `explainer-visual` skill).
5. **Scaffold**: `npm run new:explainer -- <id> --title "…" --locales en,vi`
   (creates `src/explainers/<id>/` and registers it), or add a lesson file
   to an existing explainer and list it in its `lessons`.
6. **Write the content** — one file per lesson in `lessons/`, using
   `defineLesson`. Follow the writing rules below.
7. **Validate**: `npm run typecheck && npm run validate -- <id>`. Fix every
   error; fix translation warnings unless the user said otherwise.
8. **Look at it** if you can run a browser: `npm run build`, serve `out/`,
   step through each lesson (keyboard → / ←), check desktop and ~390 px wide.
   Fix overlaps (nodes too close, long labels, notes covering nodes).
9. **Hand off**: what you made, lesson list, assumptions, anything you could
   not verify. Set `status: "beta"` when done (`draft` hides it in production).

## Writing rules

- One lesson = one idea. Title says the idea; `summary` = "after this you
  will understand …" in one sentence.
- Step `body`: 1–3 short sentences, ≤ ~45 words. Say what is happening **on
  the stage right now**. Bold the one key term. Put extras in `detail`.
- Every step must change something visible (`state`) — otherwise merge it.
- Concrete before abstract: show an example (a file, a packet, 100 million
  at 8%) before the rule.
- Name things consistently: the label on the stage = the word in the text.
- Facts (`facts`) are for scannable numbers/names, max 4 rows.
- Add a `quiz` on the step that carries the key insight (1–2 per lesson),
  with one clearly right answer and plausible wrong ones; add `explain`.
- `intro` = why it matters (2–3 sentences). `outro` = the one thing to
  remember + where to go next.
- Translations (e.g. Vietnamese): natural, not word for word; keep standard English
  technical terms (commit, branch, packet) and explain them once.
- Translate every `Text` into every locale in `locales`.

## Stage rules (diagram)

- Coordinates 800×450, node `x,y` = center, default node 150×60. Keep ≥ 40 px
  gaps; flow left→right / top→bottom in time order.
- Start with only what step 1 needs visible; reveal with `show`, hide with
  `hide`. Give edges an `id` when a step refers to them.
- Movement: `update: { node: { x, y } }` animates (pointers, cursors, items
  moving between containers).
- `flows` for things in transit; `notes` for a short label on a node (≤ 6
  words); `focus: true` to dim the rest.
- Legend: one entry per tone you use with a meaning.

## Output checklist

See `references/checklist.md` — run through it before handing off.
