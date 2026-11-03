import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CATALOG, KIT_EXPLAINERS, getExplainer } from "../../explainers";
import { tx } from "../../kit/text";
import { assertValidExplainer, validateExplainer } from "../../kit/validate";
import { SITE } from "../../site.config";
import ExplainerClient from "./ExplainerClient";

export const dynamicParams = false;

/** One static page per kit explainer. Invalid content fails the build. */
export function generateStaticParams() {
  for (const explainer of KIT_EXPLAINERS) {
    for (const issue of validateExplainer(explainer)) {
      if (issue.level === "warning") console.warn(`⚠ ${issue.where}: ${issue.message}`);
    }
    assertValidExplainer(explainer);
  }
  return KIT_EXPLAINERS.map((e) => ({ explainer: e.id }));
}

type Params = { params: Promise<{ explainer: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const explainer = getExplainer((await params).explainer);
  if (!explainer) return {};
  const locale = explainer.locales[0];
  return {
    title: tx(explainer.title, locale),
    description: tx(explainer.description, locale),
  };
}

export default async function ExplainerPage({ params }: Params) {
  const explainer = getExplainer((await params).explainer);
  if (!explainer) notFound();
  assertValidExplainer(explainer);
  return (
    <ExplainerClient
      explainer={explainer}
      catalog={CATALOG}
      site={{ name: SITE.name, icon: SITE.icon }}
    />
  );
}
