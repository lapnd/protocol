"use client";

import { useEffect, useRef } from "react";
import { emphasisClass, isVisible, type Frame } from "../frame";
import type {
  DiagramEdge,
  DiagramNode,
  DiagramVisual,
  NodeShape,
  Tone,
} from "../types";
import type { VisualProps } from "./types";

type Pt = { x: number; y: number };

const SIZE: Record<NodeShape, [number, number]> = {
  box: [150, 60],
  round: [150, 60],
  pill: [150, 44],
  circle: [76, 76],
  db: [120, 72],
  doc: [120, 76],
};

interface Placed extends DiagramNode {
  w: number;
  h: number;
}

function place(node: DiagramNode, frame: Frame): Placed {
  const patched = { ...node, ...frame.updates[node.id] };
  const [w, h] = SIZE[patched.shape ?? "box"];
  return { ...patched, w: node.w ?? w, h: node.h ?? h };
}

/** Point where the ray from the node center towards `toward` leaves the node. */
function boundary(n: Placed, toward: Pt, pad = 6): Pt {
  const dx = toward.x - n.x;
  const dy = toward.y - n.y;
  if (!dx && !dy) return { x: n.x, y: n.y };
  const hw = n.w / 2 + pad;
  const hh = n.h / 2 + pad;
  const scale = Math.min(
    dx ? hw / Math.abs(dx) : Infinity,
    dy ? hh / Math.abs(dy) : Infinity,
  );
  return { x: n.x + dx * scale, y: n.y + dy * scale };
}

interface Geometry {
  d: string;
  mid: Pt;
  end: Pt;
  /** Direction of travel at the end, for the arrow head. */
  angle: number;
}

function geometry(a: Placed, b: Placed, curve = 0): Geometry {
  const mx = (a.x + b.x) / 2;
  const my = (a.y + b.y) / 2;
  const len = Math.hypot(b.x - a.x, b.y - a.y) || 1;
  const ctrl = {
    x: mx + (-(b.y - a.y) / len) * curve,
    y: my + ((b.x - a.x) / len) * curve,
  };
  const p1 = boundary(a, curve ? ctrl : b);
  const p2 = boundary(b, curve ? ctrl : a);
  const d = curve
    ? `M${p1.x},${p1.y} Q${ctrl.x},${ctrl.y} ${p2.x},${p2.y}`
    : `M${p1.x},${p1.y} L${p2.x},${p2.y}`;
  const mid = curve
    ? {
        x: 0.25 * p1.x + 0.5 * ctrl.x + 0.25 * p2.x,
        y: 0.25 * p1.y + 0.5 * ctrl.y + 0.25 * p2.y,
      }
    : { x: (p1.x + p2.x) / 2, y: (p1.y + p2.y) / 2 };
  const from = curve ? ctrl : p1;
  const angle = Math.atan2(p2.y - from.y, p2.x - from.x);
  return { d, mid, end: p2, angle };
}

const toneVar = (tone: Tone | undefined, fallback: Tone = "slate") =>
  `ex-tone-${tone ?? fallback}`;

export function DiagramView({ visual, frame, t, speed }: VisualProps<DiagramVisual>) {
  const width = visual.width ?? 800;
  const height = visual.height ?? 450;
  const nodes = new Map(visual.nodes.map((n) => [n.id, place(n, frame)]));
  const visibleNode = (id: string) => {
    const n = nodes.get(id);
    return Boolean(n && isVisible(frame, id, n.hidden));
  };
  const edgeVisible = (e: DiagramEdge) =>
    isVisible(frame, e.id, e.hidden) && visibleNode(e.from) && visibleNode(e.to);

  const findEdge = (from: string, to: string) =>
    visual.edges?.find(
      (e) => (e.from === from && e.to === to) || (e.from === to && e.to === from),
    );

  return (
    <svg
      className="ex-diagram"
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="xMidYMid meet"
      role="img"
    >
      {visual.groups?.map((g) => (
        <g
          key={g.id}
          className={`ex-group ${toneVar(g.tone)} ${emphasisClass(frame, g.id)} ${
            isVisible(frame, g.id, g.hidden) ? "" : "is-hidden"
          }`}
        >
          <rect x={g.x} y={g.y} width={g.w} height={g.h} rx={14} />
          <text x={g.x + 14} y={g.y + 22}>
            {t(g.label)}
          </text>
        </g>
      ))}

      {visual.edges?.map((e, i) => {
        const a = nodes.get(e.from);
        const b = nodes.get(e.to);
        if (!a || !b) return null;
        const geo = geometry(a, b, e.curve);
        const directed = e.directed !== false;
        return (
          <g
            key={e.id ?? `${e.from}-${e.to}-${i}`}
            className={`ex-edge ${toneVar(e.tone)} ${emphasisClass(frame, e.id)} ${
              edgeVisible(e) ? "" : "is-hidden"
            }`}
          >
            <path d={geo.d} strokeDasharray={e.dashed ? "6 6" : undefined} />
            {directed && <Arrow at={geo.end} angle={geo.angle} />}
            {e.label && (
              <text x={geo.mid.x} y={geo.mid.y - 8} textAnchor="middle" className="ex-edge-label">
                {t(e.label)}
              </text>
            )}
          </g>
        );
      })}

      {[...nodes.values()].map((n) => (
        <g
          key={n.id}
          className={`ex-node ${toneVar(n.tone, "blue")} ${emphasisClass(frame, n.id)} ${
            visibleNode(n.id) ? "" : "is-hidden"
          }`}
          style={{ transform: `translate(${n.x}px, ${n.y}px)` }}
        >
          <NodeShapePath shape={n.shape ?? "box"} w={n.w} h={n.h} />
          <foreignObject x={-n.w / 2} y={-n.h / 2} width={n.w} height={n.h}>
            <div className="ex-node-body">
              <span className="ex-node-label">
                {n.icon && <span className="ex-node-icon">{n.icon}</span>}
                {t(n.label)}
              </span>
              {n.sublabel && <span className="ex-node-sub">{t(n.sublabel)}</span>}
            </div>
          </foreignObject>
        </g>
      ))}

      {frame.current.flows?.map((f, i) => {
        const a = nodes.get(f.from);
        const b = nodes.get(f.to);
        if (!a || !b) return null;
        const edge = findEdge(f.from, f.to);
        const curve = edge ? (edge.from === f.from ? (edge.curve ?? 0) : -(edge.curve ?? 0)) : 0;
        const geo = geometry(a, b, curve);
        return (
          <FlowToken
            key={`${frame.stepIndex}-${i}`}
            d={geo.d}
            label={t(f.label)}
            tone={f.tone ?? "amber"}
            delayMs={(i * 350) / speed}
            durationMs={1500 / speed}
          />
        );
      })}

      {frame.current.notes?.map((note, i) => {
        const n = nodes.get(note.at);
        if (!n) return null;
        const w = 200;
        const above = n.y - n.h / 2 > 90;
        return (
          <foreignObject
            key={`${frame.stepIndex}-note-${i}`}
            x={Math.max(4, Math.min(width - w - 4, n.x - w / 2))}
            y={above ? n.y - n.h / 2 - 78 : n.y + n.h / 2 + 10}
            width={w}
            height={70}
            className="ex-note-fo"
          >
            <div className={`ex-note ${toneVar(note.tone, "amber")} ${above ? "is-above" : "is-below"}`}>
              {t(note.text)}
            </div>
          </foreignObject>
        );
      })}
    </svg>
  );
}

function Arrow({ at, angle }: { at: Pt; angle: number }) {
  const deg = (angle * 180) / Math.PI;
  return (
    <path
      className="ex-arrow"
      d="M0,0 L-11,-5.5 L-11,5.5 Z"
      transform={`translate(${at.x},${at.y}) rotate(${deg})`}
    />
  );
}

function NodeShapePath({ shape, w, h }: { shape: NodeShape; w: number; h: number }) {
  const x = -w / 2;
  const y = -h / 2;
  switch (shape) {
    case "circle":
      return <ellipse className="ex-node-shape" rx={w / 2} ry={h / 2} />;
    case "pill":
      return <rect className="ex-node-shape" x={x} y={y} width={w} height={h} rx={h / 2} />;
    case "round":
      return <rect className="ex-node-shape" x={x} y={y} width={w} height={h} rx={18} />;
    case "db": {
      const ry = 9;
      return (
        <g className="ex-node-shape">
          <path
            d={`M${x},${y + ry} A${w / 2},${ry} 0 0 1 ${-x},${y + ry} V${-y - ry} A${w / 2},${ry} 0 0 1 ${x},${-y - ry} Z`}
          />
          <path d={`M${x},${y + ry} A${w / 2},${ry} 0 0 0 ${-x},${y + ry}`} fill="none" />
        </g>
      );
    }
    case "doc": {
      const f = 16;
      return (
        <path
          className="ex-node-shape"
          d={`M${x},${y} H${-x - f} L${-x},${y + f} V${-y} H${x} Z`}
        />
      );
    }
    default:
      return <rect className="ex-node-shape" x={x} y={y} width={w} height={h} rx={8} />;
  }
}

/** A labelled dot that travels along a path, then waits and repeats. */
function FlowToken({
  d,
  label,
  tone,
  delayMs,
  durationMs,
}: {
  d: string;
  label: string;
  tone: Tone;
  delayMs: number;
  durationMs: number;
}) {
  const pathRef = useRef<SVGPathElement>(null);
  const tokenRef = useRef<SVGGElement>(null);

  useEffect(() => {
    const path = pathRef.current;
    const token = tokenRef.current;
    if (!path || !token) return;
    const total = path.getTotalLength();
    const placeAt = (p: number) => {
      const pt = path.getPointAtLength(total * p);
      token.setAttribute("transform", `translate(${pt.x},${pt.y})`);
    };
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced) {
      placeAt(0.5);
      token.style.opacity = "1";
      return;
    }
    const cycle = durationMs + 900;
    let raf = 0;
    const start = performance.now() + delayMs;
    const frameFn = (now: number) => {
      const elapsed = now - start;
      if (elapsed < 0) {
        token.style.opacity = "0";
      } else {
        const local = (elapsed % cycle) / durationMs;
        const p = Math.min(1, local);
        const eased = p < 0.5 ? 2 * p * p : 1 - (-2 * p + 2) ** 2 / 2;
        placeAt(eased);
        token.style.opacity = local > 1.6 ? "0" : "1";
      }
      raf = requestAnimationFrame(frameFn);
    };
    raf = requestAnimationFrame(frameFn);
    return () => cancelAnimationFrame(raf);
  }, [d, delayMs, durationMs]);

  return (
    <g className={`ex-flow ex-tone-${tone}`}>
      <path ref={pathRef} d={d} className="ex-flow-path" />
      <g ref={tokenRef} className="ex-flow-token" style={{ opacity: 0 }}>
        <circle r={8} />
        {label && (
          <text y={26} textAnchor="middle">
            {label}
          </text>
        )}
      </g>
    </g>
  );
}
