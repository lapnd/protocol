---
name: explainer-review
description: Review an existing explainer in src/explainers/<id>/ for factual accuracy, teaching quality, translation quality and stage/visual problems, then fix or report. Use when asked to review, check, proofread, "rà soát", "kiểm tra" or improve an explainer.
---

# Explainer review

1. Run `npm run validate -- <id>` and `npm run typecheck`. Fix all errors.
2. Read every lesson file top to bottom, the way a learner meets it
   (intro → steps → outro). For each step ask:
   - **Accurate?** Every claim, number, command and name is correct and
     current. Check doubtful ones against a primary source (spec, docs,
     paper). Flag anything you cannot verify.
   - **Visible?** The narration describes what the stage shows at that step
     (`state` matches the words; ids exist; revealed when mentioned).
   - **Clear?** ≤ ~45 words, one idea, no undefined jargon, consistent names.
   - **Translated well?** Each locale reads naturally; terms consistent with
     the glossary; no locale missing.
3. Check the lesson as a whole against
   `.claude/skills/explainer-author/references/pedagogy.md` and the checklist
   in `.claude/skills/explainer-author/references/checklist.md`.
4. If a browser is available, build, serve `out/`, and step through each
   lesson at desktop and ~390 px width, looking for overlaps and clipped text.
5. Report findings ranked: factual errors → misleading visuals → clarity →
   translation → polish. Fix what the user asked you to fix; list the rest.
