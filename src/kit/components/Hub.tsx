"use client";

import { useEffect, useMemo, useState } from "react";
import { type CatalogEntry, withBase } from "../catalog";
import { LocaleProvider, useLocale } from "../locale";
import { readProgress } from "../storage";
import type { LocaleCode, Text } from "../types";
import { Brand, LocaleSwitch, SiteName, ThemeToggle, type SiteInfo } from "./Chrome";

export interface HubProps {
  site: SiteInfo & { tagline: Text; intro: Text; locales: LocaleCode[]; repoUrl?: string };
  catalog: CatalogEntry[];
}

/** The landing page: every explainer ("system") as a card. */
export function Hub(props: HubProps) {
  return (
    <LocaleProvider locales={props.site.locales}>
      <HubInner {...props} />
    </LocaleProvider>
  );
}

function HubInner({ site, catalog }: HubProps) {
  const { t, u } = useLocale();
  const [category, setCategory] = useState<string>("");
  const [progress, setProgress] = useState<Record<string, Record<string, number>>>({});
  useEffect(() => setProgress(readProgress()), []);

  const categories = useMemo(() => {
    const seen = new Map<string, string>();
    for (const c of catalog) {
      if (c.meta.category) seen.set(t(c.meta.category), t(c.meta.category));
    }
    return [...seen.keys()];
  }, [catalog, t]);

  const shown = catalog.filter((c) => !category || t(c.meta.category) === category);

  return (
    <div className="ex-root ex-hub">
      <header className="ex-topbar">
        <Brand site={site} />
        <div className="ex-topbar-tools">
          <LocaleSwitch />
          <ThemeToggle />
        </div>
      </header>

      <section className="ex-hero">
        <h1>
          <SiteName name={site.name} />
        </h1>
        <p className="ex-hero-tagline">{t(site.tagline)}</p>
        <p className="ex-hero-intro">{t(site.intro)}</p>
      </section>

      {categories.length > 1 && (
        <div className="ex-filter" role="group">
          <button type="button" className={!category ? "is-active" : undefined} onClick={() => setCategory("")}>
            {u("all")}
          </button>
          {categories.map((c) => (
            <button key={c} type="button" className={category === c ? "is-active" : undefined} onClick={() => setCategory(c)}>
              {c}
            </button>
          ))}
        </div>
      )}

      <ul className="ex-grid">
        {shown.map((c) => {
          const done = Object.values(progress[c.meta.id] ?? {}).reduce((a, b) => a + b, 0);
          const pct = c.stepCount ? Math.min(100, Math.round((done / c.stepCount) * 100)) : 0;
          return (
            <li key={c.meta.id}>
              <a className={`ex-tile ex-tone-${c.meta.accent ?? "blue"}`} href={withBase(c.href)}>
                <span className="ex-tile-icon" aria-hidden="true">
                  {c.meta.icon ?? "◆"}
                </span>
                <span className="ex-tile-badges">
                  {c.meta.category && <span>{t(c.meta.category)}</span>}
                  {c.kind === "custom" && <span>{u("custom")}</span>}
                  {c.meta.status && c.meta.status !== "stable" && <span>{u(c.meta.status)}</span>}
                </span>
                <h2>{t(c.meta.title)}</h2>
                {c.meta.tagline && <p className="ex-tile-tagline">{t(c.meta.tagline)}</p>}
                <p className="ex-tile-desc">{t(c.meta.description)}</p>
                <span className="ex-tile-foot">
                  <span>
                    {c.lessonCount} {u("lessonsCount")}
                    {c.kind === "kit" ? ` · ${c.stepCount} ${u("stepsCount")}` : ""}
                    {" · "}
                    {c.meta.locales.map((l) => l.toUpperCase()).join(" ")}
                  </span>
                  <span className="ex-tile-cta">{u("explore")} →</span>
                </span>
                {c.kind === "kit" && pct > 0 && (
                  <span className="ex-tile-progress" aria-label={`${u("progress")} ${pct}%`}>
                    <i style={{ width: `${pct}%` }} />
                  </span>
                )}
              </a>
            </li>
          );
        })}
      </ul>

      <footer className="ex-footer">
        <span>{site.name}</span>
        {site.repoUrl && (
          <a href={site.repoUrl} target="_blank" rel="noreferrer">
            GitHub
          </a>
        )}
      </footer>
    </div>
  );
}
