# Custom visual

```
Use the explainer-visual skill. The "<id>" explainer needs to show
<e.g. "a pressure gauge whose needle moves each step">, which the built-in
diagram/chart visuals can't do.

- If only this topic needs it: create a custom visual named "<pressure-gauge>"
  in src/explainers/custom-visuals.tsx.
- If many topics would use it: propose a new built-in visual in src/kit and
  explain why before building it.
- Use the kit's color tokens so light and dark themes keep working.
- Use it in a lesson; run npm run check and npm run build.
```
