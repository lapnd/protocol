"use client";

import { useEffect, useRef, useState } from "react";
import { type CatalogEntry, withBase } from "../catalog";
import { useLocale } from "../locale";
import { applyTheme, currentTheme, type ThemeName } from "../theme";
import { LOCALE_NAMES } from "../ui-strings";

export interface SiteInfo {
  name: string;
  icon?: string;
}

/** Brand link back to the hub. */
export function Brand({ site }: { site: SiteInfo }) {
  return (
    <a className="ex-brand" href={withBase("/")}>
      <span className="ex-brand-mark" aria-hidden="true">
        {site.icon ?? "◆"}
      </span>
      <span className="ex-brand-name">
        <SiteName name={site.name} />
      </span>
    </a>
  );
}

/** "Explainer Lab" → "EXPLAINER *LAB*", echoing "PROTOCOL *EXPLORER*". */
export function SiteName({ name }: { name: string }) {
  const cut = name.lastIndexOf(" ");
  if (cut < 0) return <>{name}</>;
  return (
    <>
      {name.slice(0, cut)} <em>{name.slice(cut + 1)}</em>
    </>
  );
}

/**
 * Dropdown listing every explainer ("system") in the catalog. Uses plain
 * links: custom systems ship their own global styles, so a full page load
 * keeps them isolated.
 */
export function SystemMenu({
  catalog,
  currentId,
}: {
  catalog: CatalogEntry[];
  currentId?: string;
}) {
  const { t, u } = useLocale();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const current = catalog.find((c) => c.meta.id === currentId);

  useEffect(() => {
    if (!open) return;
    const onDown = (ev: MouseEvent) => {
      if (!ref.current?.contains(ev.target as Node)) setOpen(false);
    };
    const onKey = (ev: KeyboardEvent) => ev.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div className="ex-sysmenu" ref={ref}>
      <button
        type="button"
        className="ex-sysmenu-btn"
        aria-expanded={open}
        aria-haspopup="menu"
        onClick={() => setOpen((o) => !o)}
      >
        <span className="ex-sysmenu-icon">{current?.meta.icon ?? "☰"}</span>
        <span className="ex-sysmenu-title">
          {current ? t(current.meta.title) : u("explainers")}
        </span>
        <span className="ex-caret" aria-hidden="true">▾</span>
      </button>
      {open && (
        <div className="ex-sysmenu-pop" role="menu">
          <a className="ex-sysmenu-item is-all" href={withBase("/")} role="menuitem">
            <span className="ex-sysmenu-icon">⌂</span>
            <span>
              <strong>{u("allExplainers")}</strong>
            </span>
          </a>
          {catalog.map((c) => (
            <a
              key={c.meta.id}
              className={`ex-sysmenu-item ex-tone-${c.meta.accent ?? "blue"} ${
                c.meta.id === currentId ? "is-current" : ""
              }`}
              href={withBase(c.href)}
              role="menuitem"
              aria-current={c.meta.id === currentId ? "page" : undefined}
            >
              <span className="ex-sysmenu-icon">{c.meta.icon ?? "◆"}</span>
              <span>
                <strong>{t(c.meta.title)}</strong>
                <small>
                  {c.lessonCount} {u("lessonsCount")}
                  {c.kind === "custom" ? ` · ${u("custom")}` : ""}
                </small>
              </span>
            </a>
          ))}
        </div>
      )}
    </div>
  );
}

export function LocaleSwitch() {
  const { locale, locales, setLocale, u } = useLocale();
  if (locales.length < 2) return null;
  return (
    <div className="ex-seg" role="group" aria-label={u("language")}>
      {locales.map((code) => (
        <button
          key={code}
          type="button"
          className={code === locale ? "is-active" : undefined}
          aria-pressed={code === locale}
          title={LOCALE_NAMES[code] ?? code}
          onClick={() => setLocale(code)}
        >
          {code.toUpperCase()}
        </button>
      ))}
    </div>
  );
}

export function ThemeToggle() {
  const { u } = useLocale();
  const [theme, setTheme] = useState<ThemeName>("light");
  useEffect(() => setTheme(currentTheme()), []);
  const next: ThemeName = theme === "dark" ? "light" : "dark";
  return (
    <button
      type="button"
      className="ex-icon-btn"
      aria-label={`${u("theme")}: ${u(next)}`}
      title={`${u("theme")}: ${u(next)}`}
      onClick={() => {
        applyTheme(next);
        setTheme(next);
      }}
    >
      {theme === "dark" ? "☀" : "☾"}
    </button>
  );
}
