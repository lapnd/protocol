# Create a new explainer

## Short

```
Use the explainer-author skill to create an explainer about <topic>.
Learner: <who, what they already know>. Locales: en, vi. About <3–5> lessons.
Show me the outline first, then write the code.
```

## Full

```
Use the explainer-author skill to create a new explainer in this repo.

Topic: <e.g. "How large language models generate text">
id: <e.g. how-llms-work>
Learner: <e.g. developers with no machine learning background>
Goal: afterwards the learner can explain <tokenization, embeddings,
attention, sampling>.
Locales: en (default), vi
Scope: <4> lessons, 5–8 steps each, 1–2 quick checks per lesson.
Running example: <the sentence "The capital of France is">

Requirements:
1. Give me the outline (lessons → key idea → visual → step titles) first and
   wait for my approval.
2. Verify numbers and terminology; list sources on every lesson.
3. Prefer built-in visuals (diagram, sequence, code, table, chart, cards).
4. Run npm run check and fix every error.
5. If you can run a browser, build and step through each lesson at desktop
   and phone width.
6. Set status: "beta", commit, and summarize what you did.
```

## Topic ideas

- Tech: how Docker works, OAuth 2.0, database indexes, the HTTPS certificate chain
- Science: photosynthesis, mRNA vaccines, why Earth has seasons
- Economics and finance: inflation, compound interest, how banks create money
- Skills: the Pomodoro technique, reading a financial statement
