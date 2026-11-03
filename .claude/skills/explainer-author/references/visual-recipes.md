# Visual recipes

| The content is… | Visual | Key state |
|---|---|---|
| Parts of a system and what flows between them | `diagram` | `flows`, `highlight`, `show` |
| Pointers / references / positions that move | `diagram` with `pill` nodes | `update: { id: { x, y } }`, `show`/`hide` edges |
| Data structure (list, tree, graph, hash table) | `diagram` with `circle`/`box` nodes | `show` new nodes, `highlight` path |
| Layers / zones (network, cloud regions, memory) | `diagram` + `groups` | `highlight` group ids |
| Messages over time between parties | `sequence` | `messages`, `notes` |
| Commands, code, config | `code` | `lines`, `code` |
| Reference / comparison grid | `table` | `rows` |
| Quantities, growth, benchmarks | `chart` (set `max`) | `values`, `highlight` |
| A taxonomy, options, pros/cons, summary | `cards` | `show`, `highlight` |
| Anything bespoke (a gauge, a canvas sim) | `custom` | `custom` |

## Layout templates (800 × 450)

- **3 in a row**: x = 130, 400, 670; y = 225.
- **Client → middle → server with a side service**: (110,300) (330,300)
  (560,300) (560,110).
- **Chain of N commits/items**: x = 120 + i·140, y = 240; pointers (pill,
  w 110) 105 px above/below.
- **Hub & spokes**: center (400,225); spokes at radius ~180.
- **Tree**: root (400,70); level spacing 120 px; spread children evenly.

## Scene changes

End a diagram/sequence lesson with a `code` or `table` scene for "how you do
it" or "cheat sheet" (`step.visual`). The scene resets accumulated state.

## Tones

blue = actor/default, green = success/result, amber = in transit/attention,
violet = secondary actor/alternative, teal = infrastructure, red = error/loss,
slate = neutral/past. Explain each tone you use in `legend`.
