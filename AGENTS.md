# Explainer Lab — notes for AI agents

This repo is a **template for interactive explainers**. Read
`docs/ARCHITECTURE.md` first, then `docs/CONTENT_SCHEMA.md`.

- `src/kit/` — reusable engine. Keep it topic-agnostic.
- `src/explainers/<id>/` — content as data (`defineExplainer`, `defineLesson`).
- `src/explainers/protocol/` — Protocol Explorer, a bespoke "custom system".
  Its engine is separate; don't refactor it into the kit unless asked.
- Skills: `explainer-author` (write content), `explainer-review` (check it),
  `explainer-visual` (new visuals / custom systems). Sample prompts: `prompts/`.

Commands

```bash
npm run dev                         # http://localhost:3000
npm run new:explainer -- <id>       # scaffold + register
npm run check                       # typecheck + content validation
npm run build                       # static export to out/ (also validates)
```

Rules
- Content changes must pass `npm run check`.
- Keep the shared Protocol Explorer look: style with `--ex-*` tokens only.
- Every user-facing string is `Text`; translate it for every locale listed.
- Don't invent facts; put sources on lessons.
