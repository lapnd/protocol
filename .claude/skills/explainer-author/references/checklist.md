# Hand-off checklist

Content
- [ ] Each lesson has one idea; `summary` is one sentence
- [ ] 4–9 steps per lesson; each step changes the stage
- [ ] Step bodies ≤ ~45 words; key term in **bold**
- [ ] Facts and numbers verified; `sources` listed
- [ ] 1–2 quizzes per lesson on the key insight, with `explain`
- [ ] `intro` and `outro` present
- [ ] All `Text` translated for every locale

Stage
- [ ] Nothing overlaps at any step (check with the browser if possible)
- [ ] Labels short (≤ ~18 chars), consistent with the narration
- [ ] Hidden elements revealed when first mentioned
- [ ] Legend explains every tone used

Code
- [ ] Files: `src/explainers/<id>/index.ts`, `lessons/<lesson-id>.ts`
- [ ] Registered in `src/explainers/index.ts`
- [ ] `npm run typecheck` passes
- [ ] `npm run validate -- <id>` → 0 errors (0 warnings ideally)
- [ ] `status` set to `beta` or `stable` when ready
