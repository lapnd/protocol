/**
 * Explainer Kit — public API.
 *
 * Content authors only need: types, defineExplainer / defineLesson.
 * Pages use: ExplainerApp, Hub, catalogEntryFor, assertValidExplainer.
 */
export * from "./types";
export * from "./define";
export * from "./text";
export * from "./frame";
export * from "./validate";
export * from "./catalog";
export { THEME_INIT_SCRIPT } from "./theme";
export { ExplainerApp, type ExplainerAppProps } from "./components/ExplainerApp";
export { Hub, type HubProps } from "./components/Hub";
export { Markdown } from "./components/Markdown";
export { LocaleProvider, useLocale } from "./locale";
export type { VisualProps, CustomVisualComponent, CustomVisualRegistry } from "./visuals/types";
