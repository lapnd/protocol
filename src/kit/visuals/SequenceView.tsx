"use client";

import { useEffect, useRef } from "react";
import { emphasisClass } from "../frame";
import type { SequenceVisual } from "../types";
import type { VisualProps } from "./types";

const HEAD_H = 64;
const ROW_H = 56;
const TOP = HEAD_H + 34;

export function SequenceView({ visual, frame, t }: VisualProps<SequenceVisual>) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const actors = visual.actors;
  const colW = Math.max(150, Math.min(220, 800 / actors.length));
  const width = colW * actors.length;
  const xOf = new Map(actors.map((a, i) => [a.id, colW * i + colW / 2]));
  const rows = frame.messages.length;
  const height = TOP + Math.max(rows, 4) * ROW_H + 24;

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
  }, [rows, frame.stepIndex]);

  return (
    <div className="ex-sequence" ref={scrollRef}>
      <svg className="ex-seq-head" viewBox={`0 0 ${width} ${HEAD_H}`} width="100%" aria-hidden="true">
        {actors.map((a) => {
          const x = xOf.get(a.id)!;
          return (
            <g key={a.id} className={`ex-actor ex-tone-${a.tone ?? "blue"} ${emphasisClass(frame, a.id)}`}>
              <rect x={x - colW / 2 + 12} y={8} width={colW - 24} height={HEAD_H - 16} rx={10} />
              <foreignObject x={x - colW / 2 + 12} y={8} width={colW - 24} height={HEAD_H - 16}>
                <div className="ex-node-body">
                  <span className="ex-node-label">
                    {a.icon && <span className="ex-node-icon">{a.icon}</span>}
                    {t(a.label)}
                  </span>
                </div>
              </foreignObject>
            </g>
          );
        })}
      </svg>
      <svg viewBox={`0 ${HEAD_H} ${width} ${height - HEAD_H}`} width="100%" role="img">
        {actors.map((a) => {
          const x = xOf.get(a.id)!;
          return (
            <line key={a.id} className={`ex-lifeline ${emphasisClass(frame, a.id)}`} x1={x} x2={x} y1={HEAD_H} y2={height - 8} />
          );
        })}

        {frame.messages.map((m, i) => {
          const x1 = xOf.get(m.from) ?? 0;
          const x2 = xOf.get(m.to) ?? 0;
          const y = TOP + i * ROW_H;
          const isCurrent = m.step === frame.stepIndex;
          const self = x1 === x2;
          const dir = x2 >= x1 ? 1 : -1;
          const endX = m.lost ? x1 + (x2 - x1) * 0.62 : x2 - dir * 4;
          const d = self
            ? `M${x1},${y} h40 v18 h-36`
            : `M${x1},${y} L${endX},${y}`;
          const labelX = self ? x1 + 48 : (x1 + x2) / 2;
          return (
            <g
              key={`${m.step}-${i}`}
              className={`ex-msg ex-tone-${m.tone ?? "blue"} ${isCurrent ? "is-current" : "is-past"}`}
            >
              <path
                d={d}
                pathLength={m.dashed ? undefined : 1}
                className={m.dashed ? "is-dashed" : "is-solid"}
                strokeDasharray={m.dashed ? "6 5" : undefined}
              />
              {m.lost ? (
                <path
                  className="ex-msg-lost"
                  d={`M${endX - 7},${y - 7} l14,14 M${endX + 7},${y - 7} l-14,14`}
                />
              ) : (
                <path
                  className="ex-arrow"
                  d="M0,0 L-11,-5.5 L-11,5.5 Z"
                  transform={
                    self
                      ? `translate(${x1 + 4},${y + 18}) rotate(180)`
                      : `translate(${x2 - dir * 2},${y}) rotate(${dir > 0 ? 0 : 180})`
                  }
                />
              )}
              <text
                x={labelX}
                y={y - 8}
                textAnchor={self ? "start" : "middle"}
                className="ex-msg-label"
              >
                {t(m.label)}
              </text>
              {m.note && (
                <text
                  x={labelX}
                  y={y + 17}
                  textAnchor={self ? "start" : "middle"}
                  className="ex-msg-note"
                >
                  {t(m.note)}
                </text>
              )}
            </g>
          );
        })}

        {frame.current.notes?.map((note, i) => {
          const x = xOf.get(note.at);
          if (x == null) return null;
          const w = Math.min(colW + 40, 220);
          const y = TOP + Math.max(0, rows - 1) * ROW_H + 26;
          return (
            <foreignObject
              key={`note-${frame.stepIndex}-${i}`}
              x={Math.max(2, Math.min(width - w - 2, x - w / 2))}
              y={y}
              width={w}
              height={64}
            >
              <div className={`ex-note ex-tone-${note.tone ?? "amber"}`}>{t(note.text)}</div>
            </foreignObject>
          );
        })}
      </svg>
    </div>
  );
}
