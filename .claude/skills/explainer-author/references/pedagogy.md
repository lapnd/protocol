# Pedagogy patterns

Pick a lesson shape that matches the idea.

| Shape | Use for | Step pattern |
|---|---|---|
| **Journey** | processes, protocols, pipelines | actor ready → request → each hop → result → what went wrong / variation |
| **Build-up** | structures, architectures | one part → add part → connect → whole system → stress it |
| **Before / after** | why X exists | the naive way → its failure → the fix → the fix in action |
| **Compare** | A vs B | same scenario with A → with B → the difference made visible → when to pick which |
| **Zoom** | layered systems | big picture → zoom into one box → zoom further → back out |
| **Grow over time** | math, finance, scaling | t=0 → t=1 → t=n → the surprising part → levers |

## Lesson sequence for a topic

1. **Hook / big picture** — what it is for, the 3–5 main parts.
2. **Core mechanism** — the one thing everything else depends on.
3. **Variations / failure cases** — what changes when conditions change.
4. **In practice** — commands, code, numbers, a cheat sheet table.

3–6 lessons is a good size for a topic. Order from most concrete to most
abstract.

## Making it stick

- Use one running example through the whole explainer (same file name, same
  server, same 100 million).
- Name the misconception, then show why it is wrong (Git: "a branch is not a
  copy").
- End each lesson with a sentence the learner could repeat to a friend.
- Quiz the insight, not trivia.
