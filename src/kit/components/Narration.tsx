"use client";

import { useEffect, useState } from "react";
import { useLocale } from "../locale";
import type { Fact, Lesson, Quiz } from "../types";
import { Markdown } from "./Markdown";

export function Facts({ facts }: { facts?: Fact[] }) {
  const { t } = useLocale();
  if (!facts?.length) return null;
  return (
    <dl className="ex-facts">
      {facts.map(([k, v], i) => (
        <div key={i}>
          <dt>{t(k)}</dt>
          <dd>
            <Markdown text={t(v)} inline />
          </dd>
        </div>
      ))}
    </dl>
  );
}

function QuizBox({ quiz }: { quiz: Quiz }) {
  const { t, u } = useLocale();
  const [picked, setPicked] = useState<number | null>(null);
  useEffect(() => setPicked(null), [quiz]);
  const correct = picked === quiz.answer;
  return (
    <section className="ex-quiz">
      <h4>{u("quiz")}</h4>
      <p className="ex-quiz-q">
        <Markdown text={t(quiz.question)} inline />
      </p>
      <div className="ex-quiz-options">
        {quiz.options.map((opt, i) => (
          <button
            key={i}
            type="button"
            className={
              picked === i ? (i === quiz.answer ? "is-right" : "is-wrong") : undefined
            }
            onClick={() => setPicked(i)}
          >
            <Markdown text={t(opt)} inline />
          </button>
        ))}
      </div>
      {picked !== null && (
        <p className={`ex-quiz-result ${correct ? "is-right" : "is-wrong"}`} role="status">
          {correct ? u("correct") : u("tryAgain")}
          {correct && quiz.explain && (
            <>
              {" "}
              <Markdown text={t(quiz.explain)} inline />
            </>
          )}
        </p>
      )}
    </section>
  );
}

/** Right-hand panel: overview, the current step's narration, or the outro. */
export function Narration({
  lesson,
  index,
  onStart,
  onNextLesson,
  hasNextLesson,
}: {
  lesson: Lesson;
  index: number;
  onStart: () => void;
  onNextLesson: () => void;
  hasNextLesson: boolean;
}) {
  const { t, u } = useLocale();
  const total = lesson.steps.length;

  if (index < 0) {
    return (
      <div className="ex-narration" key={`intro-${lesson.id}`}>
        <p className="ex-kicker">{u("overview")}</p>
        <h2>{t(lesson.title)}</h2>
        <div className="ex-prose">
          <Markdown text={t(lesson.intro?.body ?? lesson.summary)} />
        </div>
        <Facts facts={lesson.intro?.facts} />
        <button type="button" className="ex-primary" onClick={onStart}>
          ▶ {u("start")}
        </button>
        <p className="ex-hint">{u("keyboardHint")}</p>
      </div>
    );
  }

  if (index >= total) {
    const outro = lesson.outro;
    return (
      <div className="ex-narration" key={`outro-${lesson.id}`}>
        <p className="ex-kicker is-done">✓ {u("done")}</p>
        <h2>{t(outro?.title ?? lesson.title)}</h2>
        <div className="ex-prose">
          <Markdown text={t(outro?.body ?? lesson.summary)} />
        </div>
        <Facts facts={outro?.facts} />
        {hasNextLesson && (
          <button type="button" className="ex-primary" onClick={onNextLesson}>
            {u("nextLesson")} →
          </button>
        )}
        {lesson.sources?.length ? (
          <div className="ex-sources">
            <h4>{u("sources")}</h4>
            <ul>
              {lesson.sources.map((s, i) => (
                <li key={i}>
                  {s.url ? (
                    <a href={s.url} target="_blank" rel="noreferrer">
                      {s.title}
                    </a>
                  ) : (
                    s.title
                  )}
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>
    );
  }

  const step = lesson.steps[index];
  return (
    <div className="ex-narration" key={`${lesson.id}-${index}`}>
      <p className="ex-kicker">
        {u("step")} {index + 1} {u("of")} {total}
      </p>
      <h2>{t(step.title)}</h2>
      <div className="ex-prose">
        <Markdown text={t(step.body)} />
      </div>
      {step.detail && (
        <details className="ex-detail">
          <summary>{u("goDeeper")}</summary>
          <div className="ex-prose">
            <Markdown text={t(step.detail)} />
          </div>
        </details>
      )}
      <Facts facts={step.facts} />
      {step.quiz && <QuizBox quiz={step.quiz} />}
    </div>
  );
}
