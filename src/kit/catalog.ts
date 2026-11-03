import type { Explainer, ExplainerMeta } from "./types";

/**
 * One entry in the site menu / hub. Kit explainers are built from data;
 * custom systems (e.g. Protocol Explorer) bring their own app and only
 * provide metadata and a link.
 */
export interface CatalogEntry {
  meta: ExplainerMeta;
  kind: "kit" | "custom";
  /** Path relative to the site root, e.g. "/git/". */
  href: string;
  lessonCount: number;
  stepCount: number;
}

export function catalogEntryFor(explainer: Explainer): CatalogEntry {
  const { lessons, groups, glossary, ...meta } = explainer;
  void groups;
  void glossary;
  return {
    meta,
    kind: "kit",
    href: `/${explainer.id}/`,
    lessonCount: lessons.length,
    stepCount: lessons.reduce((n, l) => n + l.steps.length, 0),
  };
}

/** Prefix an internal path with the deploy base path (GitHub Pages). */
export function withBase(path: string): string {
  const base = process.env.NEXT_PUBLIC_BASE_PATH || "";
  return `${base}${path}`;
}
