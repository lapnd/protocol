"use client";

import { emphasisClass, isVisible, parseLineRanges } from "../frame";
import { Markdown } from "../components/Markdown";
import type { CardsVisual, ChartVisual, CodeVisual, TableVisual } from "../types";
import type { VisualProps } from "./types";

export function CodeView({ visual, frame, t }: VisualProps<CodeVisual>) {
  const code = (frame.code ?? visual.code).replace(/\n$/, "");
  const lines = code.split("\n");
  const marked = parseLineRanges(frame.current.lines);
  return (
    <figure className="ex-code">
      {(visual.title || visual.language) && (
        <figcaption>
          <span>{t(visual.title)}</span>
          {visual.language && <span className="ex-code-lang">{visual.language}</span>}
        </figcaption>
      )}
      <pre className={marked.size ? "has-marks" : undefined}>
        {lines.map((line, i) => (
          <span key={i} className={`ex-code-line ${marked.has(i + 1) ? "is-hl" : ""}`}>
            <span className="ex-code-no">{i + 1}</span>
            <code>{line || " "}</code>
          </span>
        ))}
      </pre>
    </figure>
  );
}

export function TableView({ visual, frame, t }: VisualProps<TableVisual>) {
  const marked = new Set(frame.current.rows ?? []);
  return (
    <figure className="ex-table">
      {visual.title && <figcaption>{t(visual.title)}</figcaption>}
      <div className="ex-table-scroll">
        <table>
          <thead>
            <tr>
              {visual.columns.map((c, i) => (
                <th key={i}>{t(c)}</th>
              ))}
            </tr>
          </thead>
          <tbody className={marked.size ? "has-marks" : undefined}>
            {visual.rows.map((row, ri) => (
              <tr key={ri} className={marked.has(ri) ? "is-hl" : undefined}>
                {row.map((cell, ci) => (
                  <td key={ci}>
                    <Markdown text={t(cell)} inline />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </figure>
  );
}

export function ChartView({ visual, frame, t }: VisualProps<ChartVisual>) {
  const bars = visual.bars.map((b) => ({ ...b, value: frame.values[b.id] ?? b.value }));
  const max = visual.max ?? Math.max(1, ...bars.map((b) => b.value));
  return (
    <figure className="ex-chart">
      {visual.title && <figcaption>{t(visual.title)}</figcaption>}
      <ul>
        {bars.map((b) => (
          <li key={b.id} className={`ex-tone-${b.tone ?? "blue"} ${emphasisClass(frame, b.id)}`}>
            <span className="ex-chart-label">{t(b.label)}</span>
            <span className="ex-chart-track">
              <span
                className="ex-chart-bar"
                style={{ width: `${Math.max(0, Math.min(100, (b.value / max) * 100))}%` }}
              />
            </span>
            <span className="ex-chart-value">
              {b.value.toLocaleString()}
              {visual.unit ? ` ${visual.unit}` : ""}
            </span>
          </li>
        ))}
      </ul>
    </figure>
  );
}

export function CardsView({ visual, frame, t }: VisualProps<CardsVisual>) {
  return (
    <div
      className="ex-cards"
      style={{ "--ex-cols": visual.columns ?? Math.min(3, visual.items.length) } as React.CSSProperties}
    >
      {visual.items.map((c) => (
        <article
          key={c.id}
          className={`ex-card ex-tone-${c.tone ?? "blue"} ${emphasisClass(frame, c.id)} ${
            isVisible(frame, c.id, c.hidden) ? "" : "is-hidden"
          }`}
        >
          <h4>
            {c.icon && <span className="ex-card-icon">{c.icon}</span>}
            {t(c.title)}
          </h4>
          {c.body && <Markdown text={t(c.body)} />}
        </article>
      ))}
    </div>
  );
}
