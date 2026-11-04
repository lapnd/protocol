# Explainer Lab

A **template for interactive explainers**. Every topic is a small "system"
with animated diagrams, step-by-step narration, quick checks, multiple
languages, light/dark themes and a phone layout. **Protocol Explorer** ships
as one system in the menu; new topics are written as data.

| System | Kind | Path |
|---|---|---|
| 🌐 Protocol Explorer: how the internet works, packet by packet | custom system | `/protocol/` |
| 🌿 Git from the inside: commits, branches, push/pull | kit explainer (en/vi) | `/git/` |
| 💰 Compound interest: a non-technical example (chart, cards, table) | kit explainer (en/vi) | `/compound-interest/` |

## Run it

```bash
npm install
```

```bash
npm run dev
```

Open http://localhost:3000. The hub lists every system; the menu in the top
bar switches between them.

## A new topic in three steps

```bash
npm run new:explainer -- docker --title "How Docker works"
```

1. This creates `src/explainers/docker/` (a working one-lesson draft) and
   registers it in `src/explainers/index.ts`.
2. Write the content in `src/explainers/docker/lessons/*.ts`. It is only data:
   titles, narration, the stage, and what each step changes. See
   [docs/CONTENT_SCHEMA.md](docs/CONTENT_SCHEMA.md).
3. Check it:

```bash
npm run check
```

Or let an AI write it: open the repo in Claude Code and use a prompt from
[prompts/](prompts/), for example:

```
Use the explainer-author skill to create an explainer about Docker for new developers.
Locales: en, vi. 4 lessons. Show me the outline first.
```

## Layout

```
src/kit/            reusable engine: player, layout, i18n, theme, visuals, validator
src/explainers/     content, one folder per topic (pure data)
  protocol/         Protocol Explorer, a bespoke system plugged in via manifest.ts
src/app/            Next.js routes: / (hub), /[explainer]/, /protocol/
.claude/skills/     AI skills: explainer-author, explainer-review, explainer-visual
prompts/            sample prompts
docs/               ARCHITECTURE.md, CONTENT_SCHEMA.md
```

Details: [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

## Built-in visuals

| Visual | For |
|---|---|
| `diagram` | systems, architectures, data structures: nodes, arrows, moving tokens, pointers that move |
| `sequence` | protocols, APIs, conversations over time |
| `code` | commands, code, config with highlighted lines |
| `table` | comparisons, cheat sheets |
| `chart` | numbers, growth |
| `cards` | taxonomies, pros/cons, summaries |
| `custom` | your own React component when nothing else fits |

## Commands

| Command | Does |
|---|---|
| `npm run dev` | start the dev server |
| `npm run new:explainer -- <id>` | scaffold and register a topic |
| `npm run validate [-- <id>] [-- --strict]` | check references, quizzes and translations |
| `npm run check` | typecheck + validate |
| `npm run build` | static export to `out/` (also validates) |

## Deploy

`.github/workflows/pages.yml` builds the site on every push to `main` and
deploys it to GitHub Pages (it sets `basePath` for you). Turn it on once in
**Settings → Pages → Build and deployment**: Source "GitHub Actions". Change
the site name, tagline and hub languages in
[`src/site.config.ts`](src/site.config.ts).

## Theme

Every system shares Protocol Explorer's look: Iosevka, navy ink, square
framed panels, a blueprint grid and a dark mode. The color tokens are at the
top of `src/kit/styles/kit.css`.

## Credits

Protocol Explorer is based on [protocol-explorer-alpha.vercel.app](https://protocol-explorer-alpha.vercel.app/)
by Dilum Sanjaya; details in [src/explainers/protocol/README.md](src/explainers/protocol/README.md).
