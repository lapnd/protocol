import type { Explainer, Lesson } from "./types";

/**
 * Identity helpers that give authors autocompletion and type errors while
 * writing content. They do nothing at runtime.
 *
 *   export default defineExplainer({ id: "git", ... });
 *   export const branching = defineLesson({ id: "branching", ... });
 */
export const defineExplainer = (explainer: Explainer): Explainer => explainer;
export const defineLesson = (lesson: Lesson): Lesson => lesson;
