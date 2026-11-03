/**
 * The explainer registry: every system shown in the hub and the menu.
 *
 * - Kit explainers are pure data (src/explainers/<id>/index.ts) and get a
 *   page at /<id>/ automatically.
 * - Custom systems bring their own app and route (e.g. /protocol) and only
 *   register a catalog entry here.
 *
 * `npm run new:explainer -- <id>` adds new entries at the markers below.
 */
import { type CatalogEntry, catalogEntryFor } from "../kit/catalog";
import type { Explainer } from "../kit/types";
import compoundInterest from "./compound-interest";
import git from "./git";
import { protocolCatalogEntry } from "./protocol/manifest";
// @explainer-imports

export const KIT_EXPLAINERS: Explainer[] = [
  git,
  compoundInterest,
  // @explainer-list
];

export const CUSTOM_SYSTEMS: CatalogEntry[] = [protocolCatalogEntry];

/** Hub and menu order. Drafts are hidden from the hub in production. */
export const CATALOG: CatalogEntry[] = [
  ...CUSTOM_SYSTEMS,
  ...KIT_EXPLAINERS.map(catalogEntryFor),
].filter(
  (entry) => entry.meta.status !== "draft" || process.env.NODE_ENV !== "production",
);

export function getExplainer(id: string): Explainer | undefined {
  return KIT_EXPLAINERS.find((e) => e.id === id);
}
