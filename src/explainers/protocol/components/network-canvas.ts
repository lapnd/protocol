import { t } from "../i18n";
import {
  type CancellationToken,
  runScaledAnimation,
  waitScaled,
} from "../lib/motion";
import type {
  CameraFrameId,
  LessonEvent,
  NodeId,
  NoteEvent,
  PacketColor,
  PacketEvent,
  StreamEvent,
} from "../types/protocol";
import {
  CAMERA_FRAME_NODES,
  DEFAULT_NODE_LABELS,
  LANE_COLORS,
  LANE_COORDS,
  NODE_NOTE_ANCHORS,
  NODE_PULSE_CENTERS,
  ROUTE_LANES,
} from "./isometric-topology";

const SVG_NS = "http://www.w3.org/2000/svg";
const PACKET_SPEED_PX_PER_MS = 0.21;
const HOP_PAUSE_MS = 140;
const TYPING_CHAR_MS = 55;
const CAMERA_TRANSITION_MS = 1100;
const CAMERA_PAD_PX = 14;
const MIN_CAMERA_SPAN_W = 470;
const CLIENT_ONLY_FRAMES: CameraFrameId[] = ["client"];
const TRAIL_OFFSETS = [10, 20, 30];
const NOTE_HOLD_MS = 1500;
const SCALE_REF_WIDTH = 700;
const MAX_LABEL_SCALE = 1.8;
const URL_ORIGIN_PIVOT: [number, number] = [140, 58];
const URL_HOLDER_POS: [number, number] = [60, 334];

const CJK_CHAR_REGEX =
  /[\u1100-\u115f\u2e80-\u303e\u3041-\u33ff\u3400-\u4dbf\u4e00-\u9fff\ua960-\ua97f\uac00-\ud7a3\uf900-\ufaff\ufe30-\ufe4f\uff00-\uff60\uffe0-\uffe6]/;
const BIDI_CONTROL_REGEX = /[\u200e\u200f\u2066-\u2069]/;
const RTL_SCRIPT_REGEX = /[\u0590-\u08ff\ufb1d-\ufdff\ufe70-\ufefc]/;

const estimateVisualUnits = (str: string): number =>
  [...str].reduce(
    (sum, ch) =>
      sum + (CJK_CHAR_REGEX.test(ch) ? 2 : BIDI_CONTROL_REGEX.test(ch) ? 0 : 1),
    0,
  );

const measureSvgTextWidth = (
  textEl: SVGTextContentElement,
  fallbackWidth: number,
  extraPad = 0,
): number => Math.max(fallbackWidth, textEl.getComputedTextLength() + extraPad);

const easeInOutCubic = (x: number): number =>
  x < 0.5 ? 4 * x * x * x : 1 - (-2 * x + 2) ** 3 / 2;
const easeOutBack = (x: number): number =>
  1 + 2.2 * (x - 1) ** 3 + 1.2 * (x - 1) ** 2;
const easeOutCubic = (x: number): number => 1 - (1 - x) ** 3;
const easeInCubic = (x: number): number => x * x * x;

function createSvgElement<K extends keyof SVGElementTagNameMap>(
  tag: K,
  attrs: Record<string, string | number>,
  parent?: Element,
): SVGElementTagNameMap[K] {
  const el = document.createElementNS(SVG_NS, tag);
  for (const [k, v] of Object.entries(attrs)) {
    el.setAttribute(k, String(v));
  }
  parent?.appendChild(el);
  return el;
}

const interpolateLanePoint = (
  [x1, y1, x2, y2]: [number, number, number, number],
  ratio: number,
): { x: number; y: number } => ({
  x: x1 + (x2 - x1) * ratio,
  y: y1 + (y2 - y1) * ratio,
});

const getLaneLength = ([x1, y1, x2, y2]: [
  number,
  number,
  number,
  number,
]): number => Math.hypot(x2 - x1, y2 - y1);

export interface NetworkCanvasSnapshot {
  view: number[];
  visible: Set<NodeId>;
  lanes: Set<string>;
  page: boolean;
  fresh: boolean;
}

export interface NetworkCanvasController {
  run: (event: LessonEvent, token: CancellationToken) => Promise<void>;
  retext: () => void;
  overview: (
    nodes: NodeId[],
    labels?: Partial<Record<NodeId, [string, string]>>,
  ) => void;
  apply: (event: LessonEvent) => void;
  snapshot: () => NetworkCanvasSnapshot;
  morph: (prev: NetworkCanvasSnapshot, token: CancellationToken) => void;
  clear: () => void;
}

export function createNetworkCanvasController(
  svgEl: SVGSVGElement,
): NetworkCanvasController {
  const laneElements = Object.fromEntries(
    [...svgEl.querySelectorAll<SVGPathElement>(".lane")].map((el) => [
      el.dataset.lane!,
      el,
    ]),
  ) as Record<string, SVGPathElement>;

  const nodeElements = Object.fromEntries(
    [...svgEl.querySelectorAll<SVGGElement>(".node")].map((el) => [
      el.dataset.node as NodeId,
      el,
    ]),
  ) as Record<NodeId, SVGGElement>;

  const packetLayer = svgEl.querySelector<SVGGElement>(".packet-layer")!;
  const pulseLayer = svgEl.querySelector<SVGGElement>(".pulse-layer")!;
  const noteLayer = svgEl.querySelector<SVGGElement>(".note-layer")!;
  const urlBar = svgEl.querySelector<SVGGElement>(".url-bar")!;
  const urlBox = urlBar.querySelector<SVGRectElement>(".url-box")!;
  const urlText = urlBar.querySelector<SVGTextElement>(".url-text")!;
  const urlCaret = urlBar.querySelector<SVGRectElement>(".url-caret")!;
  const urlCheck = urlBar.querySelector<SVGGElement>(".url-check")!;
  const screenContentEls = [
    ...svgEl.querySelectorAll<SVGElement>(".screen-content > *"),
  ];

  const visibleNodes = new Set<NodeId>();
  const activeLanes = new Set<string>();
  let lessonNodes = Object.keys(nodeElements) as NodeId[];
  let isPageRendered = true;
  let hasMorphedOnce = false;
  let currentFrame: CameraFrameId = "full";
  let currentViewBox = svgEl
    .getAttribute("viewBox")!
    .split(" ")
    .map(Number);

  const nodeLabelEls = [...svgEl.querySelectorAll<SVGGElement>(".node-label")];
  const urlHolderEl = svgEl.querySelector<SVGGElement>(".url-holder")!;
  let labelScale = 1;
  let tagScale = 1;

  function applyNodeLabelScale(labelEl: SVGGElement): void {
    labelEl.removeAttribute("transform");
    if (labelScale === 1) return;
    const bbox = labelEl.getBBox();
    const [hAlign, vAlign] = labelEl.dataset.origin!.split("-");
    const px =
      hAlign === "left"
        ? bbox.x
        : hAlign === "right"
          ? bbox.x + bbox.width
          : bbox.x + bbox.width / 2;
    const py = vAlign === "top" ? bbox.y : bbox.y + bbox.height;
    labelEl.setAttribute(
      "transform",
      `translate(${px.toFixed(1)} ${py.toFixed(1)}) scale(${labelScale.toFixed(3)}) translate(${(-px).toFixed(1)} ${(-py).toFixed(1)})`,
    );
  }

  function updateResponsiveLabelScale(): void {
    const width = svgEl.getBoundingClientRect().width;
    const nextScale = width
      ? Math.min(MAX_LABEL_SCALE, Math.max(1, SCALE_REF_WIDTH / width))
      : 1;
    if (Math.abs(nextScale - labelScale) < 0.01) return;
    labelScale = nextScale;
    tagScale = 1 + (nextScale - 1) * 0.6;
    svgEl.classList.toggle("is-scaled", nextScale > 1);
    nodeLabelEls.forEach(applyNodeLabelScale);
    const [ox, oy] = URL_ORIGIN_PIVOT;
    urlHolderEl.setAttribute(
      "transform",
      `translate(${URL_HOLDER_POS[0] + ox} ${URL_HOLDER_POS[1] + oy}) scale(${tagScale.toFixed(3)}) translate(${-ox} ${-oy})`,
    );
  }

  function getTransformedBBox(el: SVGGraphicsElement): {
    x: number;
    y: number;
    width: number;
    height: number;
  } {
    const bbox = el.getBBox();
    const matrix = el.transform?.baseVal.consolidate()?.matrix;
    return matrix
      ? {
          x: matrix.a * bbox.x + matrix.e,
          y: matrix.d * bbox.y + matrix.f,
          width: matrix.a * bbox.width,
          height: matrix.d * bbox.height,
        }
      : bbox;
  }

  function getNodeBounds(
    nodeId: NodeId,
    includeUrlHolder: boolean,
  ): { x: number; y: number; width: number; height: number } {
    if (includeUrlHolder) return nodeElements[nodeId].getBBox();
    const childBoxes = [...nodeElements[nodeId].children]
      .filter(
        (ch): ch is SVGGraphicsElement => !ch.classList.contains("url-holder"),
      )
      .map(getTransformedBBox);
    const minX = Math.min(...childBoxes.map((b) => b.x));
    const minY = Math.min(...childBoxes.map((b) => b.y));
    return {
      x: minX,
      y: minY,
      width: Math.max(...childBoxes.map((b) => b.x + b.width)) - minX,
      height: Math.max(...childBoxes.map((b) => b.y + b.height)) - minY,
    };
  }

  function setCameraFrameState(frame: CameraFrameId): void {
    currentFrame = frame;
    urlBar.classList.toggle("is-away", !CLIENT_ONLY_FRAMES.includes(frame));
  }

  function computeCameraViewBox(frame: CameraFrameId): number[] {
    const boxes = CAMERA_FRAME_NODES[frame]
      .filter((n) => lessonNodes.includes(n))
      .map((n) => getNodeBounds(n, CLIENT_ONLY_FRAMES.includes(frame)));
    const minX = Math.min(...boxes.map((b) => b.x)) - CAMERA_PAD_PX;
    const minY = Math.min(...boxes.map((b) => b.y)) - CAMERA_PAD_PX;
    const spanW =
      Math.max(...boxes.map((b) => b.x + b.width)) + CAMERA_PAD_PX - minX;
    const spanH =
      Math.max(...boxes.map((b) => b.y + b.height)) + CAMERA_PAD_PX - minY;
    const { width: viewportW, height: viewportH } =
      svgEl.getBoundingClientRect();
    const zoom = Math.min(
      viewportW / spanW,
      viewportH / spanH,
      viewportW / MIN_CAMERA_SPAN_W,
    );
    return [
      minX + spanW / 2 - viewportW / zoom / 2,
      minY + spanH / 2 - viewportH / zoom / 2,
      viewportW / zoom,
      viewportH / zoom,
    ];
  }

  function applyViewBox(vb: number[]): void {
    currentViewBox = vb;
    svgEl.setAttribute("viewBox", vb.map((v) => v.toFixed(2)).join(" "));
  }

  let cameraAnimToken: CancellationToken = { cancelled: false };

  async function animateCameraTo(
    targetVb: number[],
    durationMs: number,
    outerToken: CancellationToken,
  ): Promise<void> {
    cameraAnimToken.cancelled = true;
    const localToken: CancellationToken = (cameraAnimToken = {
      cancelled: false,
    });
    const startVb = currentViewBox;
    await runScaledAnimation(
      durationMs,
      {
        get cancelled() {
          return outerToken.cancelled || localToken.cancelled;
        },
      },
      (progress) => {
        const eased = easeInOutCubic(progress);
        applyViewBox(
          startVb.map((startVal, idx) => startVal + (targetVb[idx] - startVal) * eased),
        );
      },
    );
  }

  function transitionCameraFrame(
    frame: CameraFrameId,
    token: CancellationToken,
  ): Promise<void> {
    setCameraFrameState(frame);
    return animateCameraTo(
      computeCameraViewBox(frame),
      CAMERA_TRANSITION_MS,
      token,
    );
  }

  function handleResize(): void {
    cameraAnimToken.cancelled = true;
    updateResponsiveLabelScale();
    applyViewBox(computeCameraViewBox(currentFrame));
  }

  new ResizeObserver(handleResize).observe(svgEl);

  function setNodeVisibleImmediate(nodeId: NodeId, visible: boolean): void {
    const el = nodeElements[nodeId];
    if (visible) {
      visibleNodes.add(nodeId);
    } else {
      visibleNodes.delete(nodeId);
    }
    el.style.opacity = visible ? "1" : "0";
    el.removeAttribute("transform");
  }

  async function animateNodeEnter(
    nodeId: NodeId,
    token: CancellationToken,
    { delay = 0, ring = true }: { delay?: number; ring?: boolean } = {},
  ): Promise<void> {
    const el = nodeElements[nodeId];
    visibleNodes.add(nodeId);
    el.style.opacity = "0";
    if (delay) await waitScaled(delay, token);
    await runScaledAnimation(650, token, (progress) => {
      el.setAttribute(
        "transform",
        `translate(0 ${(-46 * (1 - easeOutBack(progress))).toFixed(2)})`,
      );
      el.style.opacity = String(Math.min(1, progress * 2.4));
    });
    if (!token.cancelled) {
      el.removeAttribute("transform");
      if (ring) pulseNodeRing(nodeId, "navy", token);
    }
  }

  async function animateNodeExit(
    nodeId: NodeId,
    token: CancellationToken,
    delay = 0,
  ): Promise<void> {
    const el = nodeElements[nodeId];
    visibleNodes.delete(nodeId);
    el.style.opacity = "1";
    if (delay) await waitScaled(delay, token);
    await runScaledAnimation(380, token, (progress) => {
      el.setAttribute(
        "transform",
        `translate(0 ${(-30 * easeInCubic(progress)).toFixed(2)})`,
      );
      el.style.opacity = String(1 - progress);
    });
    if (!token.cancelled) {
      el.removeAttribute("transform");
      el.style.opacity = "0";
    }
  }

  function bounceNode(nodeId: NodeId, token: CancellationToken): void {
    const el = nodeElements[nodeId];
    runScaledAnimation(340, token, (progress) => {
      if (progress < 1) {
        el.setAttribute(
          "transform",
          `translate(0 ${(-5 * Math.sin(Math.PI * progress)).toFixed(2)})`,
        );
      } else {
        el.removeAttribute("transform");
      }
    });
  }

  function setLaneDrawProgress(laneKey: string, ratio: number): void {
    const [x1, y1] = LANE_COORDS[laneKey];
    const endPt = interpolateLanePoint(LANE_COORDS[laneKey], ratio);
    laneElements[laneKey].setAttribute(
      "d",
      `M${x1},${y1} L${endPt.x.toFixed(1)},${endPt.y.toFixed(1)}`,
    );
    laneElements[laneKey].style.visibility = ratio > 0.01 ? "" : "hidden";
  }

  async function animateLaneVisibility(
    laneKey: string,
    visible: boolean,
    token: CancellationToken,
    delay = 0,
  ): Promise<void> {
    setLaneDrawProgress(laneKey, visible ? 0 : 1);
    if (delay) await waitScaled(delay, token);
    await runScaledAnimation(visible ? 520 : 300, token, (progress) =>
      setLaneDrawProgress(
        laneKey,
        visible ? easeOutCubic(progress) : 1 - easeInCubic(progress),
      ),
    );
  }

  function syncAllLanes(token?: CancellationToken, delay = 0): void {
    for (const laneKey of Object.keys(laneElements)) {
      const [fromNode, toNode] = laneKey.split(">") as [NodeId, NodeId];
      const shouldShow =
        visibleNodes.has(fromNode) && visibleNodes.has(toNode);
      const changed = shouldShow !== activeLanes.has(laneKey);
      if (shouldShow) {
        activeLanes.add(laneKey);
      } else {
        activeLanes.delete(laneKey);
      }
      if (token) {
        if (changed) {
          animateLaneVisibility(laneKey, shouldShow, token, delay);
        }
      } else {
        setLaneDrawProgress(laneKey, shouldShow ? 1 : 0);
      }
    }
  }

  function setLaptopScreenRenderedImmediate(rendered: boolean): void {
    isPageRendered = rendered;
    screenContentEls.forEach((el) => {
      el.style.opacity = rendered ? "1" : "0";
      el.style.strokeDasharray = el.tagName === "polyline" ? "1" : "";
      el.style.strokeDashoffset =
        el.tagName === "polyline" ? (rendered ? "0" : "1") : "";
    });
  }

  async function animateLaptopScreenRender(
    rendered: boolean,
    token: CancellationToken,
    delay = 0,
  ): Promise<void> {
    setLaptopScreenRenderedImmediate(!rendered);
    isPageRendered = rendered;
    if (delay) await waitScaled(delay, token);
    const items = rendered ? screenContentEls : [...screenContentEls].reverse();
    for (const el of items) {
      if (token.cancelled) return;
      const isLine = el.tagName === "polyline";
      el.style.opacity = "1";
      await runScaledAnimation(rendered ? 240 : 110, token, (progress) => {
        const val = rendered ? easeOutCubic(progress) : 1 - progress;
        if (isLine) {
          el.style.strokeDashoffset = String(1 - val);
        } else {
          el.style.opacity = String(val);
        }
      });
      if (!rendered) el.style.opacity = "0";
    }
  }

  async function runShowNodesEvent(
    nodes: NodeId[],
    frame: CameraFrameId,
    token: CancellationToken,
  ): Promise<void> {
    const camPromise = transitionCameraFrame(frame, token);
    await waitScaled(CAMERA_TRANSITION_MS * 0.45, token);
    for (const [idx, nodeId] of nodes.entries()) {
      if (token.cancelled) return;
      const enterPromise = animateNodeEnter(nodeId, token);
      if (idx === nodes.length - 1) {
        await enterPromise;
      } else {
        await waitScaled(200, token);
      }
    }
    if (!token.cancelled) {
      syncAllLanes(token);
      await camPromise;
      await waitScaled(300, token);
    }
  }

  async function runFocusEvent(
    { nodes, frame }: { nodes: NodeId[]; frame: CameraFrameId },
    token: CancellationToken,
  ): Promise<void> {
    const exitingNodes = (Object.keys(nodeElements) as NodeId[]).filter(
      (id) => visibleNodes.has(id) && !nodes.includes(id),
    );
    exitingNodes.forEach((id) => visibleNodes.delete(id));
    syncAllLanes(token);
    animateLaptopScreenRender(false, token);
    exitingNodes.forEach((id, idx) =>
      animateNodeExit(id, token, 120 + idx * 70),
    );
    await waitScaled(250, token);
    await transitionCameraFrame(frame, token);
    await waitScaled(250, token);
  }

  async function runNoteEvent(
    { at, text, tone = "navy" }: NoteEvent,
    token: CancellationToken,
  ): Promise<void> {
    const { x, y, side } = NODE_NOTE_ANCHORS[at] ?? {
      x: NODE_PULSE_CENTERS[at][0],
      y: NODE_PULSE_CENTERS[at][1],
      side: "top",
    };
    const translated = t(text);
    const outerGroup = createSvgElement(
      "g",
      { transform: `translate(${x} ${y}) scale(${tagScale.toFixed(3)})` },
      noteLayer,
    );
    const noteGroup = createSvgElement(
      "g",
      { class: `note ${tone}` },
      outerGroup,
    );
    const textEl = createSvgElement(
      "text",
      { class: "note-text", "dominant-baseline": "central" },
      noteGroup,
    );
    textEl.textContent = translated;

    const boxWidth =
      measureSvgTextWidth(textEl, estimateVisualUnits(translated) * 7.4, 3) + 30;
    const [boxX, boxY] =
      side === "left" ? [-boxWidth - 9, -13] : [-boxWidth / 2, -38];
    const pathD =
      side === "left"
        ? `M${boxX},${boxY} h${boxWidth} v8 l8,5 l-8,5 v8 h${-boxWidth} z`
        : `M${boxX},${boxY} h${boxWidth} v26 h${-boxWidth / 2 + 7} l-7,8 l-7,-8 h${-boxWidth / 2 + 7} z`;

    textEl.setAttribute("x", String(boxX + 23));
    textEl.setAttribute("y", String(boxY + 13));
    noteGroup.insertBefore(
      createSvgElement("circle", {
        class: "note-dot",
        cx: boxX + 13,
        cy: boxY + 13,
        r: 3.5,
      }),
      textEl,
    );
    noteGroup.insertBefore(
      createSvgElement("path", { class: "note-box", d: pathD }),
      noteGroup.firstChild,
    );

    bounceNode(at, token);
    await runScaledAnimation(320, token, (progress) =>
      noteGroup.setAttribute(
        "transform",
        `scale(${easeOutBack(progress).toFixed(3)})`,
      ),
    );
    await waitScaled(NOTE_HOLD_MS, token);
    await runScaledAnimation(200, token, (progress) => {
      noteGroup.setAttribute(
        "transform",
        `scale(${(1 - easeInCubic(progress) * 0.3).toFixed(3)})`,
      );
      noteGroup.style.opacity = String(1 - progress);
    });
    outerGroup.remove();
  }

  function setLaneActiveColor(laneKey: string, color?: PacketColor): void {
    const el = laneElements[laneKey];
    el.classList.toggle("is-active", Boolean(color));
    el.style.stroke = color ? LANE_COLORS[color] : "";
    el.setAttribute("marker-end", `url(#head-${color || "idle"})`);
  }

  const laneActiveCounts: Record<string, number> = {};

  function retainLaneHighlight(laneKey: string, color: PacketColor): void {
    laneActiveCounts[laneKey] = (laneActiveCounts[laneKey] ?? 0) + 1;
    setLaneActiveColor(laneKey, color);
  }

  function releaseLaneHighlight(laneKey: string): void {
    laneActiveCounts[laneKey] = Math.max(
      0,
      (laneActiveCounts[laneKey] ?? 0) - 1,
    );
    if (!laneActiveCounts[laneKey]) {
      setLaneActiveColor(laneKey);
    }
  }

  async function pulseNodeRing(
    nodeId: NodeId,
    color: PacketColor,
    token: CancellationToken,
  ): Promise<void> {
    const [cx, cy] = NODE_PULSE_CENTERS[nodeId];
    const circle = createSvgElement(
      "circle",
      {
        cx,
        cy,
        fill: "none",
        stroke: LANE_COLORS[color],
        "stroke-width": 2,
      },
      pulseLayer,
    );
    await runScaledAnimation(700, token, (progress) => {
      circle.setAttribute("r", String(14 + progress * 46));
      circle.setAttribute("opacity", String(0.6 * (1 - progress)));
    });
    circle.remove();
  }

  function createPacketVisual(
    color: PacketColor,
    label: string,
    payload: string[] = [],
    locked = false,
  ): { g: SVGGElement; trail: SVGCircleElement[] } {
    const translatedLabel = t(label);
    const translatedPayload = payload.map((line) => t(line));
    const trail = TRAIL_OFFSETS.map((_, idx) =>
      createSvgElement(
        "circle",
        {
          r: 3.6 - idx,
          fill: LANE_COLORS[color],
          opacity: 0.45 - idx * 0.12,
        },
        packetLayer,
      ),
    );
    const group = createSvgElement("g", { class: "packet" }, packetLayer);
    createSvgElement(
      "circle",
      { r: 13, fill: LANE_COLORS[color], opacity: 0.18 },
      group,
    );
    createSvgElement(
      "circle",
      {
        r: 6,
        fill: LANE_COLORS[color],
        stroke: "var(--panel)",
        "stroke-width": 2,
      },
      group,
    );

    const lineHeight = 15;
    const lockPad = locked ? 14 : 0;
    const bodyHeight = translatedPayload.length
      ? translatedPayload.length * lineHeight + 9
      : 0;
    const tagGroup = createSvgElement(
      "g",
      {
        class: `packet-tag ${color}`,
        transform: `translate(0 -16) scale(${tagScale.toFixed(3)})`,
      },
      group,
    );

    const payloadTexts = translatedPayload.map((line, idx) => {
      const textEl = createSvgElement(
        "text",
        {
          y: -bodyHeight + 6 + idx * lineHeight,
          "dominant-baseline": "hanging",
          class: "packet-field",
        },
        tagGroup,
      );
      textEl.textContent = line;
      return textEl;
    });

    const labelText = createSvgElement(
      "text",
      {
        "text-anchor": "middle",
        "dominant-baseline": "central",
        x: lockPad / 2,
        y: -bodyHeight - 10.5,
        class: "packet-label",
      },
      tagGroup,
    );
    labelText.textContent = translatedLabel;

    const labelWidth = measureSvgTextWidth(
      labelText,
      estimateVisualUnits(translatedLabel) * 7.6,
    );
    const boxWidth = Math.max(
      labelWidth + 16 + lockPad,
      ...payloadTexts.map(
        (el, idx) =>
          measureSvgTextWidth(
            el,
            estimateVisualUnits(translatedPayload[idx]) * 6.2,
          ) + 16,
      ),
    );

    payloadTexts.forEach((el, idx) => {
      const isRtlLine = RTL_SCRIPT_REGEX.test(translatedPayload[idx]);
      el.setAttribute("x", String(isRtlLine ? boxWidth / 2 - 8 : -boxWidth / 2 + 8));
      if (isRtlLine) el.setAttribute("text-anchor", "end");
    });

    tagGroup.insertBefore(
      createSvgElement("rect", {
        x: -boxWidth / 2,
        y: -bodyHeight - 22,
        width: boxWidth,
        height: 22,
        rx: 3,
        fill: LANE_COLORS[color],
      }),
      labelText,
    );

    if (bodyHeight) {
      tagGroup.insertBefore(
        createSvgElement("rect", {
          x: -boxWidth / 2,
          y: -bodyHeight - 4,
          width: boxWidth,
          height: bodyHeight + 4,
          rx: 3,
          class: "packet-body",
          stroke: LANE_COLORS[color],
        }),
        tagGroup.firstChild,
      );
    }

    if (locked) {
      const lockX = -labelWidth / 2 - 4;
      createSvgElement(
        "path",
        {
          class: "packet-lock",
          d: `M${lockX - 6},${-bodyHeight - 10} v-2.4 a3,3 0 0 1 6,0 v2.4 M${lockX - 7.5},${-bodyHeight - 10} h9 v6.5 h-9 z`,
        },
        tagGroup,
      );
    }

    return { g: group, trail };
  }

  const setPacketTransform = (
    el: SVGGElement,
    pos: { x: number; y: number },
    scale = 1,
  ): void =>
    el.setAttribute(
      "transform",
      `translate(${pos.x.toFixed(1)} ${pos.y.toFixed(1)}) scale(${scale.toFixed(3)})`,
    );

  async function animateDroppedPacket(
    visual: { g: SVGGElement; trail: SVGCircleElement[] },
    pos: { x: number; y: number },
    activeRouteLanes: string[],
    token: CancellationToken,
  ): Promise<void> {
    const cross = createSvgElement(
      "path",
      {
        class: "drop-cross",
        d: "M-6,-6 L6,6 M6,-6 L-6,6",
        transform: `translate(${pos.x} ${pos.y})`,
      },
      packetLayer,
    );
    await runScaledAnimation(520, token, (progress) => {
      setPacketTransform(
        visual.g,
        { x: pos.x, y: pos.y + 26 * easeInCubic(progress) },
        1 - 0.4 * progress,
      );
      visual.g.style.opacity = String(1 - progress);
      visual.trail.forEach((tEl) =>
        tEl.setAttribute("opacity", String(0.3 * (1 - progress))),
      );
      cross.setAttribute(
        "transform",
        `translate(${pos.x} ${pos.y}) scale(${easeOutBack(Math.min(1, progress * 2)).toFixed(3)})`,
      );
    });
    visual.g.remove();
    visual.trail.forEach((tEl) => tEl.remove());
    activeRouteLanes.forEach(releaseLaneHighlight);
    await waitScaled(500, token);
    await runScaledAnimation(
      250,
      token,
      (progress) => (cross.style.opacity = String(1 - progress)),
    );
    cross.remove();
  }

  async function runPacketEvent(
    { from, to, color, label, payload, locked, lost, quick }: PacketEvent,
    token: CancellationToken,
  ): Promise<void> {
    const route = ROUTE_LANES[`${from}>${to}`];
    const speed = quick ? PACKET_SPEED_PX_PER_MS * 2.4 : PACKET_SPEED_PX_PER_MS;
    const dropHopIndex = lost
      ? route.findIndex((laneKey) => laneKey.includes("internet"))
      : -1;
    const traversedLanes = route.filter(
      (_, idx) => dropHopIndex < 0 || idx <= dropHopIndex,
    );
    traversedLanes.forEach((laneKey) => retainLaneHighlight(laneKey, color));

    const visual = createPacketVisual(color, label, payload, locked);
    const startPt = interpolateLanePoint(LANE_COORDS[route[0]], 0);
    await runScaledAnimation(quick ? 140 : 220, token, (progress) =>
      setPacketTransform(visual.g, startPt, easeOutBack(progress)),
    );

    let curPt = startPt;
    for (const [hopIdx, laneKey] of route.entries()) {
      if (token.cancelled) return;
      const coords = LANE_COORDS[laneKey];
      const maxRatio = hopIdx === dropHopIndex ? 0.55 : 1;
      await runScaledAnimation(
        (getLaneLength(coords) * maxRatio) / speed,
        token,
        (progress) => {
          curPt = interpolateLanePoint(coords, progress * maxRatio);
          setPacketTransform(visual.g, curPt);
          visual.trail.forEach((trailEl, tIdx) => {
            const trailPt = interpolateLanePoint(
              coords,
              Math.max(
                0,
                progress * maxRatio - TRAIL_OFFSETS[tIdx] / getLaneLength(coords),
              ),
            );
            trailEl.setAttribute("cx", String(trailPt.x));
            trailEl.setAttribute("cy", String(trailPt.y));
          });
        },
      );
      if (token.cancelled) return;
      if (hopIdx === dropHopIndex) {
        return animateDroppedPacket(visual, curPt, traversedLanes, token);
      }
      bounceNode(laneKey.split(">")[1] as NodeId, token);
      if (hopIdx < route.length - 1) {
        await waitScaled(quick ? 40 : HOP_PAUSE_MS, token);
      }
    }

    pulseNodeRing(to, color, token);
    await runScaledAnimation(180, token, (progress) => {
      setPacketTransform(visual.g, curPt, 1 - easeInCubic(progress));
      visual.trail.forEach((tEl) =>
        tEl.setAttribute("opacity", String(0.3 * (1 - progress))),
      );
    });
    visual.g.remove();
    visual.trail.forEach((tEl) => tEl.remove());
    route.forEach(releaseLaneHighlight);
    await waitScaled(150, token);
  }

  async function runStreamEvent(
    { packets, spacing = 480 }: StreamEvent,
    token: CancellationToken,
  ): Promise<void> {
    const promises: Promise<void>[] = [];
    for (const [idx, pkt] of packets.entries()) {
      if (token.cancelled) return;
      promises.push(runPacketEvent(pkt, token));
      if (idx < packets.length - 1) {
        await waitScaled(spacing, token);
      }
    }
    await Promise.all(promises);
  }

  let currentCustomLabels: Partial<Record<NodeId, [string, string]>> = {};

  function applyNodeLabels(
    customLabels: Partial<Record<NodeId, [string, string]>>,
  ): void {
    currentCustomLabels = customLabels;
    for (const [nodeId, nodeEl] of Object.entries(nodeElements) as Array<
      [NodeId, SVGGElement]
    >) {
      const [rawName, ipText] =
        customLabels[nodeId] ?? DEFAULT_NODE_LABELS[nodeId];
      const targetTexts = [t(rawName), ipText];
      const textEls = [
        nodeEl.querySelector<SVGTextElement>(".node-name"),
        nodeEl.querySelector<SVGTextElement>(".node-ip"),
      ];
      const labelGroup = nodeEl.querySelector<SVGGElement>(".node-label")!;

      textEls.forEach((el, idx) => {
        if (!el || el.textContent === targetTexts[idx]) return;
        if (!(visibleNodes.has(nodeId) && nodeEl.style.opacity !== "0")) {
          el.textContent = targetTexts[idx];
          applyNodeLabelScale(labelGroup);
          return;
        }
        el.animate([{ opacity: 1 }, { opacity: 0 }], {
          duration: 140,
          fill: "forwards",
        }).onfinish = (ev) => {
          el.textContent = targetTexts[idx];
          applyNodeLabelScale(labelGroup);
          (ev.target as Animation).cancel();
          el.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 220 });
        };
      });
    }
  }

  function setUrlBarContent(text: string, secure?: boolean): void {
    urlBar.classList.toggle("is-secure", Boolean(secure));
    urlText.textContent = text;
    const textWidth = urlText.getComputedTextLength();
    urlBox.setAttribute("width", (textWidth + 58).toFixed(1));
    urlCheck.setAttribute("transform", `translate(${(textWidth + 38).toFixed(1)} 0)`);
  }

  async function runTypeUrlEvent(
    text: string,
    secure: boolean | undefined,
    token: CancellationToken,
  ): Promise<void> {
    setUrlBarContent(text, secure);
    urlText.textContent = "";
    urlCaret.setAttribute("x", "29");
    urlBar.classList.add("is-visible", "is-typing");
    await waitScaled(400, token);
    for (let i = 1; i <= text.length; i++) {
      if (token.cancelled) return;
      urlText.textContent = text.slice(0, i);
      urlCaret.setAttribute("x", String(30 + urlText.getComputedTextLength()));
      await waitScaled(TYPING_CHAR_MS, token);
    }
    if (!token.cancelled) {
      urlBar.classList.remove("is-typing");
      bounceNode("client", token);
      await waitScaled(500, token);
    }
  }

  async function runRenderEvent(token: CancellationToken): Promise<void> {
    await waitScaled(200, token);
    await animateLaptopScreenRender(true, token);
    if (!token.cancelled) {
      urlBar.classList.add("is-loaded");
      pulseNodeRing("client", "green", token);
      await waitScaled(500, token);
    }
  }

  function resetUrlBar(): void {
    urlBar.classList.remove("is-visible", "is-typing", "is-loaded");
    urlText.textContent = "";
  }

  Object.keys(laneElements).forEach((laneKey) => setLaneDrawProgress(laneKey, 0));

  return {
    run(event, token) {
      return event.type === "packet"
        ? runPacketEvent(event, token)
        : event.type === "stream"
          ? runStreamEvent(event, token)
          : event.type === "type-url"
            ? runTypeUrlEvent(event.text, event.secure, token)
            : event.type === "focus"
              ? runFocusEvent(event, token)
              : event.type === "show"
                ? runShowNodesEvent(event.nodes, event.frame, token)
                : event.type === "camera"
                  ? transitionCameraFrame(event.frame, token)
                  : event.type === "render"
                    ? runRenderEvent(token)
                    : event.type === "note"
                      ? runNoteEvent(event, token)
                      : Promise.resolve();
    },
    retext() {
      applyNodeLabels(currentCustomLabels);
    },
    overview(nodes, customLabels = {}) {
      lessonNodes = nodes;
      applyNodeLabels(customLabels);
      (Object.keys(nodeElements) as NodeId[]).forEach((id) =>
        setNodeVisibleImmediate(id, lessonNodes.includes(id)),
      );
      syncAllLanes();
      resetUrlBar();
      setLaptopScreenRenderedImmediate(true);
      setCameraFrameState("full");
      handleResize();
    },
    apply(event) {
      if (event.type === "focus") {
        (Object.keys(nodeElements) as NodeId[]).forEach((id) =>
          setNodeVisibleImmediate(id, event.nodes.includes(id)),
        );
        syncAllLanes();
        resetUrlBar();
        setLaptopScreenRenderedImmediate(false);
        setCameraFrameState(event.frame);
        handleResize();
      }
      if (event.type === "type-url") {
        setUrlBarContent(event.text, event.secure);
        urlBar.classList.add("is-visible");
      }
      if (event.type === "show") {
        event.nodes.forEach((id) => setNodeVisibleImmediate(id, true));
        syncAllLanes();
      }
      if (event.type === "show" || event.type === "camera") {
        setCameraFrameState(event.frame);
        handleResize();
      }
      if (event.type === "render") {
        setLaptopScreenRenderedImmediate(true);
        urlBar.classList.add("is-loaded");
      }
    },
    snapshot() {
      return {
        view: currentViewBox,
        visible: new Set(visibleNodes),
        lanes: new Set(activeLanes),
        page: isPageRendered,
        fresh: !hasMorphedOnce,
      };
    },
    morph(prev, token) {
      hasMorphedOnce = true;
      svgEl.classList.remove("is-booting");
      const enteringNodes = CAMERA_FRAME_NODES.full.filter(
        (id) => visibleNodes.has(id) && !prev.visible.has(id),
      );
      const exitingNodes = [...prev.visible].filter(
        (id) => !visibleNodes.has(id),
      );

      if (!prev.fresh) {
        const targetVb = currentViewBox;
        applyViewBox(prev.view);
        animateCameraTo(targetVb, CAMERA_TRANSITION_MS * 0.8, token);
      }

      exitingNodes.forEach((id, idx) => animateNodeExit(id, token, idx * 60));
      enteringNodes.forEach((id, idx) =>
        animateNodeEnter(id, token, {
          delay: (prev.fresh ? 150 : 250) + idx * 110,
          ring: false,
        }),
      );

      const laneDelay = enteringNodes.length
        ? 500 + enteringNodes.length * 110
        : 0;
      for (const laneKey of Object.keys(laneElements)) {
        const isActive = activeLanes.has(laneKey);
        if (isActive !== prev.lanes.has(laneKey)) {
          animateLaneVisibility(
            laneKey,
            isActive,
            token,
            isActive ? laneDelay : 0,
          );
        }
      }
      if (isPageRendered !== prev.page) {
        animateLaptopScreenRender(
          isPageRendered,
          token,
          isPageRendered ? laneDelay + 200 : 0,
        );
      }
    },
    clear() {
      for (const child of [...packetLayer.children, ...noteLayer.children]) {
        child.animate([{ opacity: 1 }, { opacity: 0 }], {
          duration: 160,
        }).onfinish = () => child.remove();
      }
      pulseLayer.replaceChildren();
      Object.keys(laneElements).forEach((laneKey) => {
        laneActiveCounts[laneKey] = 0;
        setLaneActiveColor(laneKey);
      });
    },
  };
}
