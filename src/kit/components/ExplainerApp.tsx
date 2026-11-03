"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { CatalogEntry } from "../catalog";
import { resolveFrame } from "../frame";
import { LocaleProvider, useLocale } from "../locale";
import { readProgress, recordProgress } from "../storage";
import type { Explainer } from "../types";
import { usePlayer } from "../usePlayer";
import { Stage } from "../visuals/Stage";
import type { CustomVisualRegistry } from "../visuals/types";
import { Brand, LocaleSwitch, SystemMenu, ThemeToggle, type SiteInfo } from "./Chrome";
import { Controls } from "./Controls";
import { LessonNav } from "./LessonNav";
import { Narration } from "./Narration";
import { Markdown } from "./Markdown";

export interface ExplainerAppProps {
  explainer: Explainer;
  catalog: CatalogEntry[];
  site: SiteInfo;
  customVisuals?: CustomVisualRegistry;
}

/** A complete, playable explainer page. Content in, interactive app out. */
export function ExplainerApp(props: ExplainerAppProps) {
  return (
    <LocaleProvider locales={props.explainer.locales}>
      <ExplainerShell {...props} />
    </LocaleProvider>
  );
}

function ExplainerShell({ explainer, catalog, site, customVisuals }: ExplainerAppProps) {
  const { t, u } = useLocale();
  const [lessonId, setLessonId] = useState(explainer.lessons[0].id);
  const [drawer, setDrawer] = useState(false);
  const [progress, setProgress] = useState<Record<string, number>>({});

  const lessonIndex = Math.max(0, explainer.lessons.findIndex((l) => l.id === lessonId));
  const lesson = explainer.lessons[lessonIndex];
  const nextLesson = explainer.lessons[lessonIndex + 1];

  useEffect(() => {
    setProgress(readProgress()[explainer.id] ?? {});
    const fromHash = decodeURIComponent(location.hash.slice(1));
    if (explainer.lessons.some((l) => l.id === fromHash)) setLessonId(fromHash);
  }, [explainer]);

  const onReach = useCallback(
    (i: number) => {
      const reached = Math.min(i + 1, lesson.steps.length);
      if (recordProgress(explainer.id, lesson.id, reached)) {
        setProgress(readProgress()[explainer.id] ?? {});
      }
    },
    [explainer.id, lesson],
  );

  const player = usePlayer(lesson, t, onReach);
  const frame = useMemo(() => resolveFrame(lesson, player.index), [lesson, player.index]);

  const selectLesson = useCallback(
    (id: string) => {
      if (id === lessonId) {
        player.reset();
      } else {
        setLessonId(id);
        history.replaceState(null, "", `#${id}`);
      }
      setDrawer(false);
    },
    [lessonId, player],
  );

  useEffect(() => {
    const onKey = (ev: KeyboardEvent) => {
      if (ev.ctrlKey || ev.metaKey || ev.altKey) return;
      const target = ev.target as HTMLElement | null;
      if (target?.closest("input, textarea, select, [contenteditable='true']")) return;
      const onControl = Boolean(target?.closest("button, a, summary"));
      const rtl = document.documentElement.dir === "rtl";
      const actions: Record<string, () => void> = {
        ArrowRight: rtl ? player.prev : player.next,
        ArrowLeft: rtl ? player.next : player.prev,
        Escape: () => (drawer ? setDrawer(false) : player.reset()),
      };
      if (!onControl) actions[" "] = player.toggle;
      const action = actions[ev.key];
      if (!action) return;
      ev.preventDefault();
      action();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [player, drawer]);

  return (
    <div className={`ex-root ex-app ex-tone-${explainer.accent ?? "blue"} ${drawer ? "is-drawer-open" : ""}`}>
      <header className="ex-topbar">
        <button
          type="button"
          className="ex-icon-btn ex-drawer-btn"
          aria-label={u("menu")}
          aria-expanded={drawer}
          onClick={() => setDrawer((d) => !d)}
        >
          ☰
        </button>
        <Brand site={site} />
        <span className="ex-sep" aria-hidden="true" />
        <SystemMenu catalog={catalog} currentId={explainer.id} />
        <div className="ex-topbar-now">
          <span>{u("lesson")} {lessonIndex + 1}</span>
          <strong>{t(lesson.title)}</strong>
        </div>
        <div className="ex-topbar-tools">
          <LocaleSwitch />
          <ThemeToggle />
        </div>
      </header>

      <aside className="ex-sidebar" aria-label={u("lessons")}>
        <div className="ex-sidebar-head">
          <span className="ex-explainer-icon">{explainer.icon}</span>
          <div>
            <h1>{t(explainer.title)}</h1>
            {explainer.tagline && <p>{t(explainer.tagline)}</p>}
          </div>
          <button type="button" className="ex-icon-btn ex-drawer-close" aria-label={u("close")} onClick={() => setDrawer(false)}>
            ✕
          </button>
        </div>
        <LessonNav
          explainer={explainer}
          activeId={lesson.id}
          index={player.index}
          progress={progress}
          onSelect={selectLesson}
          onJump={(i) => {
            player.jump(i);
            setDrawer(false);
          }}
        />
        {explainer.glossary?.length ? (
          <details className="ex-glossary">
            <summary>{u("glossary")}</summary>
            <dl>
              {explainer.glossary.map((g, i) => (
                <div key={i}>
                  <dt>{t(g.term)}</dt>
                  <dd>
                    <Markdown text={t(g.definition)} inline />
                  </dd>
                </div>
              ))}
            </dl>
          </details>
        ) : null}
      </aside>

      <main className="ex-main">
        <div className="ex-lesson-head">
          <h2>{t(lesson.title)}</h2>
          <p>{t(lesson.summary)}</p>
        </div>
        <section className={`ex-stage is-${frame.visual.type}`} aria-live="polite">
          <Stage frame={frame} t={t} speed={player.speed} customVisuals={customVisuals} />
        </section>
        {lesson.legend?.length ? (
          <ul className="ex-legend" aria-label={u("legend")}>
            {lesson.legend.map((l, i) => (
              <li key={i} className={`ex-tone-${l.tone}`}>
                <i />
                {t(l.label)}
              </li>
            ))}
          </ul>
        ) : null}
        <Controls player={player} total={lesson.steps.length} />
      </main>

      <aside className="ex-side">
        <Narration
          lesson={lesson}
          index={player.index}
          onStart={player.play}
          hasNextLesson={Boolean(nextLesson)}
          onNextLesson={() => nextLesson && selectLesson(nextLesson.id)}
        />
      </aside>

      <div className="ex-scrim" aria-hidden="true" onClick={() => setDrawer(false)} />
    </div>
  );
}
