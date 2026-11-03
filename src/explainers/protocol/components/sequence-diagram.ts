import { escapeHtml, isolateBidi, t, toUpperLocale } from "../i18n";
import { EASE_OUT_EXPO, isReducedMotion, playbackClock, smoothScrollTo } from "../lib/motion";
import { getLinkLatency } from "../lib/packet-dissector";
import type {
  Lesson,
  NodeId,
  NoteEvent,
  PacketEvent,
  SimulationState,
} from "../types/protocol";
import { DEFAULT_NODE_LABELS } from "./isometric-topology";

export const SEQUENCE_TIMINGS = {
  draw: 620,
  quick: 320,
  stagger: 160,
  note: 700,
};

const DEFAULT_LIFELINE_ORDER: NodeId[] = [
  "client",
  "router",
  "internet",
  "dns",
  "web",
  "mx",
  "root",
  "tld",
  "auth",
];

const PIXELS_PER_SECOND = 3000;
const TIME_BREAK_THRESHOLD = 0.25;
const TIME_BREAK_HEIGHT = 58;
const SIMULTANEOUS_ARRIVAL_STEP = 18;
const MIN_EVENT_GAP_Y = 9;
const MIN_SEND_AFTER_SEND_Y = 30;
const NOTE_BOX_SLOT_HEIGHT = 30;
const MIN_SEND_AFTER_NOTE_Y = 22;
const STEP_BANNER_HEIGHT = 30;
const TOP_PADDING_Y = 30;
const BOTTOM_PADDING_Y = 40;

const roundMicro = (val: number): number => Math.round(val * 1e6) / 1e6;

export function formatTimeBreak(seconds: number): string {
  if (seconds >= 3600) {
    return `${+(seconds / 3600).toFixed(1)} h later`;
  }
  if (seconds >= 60) {
    return `${+(seconds / 60).toFixed(1)} min later`;
  }
  return `${seconds < 10 ? seconds.toFixed(2) : seconds.toFixed(1)} s later`;
}

export interface SequencePacketItem {
  type: "packet";
  p: PacketEvent;
  step: number;
  index: number;
  k: number;
  sent: number;
  arrived: number;
  ySent?: number;
  yArrived?: number;
}

export interface SequenceNoteItem {
  type: "note";
  e: NoteEvent;
  step: number;
  index: number;
  order: number;
  t: number;
  lane: NodeId | null;
  between: [NodeId, NodeId] | null;
  y?: number;
}

export interface SequenceStepMarker {
  step: number;
  y: number;
}

export interface SequenceTimeBreak {
  y: number;
  seconds: number;
}

export interface SequenceLayout {
  lifelines: NodeId[];
  packets: SequencePacketItem[];
  notes: SequenceNoteItem[];
  steps: SequenceStepMarker[];
  breaks: SequenceTimeBreak[];
  height: number;
}

export function computeSequenceLayout(lesson: Lesson): SequenceLayout {
  type RawItem =
    | { type: "packet"; p: PacketEvent; step: number; index: number }
    | { type: "note"; e: NoteEvent; step: number; index: number };

  const items: RawItem[] = [];
  let pktCounter = 0;
  let noteCounter = 0;

  lesson.steps.forEach((stepObj, stepIdx) =>
    stepObj.events.forEach((ev) => {
      if (ev.type === "packet") {
        items.push({ type: "packet", p: ev, step: stepIdx, index: pktCounter++ });
      }
      if (ev.type === "stream") {
        ev.packets.forEach((pkt) =>
          items.push({ type: "packet", p: pkt, step: stepIdx, index: pktCounter++ }),
        );
      }
      if (ev.type === "note") {
        items.push({ type: "note", e: ev, step: stepIdx, index: noteCounter++ });
      }
    }),
  );

  const usedNodes = new Set(
    items.flatMap((it) => (it.type === "packet" ? [it.p.from, it.p.to] : [])),
  );
  const lifelines = (lesson.lifelines ?? DEFAULT_LIFELINE_ORDER).filter((node) =>
    usedNodes.has(node),
  );

  const packets: SequencePacketItem[] = items
    .filter((it): it is Extract<RawItem, { type: "packet" }> => it.type === "packet")
    .map((it, k) => {
      const { p } = it;
      const sent = roundMicro(parseFloat(p.row.time));
      const delay = getLinkLatency(lesson, p.from, p.to);
      return {
        ...it,
        k,
        sent,
        arrived: roundMicro(sent + delay),
      };
    });

  const notes: SequenceNoteItem[] = items
    .map((it, i) => ({ it, i }))
    .filter(
      (entry): entry is { it: Extract<RawItem, { type: "note" }>; i: number } =>
        entry.it.type === "note",
    )
    .map(({ it, i }) => {
      const prevPkt = items
        .slice(0, i)
        .findLast((x): x is Extract<RawItem, { type: "packet" }> => x.type === "packet");
      const nextPkt = items
        .slice(i + 1)
        .find((x): x is Extract<RawItem, { type: "packet" }> => x.type === "packet");
      const prevArrived = prevPkt
        ? packets.find((pk) => pk.index === prevPkt.index)!.arrived
        : 0;
      const nextSent =
        nextPkt && nextPkt.step === it.step
          ? packets.find((pk) => pk.index === nextPkt.index)!.sent
          : -Infinity;
      const lane = lifelines.includes(it.e.at) ? it.e.at : null;
      const between: [NodeId, NodeId] | null = prevPkt
        ? [prevPkt.p.from, prevPkt.p.to]
        : null;
      return {
        ...it,
        order: i,
        t: Math.max(prevArrived, nextSent),
        lane,
        between,
      };
    });

  interface TimelinePoint {
    t: number;
    kind: number;
    order: number;
    pk?: SequencePacketItem;
    end?: "sent" | "arrived";
    n?: SequenceNoteItem;
  }

  const timeline: TimelinePoint[] = [
    ...packets.flatMap((pk): TimelinePoint[] => [
      {
        t: pk.sent,
        kind: 1,
        order: items.indexOf(
          items.find((it) => it.type === "packet" && it.index === pk.index)!,
        ),
        pk,
        end: "sent",
      },
      {
        t: pk.arrived,
        kind: 0,
        order: pk.k,
        pk,
        end: "arrived",
      },
    ]),
    ...notes.map(
      (n): TimelinePoint => ({
        t: n.t,
        kind: 0.5,
        order: n.order,
        n,
      }),
    ),
  ].sort((a, b) => a.t - b.t || a.kind - b.kind || a.order - b.order);

  const steps: SequenceStepMarker[] = [];
  const breaks: SequenceTimeBreak[] = [];

  let curY = TOP_PADDING_Y;
  let prevPoint: TimelinePoint | null = null;
  let lastSendY = -Infinity;
  let lastNoteBottomY = -Infinity;

  for (const pt of timeline) {
    if (prevPoint) {
      const dt = roundMicro(pt.t - prevPoint.t);
      if (dt > TIME_BREAK_THRESHOLD) {
        breaks.push({ y: curY + TIME_BREAK_HEIGHT / 2, seconds: dt });
        curY += TIME_BREAK_HEIGHT;
      } else if (dt > 0) {
        curY += Math.max(MIN_EVENT_GAP_Y, dt * PIXELS_PER_SECOND);
      } else if (pt.kind === prevPoint.kind && pt.kind === 0) {
        curY += SIMULTANEOUS_ARRIVAL_STEP;
      }
    }

    if (pt.kind === 1) {
      curY = Math.max(
        curY,
        lastSendY + MIN_SEND_AFTER_SEND_Y,
        lastNoteBottomY + MIN_SEND_AFTER_NOTE_Y,
      );
    }

    const stepNum =
      pt.pk && pt.end === "sent" ? pt.pk.step : pt.n ? pt.n.step : null;
    if (stepNum !== null && !steps.some((s) => s.step === stepNum)) {
      curY += STEP_BANNER_HEIGHT / 2;
      steps.push({ step: stepNum, y: curY });
      curY += STEP_BANNER_HEIGHT / 2;
    }

    if (pt.n) {
      curY += NOTE_BOX_SLOT_HEIGHT / 2;
      pt.n.y = curY;
      lastNoteBottomY = curY + 10;
      curY += NOTE_BOX_SLOT_HEIGHT / 2;
    } else if (pt.pk && pt.end) {
      pt.pk[pt.end === "sent" ? "ySent" : "yArrived"] = curY;
    }

    if (pt.kind === 1) {
      lastSendY = curY;
    }
    prevPoint = pt;
  }

  return {
    lifelines,
    packets,
    notes,
    steps,
    breaks,
    height: curY + BOTTOM_PADDING_Y,
  };
}

const SVG_NS = "http://www.w3.org/2000/svg";
const LEFT_MARGIN_X = 78;
const RIGHT_MARGIN_X = 30;
const MIN_COLUMN_WIDTH = 124;
const LOCK_ICON_PATH =
  "M-3.2 -1 V-2.6 a3.2 3.2 0 0 1 6.4 0 V-1 M-4.4 -1 h8.8 v6.4 h-8.8 z";

export function renderSequenceDiagramHtml(): string {
  return `
  <div class="sequence" data-t-label="Sequence diagram" aria-label="${t("Sequence diagram")}">
    <div class="seq-head"></div>
    <div class="seq-scroll"><svg class="seq-svg" xmlns="${SVG_NS}"></svg></div>
  </div>`;
}

const getLifelineTitle = (lesson: Lesson, node: NodeId): string =>
  t((lesson.labels?.[node] ?? DEFAULT_NODE_LABELS[node])[0]);

function getLifelineAddress(
  lesson: Lesson,
  node: NodeId,
  layout: SequenceLayout,
): string {
  const configured = (lesson.labels?.[node] ?? DEFAULT_NODE_LABELS[node])[1];
  return (
    configured ||
    (layout.packets.find((pk) => pk.p.from === node)?.p.row.src ?? "")
  );
}

function renderSequenceArrowSvg(
  pktItem: SequencePacketItem,
  laneX: Record<string, number>,
): string {
  const { p } = pktItem;
  const x1 = laneX[p.from];
  const x2 = p.lost ? (laneX[p.from] + laneX[p.to]) / 2 : laneX[p.to];
  const y1 = pktItem.ySent!;
  const y2 = p.lost
    ? (pktItem.ySent! + pktItem.yArrived!) / 2
    : pktItem.yArrived!;

  const length = Math.hypot(x2 - x1, y2 - y1);
  const ux = (x2 - x1) / length;
  const uy = (y2 - y1) / length;
  const tipShorten = p.lost ? 0 : 9;
  const lineEndX = x2 - ux * tipShorten;
  const lineEndY = y2 - uy * tipShorten;

  let angleDeg = (Math.atan2(y2 - y1, x2 - x1) * 180) / Math.PI;
  if (angleDeg > 90) angleDeg -= 180;
  if (angleDeg < -90) angleDeg += 180;

  const row = p.row;
  const tooltip = `${isolateBidi(`#${pktItem.index + 1} · ${row.time} · ${row.src} → ${row.dst} · ${row.proto}`)} · ${t(row.info)} · ${isolateBidi(row.len)}`;
  const tipOrCrossSvg = p.lost
    ? `<path class="seq-cross" d="M${x2 - 6},${y2 - 6} L${x2 + 6},${y2 + 6} M${x2 + 6},${y2 - 6} L${x2 - 6},${y2 + 6}"/>`
    : `<path class="seq-tip" d="M${x2},${y2} L${lineEndX - uy * 4.5},${lineEndY + ux * 4.5} L${lineEndX + uy * 4.5},${lineEndY - ux * 4.5} Z"/>`;

  return `
    <g class="seq-arrow c-${p.color}${p.lost ? " is-lost" : ""}" data-packet="${pktItem.index}" data-len="${length.toFixed(1)}" data-geo="${[x1, y1, x2, y2, angleDeg.toFixed(2)].join(" ")}">
      <title>${escapeHtml(tooltip)}</title>
      <text class="seq-time" x="${LEFT_MARGIN_X - 14}" y="${y1}">${escapeHtml(row.time)}</text>
      <circle class="seq-dot" cx="${x1}" cy="${y1}" r="2.6"/>
      <line class="seq-line" x1="${x1}" y1="${y1}" x2="${lineEndX}" y2="${lineEndY}"/>
      ${tipOrCrossSvg}
      <g class="seq-label">
        <rect class="seq-label-bg" y="-17" height="15" rx="2"/>
        ${p.locked ? `<path class="seq-lock" d="${LOCK_ICON_PATH}"/>` : ""}
        <text class="seq-label-text" y="-6" text-anchor="middle">${escapeHtml(t(p.label))}</text>
      </g>
    </g>`;
}

function renderSequenceNoteSvg(
  noteItem: SequenceNoteItem,
  laneX: Record<string, number>,
  lifelines: NodeId[],
): string {
  const lane = noteItem.lane;
  const isLastLifeline =
    lane && lifelines.indexOf(lane) === lifelines.length - 1 && lifelines.length > 1;
  const anchorX = lane
    ? laneX[lane]
    : noteItem.between
      ? (laneX[noteItem.between[0]] + laneX[noteItem.between[1]]) / 2
      : laneX[lifelines[0]];
  const side = lane ? (isLastLifeline ? "left" : "right") : "center";

  return `
    <g class="seq-note tone-${noteItem.e.tone ?? "navy"}" data-note="${noteItem.index}" data-side="${side}" transform="translate(${anchorX} ${noteItem.y})">
      ${lane ? '<circle class="seq-note-dot" r="3.5"/>' : ""}
      <rect class="seq-note-bg" y="-10" height="20" rx="2"/>
      <text class="seq-note-text" y="0.5">${escapeHtml(t(noteItem.e.text))}</text>
    </g>`;
}

function renderSequenceBreakSvg(brk: SequenceTimeBreak, width: number): string {
  const buildWavePath = (yOffset: number) => {
    let d = `M0 ${yOffset}`;
    for (let x = 0; x < width; x += 12) {
      d += " q3 -3 6 0 q3 3 6 0";
    }
    return d;
  };
  return `
    <g class="seq-break" transform="translate(0 ${brk.y})">
      <rect class="seq-break-band" x="0" y="-15" width="${width}" height="30"/>
      <path class="seq-wave" d="${buildWavePath(-6)} ${buildWavePath(6)}"/>
      <g transform="translate(${width / 2} 0)">
        <rect class="seq-break-bg" y="-10" height="20" rx="10"/>
        <text class="seq-break-text" y="0.5" text-anchor="middle">${escapeHtml(t(formatTimeBreak(brk.seconds)))}</text>
      </g>
    </g>`;
}

type PolygonPoints = Array<[number, number]>;

function polygonsOverlap(polyA: PolygonPoints, polyB: PolygonPoints): boolean {
  for (const poly of [polyA, polyB]) {
    for (let i = 0; i < poly.length; i++) {
      const [p1, p2] = [poly[i], poly[(i + 1) % poly.length]];
      const [nx, ny] = [p2[1] - p1[1], p1[0] - p2[0]];
      const project = (pts: PolygonPoints) => pts.map(([x, y]) => x * nx + y * ny);
      const [projA, projB] = [project(polyA), project(polyB)];
      if (
        Math.max(...projA) <= Math.min(...projB) ||
        Math.max(...projB) <= Math.min(...projA)
      ) {
        return false;
      }
    }
  }
  return true;
}

const createRectPolygon = (
  x1: number,
  y1: number,
  x2: number,
  y2: number,
): PolygonPoints => [
  [x1, y1],
  [x2, y1],
  [x2, y2],
  [x1, y2],
];

function layoutSequenceLabels(svgEl: SVGSVGElement): void {
  const measureTextWidth = (parent: Element) =>
    (parent.querySelector("text") as SVGTextContentElement).getComputedTextLength();

  const noteItems = [...svgEl.querySelectorAll<SVGGElement>(".seq-note")].map((g) => ({
    g,
    w: measureTextWidth(g),
  }));
  const arrowItems = [...svgEl.querySelectorAll<SVGGElement>(".seq-arrow")].map((arrow) => {
    const labelGroup = arrow.querySelector<SVGGElement>(".seq-label")!;
    return {
      arrow,
      g: labelGroup,
      w: measureTextWidth(labelGroup),
    };
  });
  const breakItems = [...svgEl.querySelectorAll<SVGGElement>(".seq-break")].map((g) => ({
    g,
    w: measureTextWidth(g),
  }));
  const stepItems = [...svgEl.querySelectorAll<SVGGElement>(".seq-step")].map((g) => ({
    g,
    w: measureTextWidth(g),
  }));

  const occupiedBoxes: PolygonPoints[] = [
    ...svgEl.querySelectorAll<SVGPathElement>(".seq-cross"),
  ].map((cross) => {
    const [x, y] = cross
      .getAttribute("d")!
      .match(/[-\d.]+/g)!
      .map(Number);
    return createRectPolygon(x - 3, y - 3, x + 15, y + 15);
  });

  stepItems.forEach(({ g, w }) => {
    g.querySelector("line")!.setAttribute("x1", String(12 + w + 10));
  });

  noteItems.forEach(({ g, w }) => {
    const textEl = g.querySelector("text")!;
    const rectEl = g.querySelector("rect")!;
    const side = g.dataset.side;
    const xOffset =
      side === "right" ? 10 : side === "left" ? -10 - w - 16 : -w / 2 - 8;
    rectEl.setAttribute("x", String(xOffset));
    rectEl.setAttribute("width", String(w + 16));
    textEl.setAttribute("x", String(xOffset + 8));

    const [tx, ty] = g
      .getAttribute("transform")!
      .match(/[-\d.]+/g)!
      .map(Number);
    occupiedBoxes.push(createRectPolygon(tx + xOffset, ty - 10, tx + xOffset + w + 16, ty + 10));
  });

  breakItems.forEach(({ g, w }) => {
    const bgRect = g.querySelector(".seq-break-bg")!;
    bgRect.setAttribute("x", String(-w / 2 - 10));
    bgRect.setAttribute("width", String(w + 20));
  });

  arrowItems.sort((a, b) => b.w - a.w);
  arrowItems.forEach(({ arrow, g, w }) => {
    const textEl = g.querySelector("text")!;
    const lockEl = g.querySelector(".seq-lock");
    const lockPad = lockEl ? 14 : 0;
    textEl.setAttribute("x", String(lockPad / 2));
    if (lockEl) {
      lockEl.setAttribute("transform", `translate(${-w / 2 - 4} -10)`);
    }
    const bgRect = g.querySelector("rect")!;
    bgRect.setAttribute("x", String(-w / 2 - 5 - lockPad / 2));
    bgRect.setAttribute("width", String(w + 10 + lockPad));

    const [x1, y1, x2, y2, angleDeg] = arrow.dataset.geo!.split(" ").map(Number);
    const halfWidth = w / 2 + 6 + lockPad / 2;
    const [cosA, sinA] = [
      Math.cos((angleDeg * Math.PI) / 180),
      Math.sin((angleDeg * Math.PI) / 180),
    ];
    const localCorners: PolygonPoints = (
      [
        [-halfWidth - 2, -21],
        [halfWidth + 2, -21],
        [halfWidth + 2, 3],
        [-halfWidth - 2, 3],
      ] as PolygonPoints
    ).map(([lx, ly]) => [lx * cosA - ly * sinA, lx * sinA + ly * cosA]);

    const candidateAt = (ratio: number) => {
      const [cx, cy] = [x1 + (x2 - x1) * ratio, y1 + (y2 - y1) * ratio];
      return {
        cx,
        cy,
        box: localCorners.map(([dx, dy]): [number, number] => [cx + dx, cy + dy]),
      };
    };

    const lineLen = Math.hypot(x2 - x1, y2 - y1);
    const minRatio = Math.min(0.45, (halfWidth + 8) / lineLen);
    const candidates = [0.5, 0.4, 0.6, 0.3, 0.7, 0.2, 0.8, 0.12, 0.88]
      .filter((r) => r >= minRatio && r <= 1 - minRatio)
      .map(candidateAt);

    const countCollisions = (cand: { box: PolygonPoints }) =>
      occupiedBoxes.filter((box) => polygonsOverlap(cand.box, box)).length;

    const chosen =
      candidates.find((c) => !countCollisions(c)) ??
      [...candidates, candidateAt(0.5)].sort(
        (a, b) => countCollisions(a) - countCollisions(b),
      )[0];

    occupiedBoxes.push(chosen.box);
    g.setAttribute(
      "transform",
      `translate(${chosen.cx.toFixed(1)} ${chosen.cy.toFixed(1)}) rotate(${angleDeg})`,
    );
  });
}

export interface SequenceElement extends HTMLElement {
  _layout?: SequenceLayout;
  _lesson?: Lesson;
  _width?: number;
  _want?: string;
  _state?: SimulationState;
}

const syncHeaderHorizontalScroll = (seqEl: SequenceElement): void => {
  const track = seqEl.querySelector<HTMLElement>(".seq-head-track");
  if (track) {
    const scrollLeft = seqEl.querySelector<HTMLElement>(".seq-scroll")!.scrollLeft;
    track.style.transform = `translateX(${-scrollLeft}px)`;
  }
};

export function renderSequenceLesson(seqEl: SequenceElement, lesson: Lesson): void {
  const scrollEl = seqEl.querySelector<HTMLElement>(".seq-scroll")!;
  const svgEl = seqEl.querySelector<SVGSVGElement>(".seq-svg")!;
  const layout = computeSequenceLayout(lesson);

  const totalWidth = Math.max(
    scrollEl.clientWidth,
    LEFT_MARGIN_X + RIGHT_MARGIN_X + layout.lifelines.length * MIN_COLUMN_WIDTH,
  );
  const colWidth = (totalWidth - LEFT_MARGIN_X - RIGHT_MARGIN_X) / layout.lifelines.length;
  const laneX = Object.fromEntries(
    layout.lifelines.map((node, idx) => [
      node,
      Math.round(LEFT_MARGIN_X + colWidth * (idx + 0.5)),
    ]),
  );

  const headEl = seqEl.querySelector<HTMLElement>(".seq-head")!;
  headEl.innerHTML =
    `<div class="seq-head-track" style="width:${totalWidth}px">` +
    layout.lifelines
      .map(
        (node) =>
          `<span class="seq-who" style="left:${laneX[node]}px; max-width:${Math.floor(colWidth - 10)}px"><b>${escapeHtml(getLifelineTitle(lesson, node))}</b><i>${escapeHtml(getLifelineAddress(lesson, node, layout))}</i></span>`,
      )
      .join("") +
    "</div>";
  headEl.style.height = `${Math.max(
    46,
    ...[...headEl.querySelectorAll<HTMLElement>(".seq-who")].map((el) => el.offsetHeight + 6),
  )}px`;

  const lifelinesSvg = layout.lifelines
    .map(
      (node) =>
        `<line class="seq-life" x1="${laneX[node]}" y1="0" x2="${laneX[node]}" y2="${layout.height}"/>`,
    )
    .join("");

  const stepsSvg = layout.steps
    .map(
      (st) => `
    <g class="seq-step" data-step="${st.step}" transform="translate(0 ${st.y})">
      <line class="seq-step-line" x1="10" y1="0" x2="${totalWidth - 10}" y2="0"/>
      <text class="seq-step-text" x="12" y="0.5"><tspan class="seq-step-num">${t("STEP {n}", { n: st.step + 1 })}</tspan> · ${escapeHtml(toUpperLocale(t(lesson.steps[st.step].title)))}</text>
    </g>`,
    )
    .join("");

  svgEl.setAttribute("viewBox", `0 0 ${totalWidth} ${layout.height}`);
  svgEl.setAttribute("width", String(totalWidth));
  svgEl.setAttribute("height", String(layout.height));
  svgEl.innerHTML =
    lifelinesSvg +
    layout.breaks.map((brk) => renderSequenceBreakSvg(brk, totalWidth)).join("") +
    stepsSvg +
    layout.notes.map((n) => renderSequenceNoteSvg(n, laneX, layout.lifelines)).join("") +
    [
      ...layout.packets.filter((pk) => !pk.p.lost),
      ...layout.packets.filter((pk) => pk.p.lost),
    ]
      .map((pk) => renderSequenceArrowSvg(pk, laneX))
      .join("");

  layoutSequenceLabels(svgEl);

  seqEl._layout = layout;
  seqEl._lesson = lesson;
  seqEl._width = scrollEl.clientWidth;
  seqEl.dataset.lesson = lesson.id;
  scrollEl.scrollTop = 0;
  scrollEl.scrollLeft = 0;
  syncHeaderHorizontalScroll(seqEl);
}

export function reflowSequenceDiagram(seqEl: SequenceElement): void {
  if (!seqEl._lesson || seqEl.dataset.lesson !== seqEl._want) return;
  const scrollEl = seqEl.querySelector<HTMLElement>(".seq-scroll")!;
  const savedScrollTop = scrollEl.scrollTop;
  renderSequenceLesson(seqEl, seqEl._lesson);
  if (seqEl._state) {
    applySequenceTimelineState(seqEl, seqEl._state);
  }
  seqEl
    .querySelector(".seq-svg")!
    .getAnimations({ subtree: true })
    .forEach((anim) => anim.finish());
  scrollEl.scrollTop = savedScrollTop;
}

export function initSequenceDiagramScrollAndResize(seqEl: SequenceElement): void {
  const scrollEl = seqEl.querySelector<HTMLElement>(".seq-scroll")!;
  scrollEl.addEventListener("scroll", () => syncHeaderHorizontalScroll(seqEl), {
    passive: true,
  });
  new ResizeObserver(() => {
    if (Math.abs(scrollEl.clientWidth - (seqEl._width ?? 0)) >= 1) {
      reflowSequenceDiagram(seqEl);
    }
  }).observe(scrollEl);
}

const getElementOpacity = (el: Element): number => Number(getComputedStyle(el).opacity);

function showSequenceItem(
  el: SVGGElement,
  mode: "fade" | "quick" | "draw",
  delayMs: number,
): void {
  const curOpacity = getElementOpacity(el);
  el.getAnimations({ subtree: true }).forEach((anim) => anim.cancel());
  el.classList.add("is-shown");

  if (isReducedMotion()) return;

  if (mode === "fade" || curOpacity > 0) {
    el.animate([{ opacity: curOpacity }, { opacity: 1 }], {
      duration: 260 * (1 - curOpacity),
      delay: curOpacity > 0 ? 0 : delayMs,
      easing: "ease-out",
      fill: "backwards",
    });
    if (mode === "fade" || curOpacity > 0.5) return;
  }

  const lineEl = el.querySelector<SVGLineElement>(".seq-line")!;
  const len = Number(el.dataset.len);
  const drawDuration = mode === "quick" ? SEQUENCE_TIMINGS.quick : SEQUENCE_TIMINGS.draw;
  const animateTracked = (
    target: Element,
    keyframes: Keyframe[],
    options: KeyframeAnimationOptions,
  ) =>
    playbackClock.track(
      target.animate(keyframes, { delay: delayMs, fill: "backwards", ...options }),
    );

  if (delayMs) {
    animateTracked(el, [{ opacity: 0 }, { opacity: 1 }], { duration: 1 });
  }
  if (el.classList.contains("is-lost")) {
    animateTracked(lineEl, [{ opacity: 0 }, { opacity: 1 }], {
      duration: drawDuration,
      easing: "ease-out",
    });
  } else {
    animateTracked(
      lineEl,
      [
        { strokeDasharray: `${len} ${len}`, strokeDashoffset: len },
        { strokeDasharray: `${len} ${len}`, strokeDashoffset: 0 },
      ],
      { duration: drawDuration, easing: EASE_OUT_EXPO },
    );
  }
  animateTracked(
    el.querySelector(".seq-tip, .seq-cross")!,
    [{ opacity: 0 }, { opacity: 1 }],
    {
      duration: 160,
      delay: delayMs + drawDuration * 0.7,
      easing: "ease-out",
    },
  );
  animateTracked(el.querySelector(".seq-label")!, [{ opacity: 0 }, { opacity: 1 }], {
    duration: 240,
    delay: delayMs + drawDuration * 0.3,
    easing: "ease-out",
  });
}

function hideSequenceItem(el: SVGGElement): void {
  const curOpacity = getElementOpacity(el);
  el.getAnimations({ subtree: true }).forEach((anim) => anim.cancel());
  el.classList.remove("is-shown");
  if (!isReducedMotion() && curOpacity > 0) {
    el.animate([{ opacity: curOpacity }, { opacity: 0 }], {
      duration: 180 * curOpacity,
      easing: curOpacity < 1 ? "linear" : "ease-in",
    });
  }
}

function applySequenceTimelineState(
  seqEl: SequenceElement,
  state: SimulationState,
): void {
  const svgEl = seqEl.querySelector<SVGSVGElement>(".seq-svg")!;
  const layout = seqEl._layout!;
  const newlyShown: Array<{ g: SVGGElement; current: boolean; y: number }> = [];
  let fadeCount = 0;

  svgEl.querySelectorAll<SVGGElement>(".seq-arrow").forEach((arrow) => {
    const pktIdx = Number(arrow.dataset.packet);
    const pktState = state.packets[pktIdx];
    const shouldShow = !state.started || pktState !== "future";
    const isCurrent = state.started && pktState === "current";
    if (shouldShow && !arrow.classList.contains("is-shown")) {
      newlyShown.push({
        g: arrow,
        current: isCurrent,
        y: layout.packets[pktIdx].yArrived!,
      });
    }
    if (!shouldShow && arrow.classList.contains("is-shown")) {
      hideSequenceItem(arrow);
    }
    arrow.classList.toggle("is-current", isCurrent);
  });

  const allNewlyCurrent =
    newlyShown.length > 0 && newlyShown.every((item) => item.current);
  newlyShown.forEach((item, idx) => {
    const isQuick = layout.packets.find(
      (pk) => pk.index === Number(item.g.dataset.packet),
    )?.p.quick;
    if (allNewlyCurrent) {
      showSequenceItem(
        item.g,
        isQuick ? "quick" : "draw",
        idx * SEQUENCE_TIMINGS.stagger,
      );
    } else {
      showSequenceItem(item.g, "fade", Math.min(fadeCount++ * 14, 420));
    }
  });

  svgEl.querySelectorAll<SVGGElement>(".seq-note").forEach((noteEl) => {
    const noteIdx = Number(noteEl.dataset.note);
    const shouldShow = !state.started || state.notes[noteIdx] !== "future";
    if (shouldShow && !noteEl.classList.contains("is-shown")) {
      showSequenceItem(noteEl, "fade", 0);
      newlyShown.push({ g: noteEl, current: false, y: layout.notes[noteIdx].y! });
    }
    if (!shouldShow && noteEl.classList.contains("is-shown")) {
      hideSequenceItem(noteEl);
    }
  });

  svgEl.querySelectorAll<SVGGElement>(".seq-step").forEach((stepEl) => {
    stepEl.classList.toggle(
      "is-active",
      state.started && !state.done && Number(stepEl.dataset.step) === state.activeStep,
    );
  });

  const scrollEl = seqEl.querySelector<HTMLElement>(".seq-scroll")!;
  if (!state.started) {
    if (newlyShown.length) {
      smoothScrollTo(scrollEl, 0);
    }
    return;
  }

  const shownYs = [
    ...svgEl.querySelectorAll<SVGGElement>(".seq-arrow.is-shown, .seq-note.is-shown"),
  ].map((el) =>
    el.dataset.packet !== undefined
      ? layout.packets[Number(el.dataset.packet)].yArrived!
      : layout.notes[Number(el.dataset.note)].y!,
  );
  const maxY = shownYs.length ? Math.max(...shownYs) : 0;
  const viewHeight = scrollEl.clientHeight;
  if (maxY > scrollEl.scrollTop + viewHeight - 44) {
    smoothScrollTo(scrollEl, maxY - viewHeight * 0.62);
  } else if (maxY < scrollEl.scrollTop + 30) {
    smoothScrollTo(scrollEl, maxY - viewHeight * 0.4);
  }
}

function transitionSequenceLesson(
  seqEl: SequenceElement,
  lesson: Lesson,
  state: SimulationState,
): void {
  const panes = [
    seqEl.querySelector<HTMLElement>(".seq-scroll")!,
    seqEl.querySelector<HTMLElement>(".seq-head")!,
  ];
  seqEl._want = lesson.id;
  seqEl._state = state;

  const commit = () => {
    if (seqEl._want === lesson.id) {
      panes.forEach((p) => p.getAnimations().forEach((anim) => anim.cancel()));
      renderSequenceLesson(seqEl, lesson);
      applySequenceTimelineState(seqEl, seqEl._state!);
      if (!isReducedMotion()) {
        panes.forEach((p) =>
          p.animate([{ opacity: 0 }, { opacity: 1 }], {
            duration: 260,
            easing: "ease-out",
          }),
        );
      }
    }
  };

  if (!seqEl.dataset.lesson || isReducedMotion()) {
    commit();
    return;
  }

  panes.forEach((p) => {
    const curOpacity = Number(getComputedStyle(p).opacity);
    p.getAnimations().forEach((anim) => anim.cancel());
    p.animate([{ opacity: curOpacity }, { opacity: 0 }], {
      duration: 160 * curOpacity,
      easing: curOpacity < 1 ? "linear" : "ease-in",
      fill: "forwards",
    });
  });
  setTimeout(commit, 170);
}

export function updateSequenceDiagramState(
  seqEl: SequenceElement,
  state: SimulationState,
  lesson: Lesson,
): void {
  seqEl._state = state;
  if (seqEl._want !== lesson.id) {
    transitionSequenceLesson(seqEl, lesson, state);
    return;
  }
  if (seqEl.dataset.lesson === lesson.id) {
    applySequenceTimelineState(seqEl, state);
  }
}
