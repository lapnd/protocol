# Add a language

```
Add the <ja> locale to the "<id>" explainer:
- Add "<ja>" to locales.
- Translate every Text (titles, narration, stage labels, quizzes, tables).
- Keep common technical terms; translate naturally, not word for word.
- If the kit's own UI strings (Play, Step…) have no <ja> yet, add them to
  src/kit/ui-strings.ts.
- Run npm run validate -- <id> --strict until there are no warnings.
```
