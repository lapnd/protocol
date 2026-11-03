# Plug in a bespoke system (like Protocol Explorer)

```
Use the explainer-visual skill (Option C). I have a separate simulation app:
<description / path to code>. Plug it into the hub the way Protocol Explorer is:
- code in src/explainers/<id>/
- route src/app/<id>/ with a layout that imports its own CSS
- a CatalogEntry with kind "custom" in CUSTOM_SYSTEMS
- the shared "explainer:theme" storage key and a link back to the hub
Build and check both the hub and the new page.
```
