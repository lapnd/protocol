"use client";

import { useLocale } from "../locale";
import type { Explainer, Lesson } from "../types";

/** Sidebar: lessons (optionally grouped) and the active lesson's steps. */
export function LessonNav({
  explainer,
  activeId,
  index,
  progress,
  onSelect,
  onJump,
}: {
  explainer: Explainer;
  activeId: string;
  index: number;
  progress: Record<string, number>;
  onSelect: (lessonId: string) => void;
  onJump: (stepIndex: number) => void;
}) {
  const { t, u } = useLocale();
  const sections: Array<{ id: string; title?: string; lessons: Lesson[] }> = [];
  if (explainer.groups?.length) {
    for (const g of explainer.groups) {
      sections.push({
        id: g.id,
        title: t(g.title),
        lessons: explainer.lessons.filter((l) => l.group === g.id),
      });
    }
    const loose = explainer.lessons.filter((l) => !l.group);
    if (loose.length) sections.push({ id: "_", lessons: loose });
  } else {
    sections.push({ id: "_", lessons: explainer.lessons });
  }

  let number = 0;
  return (
    <nav className="ex-lessons" aria-label={u("lessons")}>
      {sections.map((section) => (
        <section key={section.id}>
          <h3 className="ex-panel-title">{section.title ?? u("lessons")}</h3>
          <ol>
            {section.lessons.map((lesson) => {
              number += 1;
              const reached = progress[lesson.id] ?? 0;
              const total = lesson.steps.length;
              const status = reached >= total ? "done" : reached > 0 ? "progress" : "new";
              const active = lesson.id === activeId;
              return (
                <li key={lesson.id} className={active ? "is-active" : undefined}>
                  <button
                    type="button"
                    className="ex-lesson-btn"
                    aria-current={active ? "true" : undefined}
                    onClick={() => onSelect(lesson.id)}
                  >
                    <span className={`ex-status is-${status}`} aria-hidden="true">
                      {status === "done" ? "✓" : lesson.icon ?? number}
                    </span>
                    <span className="ex-lesson-text">
                      <strong>{t(lesson.title)}</strong>
                      <small>
                        {total} {u("stepsCount")}
                        {lesson.minutes ? ` · ${lesson.minutes} ${u("minutes")}` : ""}
                        {lesson.level ? ` · ${u(lesson.level)}` : ""}
                      </small>
                    </span>
                  </button>
                  {active && (
                    <ol className="ex-step-list">
                      {lesson.steps.map((s, i) => (
                        <li key={i}>
                          <button
                            type="button"
                            className={i === index ? "is-active" : i < index ? "is-done" : undefined}
                            onClick={() => onJump(i)}
                          >
                            <span className="ex-step-no">{i + 1}</span>
                            {t(s.title)}
                          </button>
                        </li>
                      ))}
                    </ol>
                  )}
                </li>
              );
            })}
          </ol>
        </section>
      ))}
    </nav>
  );
}
