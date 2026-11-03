import { escapeHtml, isolateBidi, t, tAttr } from "../i18n";
import { EASE_OUT_EXPO, animateHorizontalSwap, isReducedMotion } from "../lib/motion";
import { collectLessonPackets, dissectLessonFrames } from "../lib/packet-dissector";
import type {
  DissectedField,
  DissectedFrame,
  LayerColor,
  Lesson,
} from "../types/protocol";
import { renderNetworkTopologySvg } from "./isometric-topology";
import { renderSequenceDiagramHtml } from "./sequence-diagram";

const LAYER_COLORS: Record<string, LayerColor> = {
  eth: "slate",
  arp: "amber",
  ip: "blue",
  tcp: "green",
  udp: "green",
  icmp: "amber",
  tls: "teal",
  pad: "grey",
};

const getLayerColor = (layerId: string): LayerColor => LAYER_COLORS[layerId] ?? "violet";

const LAYER_SHORT_NAMES: Record<string, string> = {
  eth: "Ethernet",
  arp: "ARP",
  ip: "IPv4",
  tcp: "TCP",
  udp: "UDP",
  icmp: "ICMP",
  pad: "Padding",
  tls: "TLS",
};

export function renderPacketInspectorHtml(): string {
  return `
  <div class="inspector" hidden data-t-label="Packet inspector" aria-label="${t("Packet inspector")}">
    <div class="ins-head">
      <span class="ins-badge step-badge"></span>
      <div class="ins-title"><b></b><span></span></div>
      <div class="ins-nav">
        <button type="button" data-ins="prev" data-t-label="Previous packet" aria-label="${t("Previous packet")}" data-t-title="Previous packet (←)" title="${t("Previous packet (←)")}">‹</button>
        <button type="button" data-ins="next" data-t-label="Next packet" aria-label="${t("Next packet")}" data-t-title="Next packet (→)" title="${t("Next packet (→)")}">›</button>
        <button type="button" data-ins="close" data-t-label="Close" aria-label="${t("Close")}" data-t-title="Close (Esc)" title="${t("Close (Esc)")}">✕</button>
      </div>
    </div>
    <div class="ins-where"></div>
    <div class="ins-bar"></div>
    <div class="ins-body">
      <div class="ins-tree"></div>
      <div class="ins-hex"></div>
    </div>
    <div class="ins-foot"><span><i class="eg" ${tAttr("E.G.")}</i> <span ${tAttr("an example value: it differs in every real capture")}</span></span><span><b>··</b> <span ${tAttr("bytes the lesson can’t show: encrypted, random, or a file’s contents")}</span></span></div>
  </div>`;
}

function renderInspectorFieldHtml(field: DissectedField, index: number): string {
  const rangeAttrs =
    field.to > field.from ? ` data-from="${field.from}" data-to="${field.to}"` : "";
  const classes = [
    `d${field.depth ?? 0}`,
    field.heading && "is-heading",
    field.hidden && "is-hidden",
    field.inside && "is-inside",
    field.mono && "is-mono",
  ]
    .filter(Boolean)
    .join(" ");

  return `
    <div class="ins-field ${classes}" data-field="${index}"${rangeAttrs}>
      <span class="ins-name">${escapeHtml(t(field.name))}</span>
      <span class="ins-value">${escapeHtml(t(field.value))}${field.example ? ` <i class="eg">${t("E.G.")}</i>` : ""}</span>
      ${field.note ? `<p class="ins-note">${escapeHtml(t(field.note))}</p>` : ""}
    </div>`;
}

function renderInspectorTreeHtml(frame: DissectedFrame): string {
  return frame.layers
    .map((layer) => {
      const layerFields = frame.fields
        .map((f, idx): [DissectedField, number] => [f, idx])
        .filter(([f]) => f.layer === layer.id);
      return `
      <section class="ins-layer c-${getLayerColor(layer.id)}" data-layer="${layer.id}">
        <h4><span>${escapeHtml(t(layer.name))}</span>${layer.summary ? `<em>${escapeHtml(t(layer.summary))}</em>` : ""}</h4>
        ${layerFields.map(([f, idx]) => renderInspectorFieldHtml(f, idx)).join("")}
        
      </section>`;
    })
    .join("");
}

function renderInspectorHexHtml(frame: DissectedFrame): string {
  const findLayerIdAtByte = (byteOffset: number) =>
    frame.layers.find((l) => byteOffset >= l.from && byteOffset < l.to)?.id ?? "pad";

  const rows: string[] = [];
  for (let rowOffset = 0; rowOffset < frame.bytes.length; rowOffset += 16) {
    const chunk = frame.bytes.slice(rowOffset, rowOffset + 16);
    const hexSpans = chunk
      .map(
        (byteVal, col) =>
          `<span class="hx c-${getLayerColor(findLayerIdAtByte(rowOffset + col))}${byteVal === null ? " is-unknown" : ""}" data-i="${rowOffset + col}">${byteVal === null ? "··" : byteVal.toString(16).padStart(2, "0")}</span>`,
      )
      .join("");
    const asciiSpans = chunk
      .map(
        (byteVal, col) =>
          `<span class="as${byteVal === null ? " is-unknown" : ""}" data-i="${rowOffset + col}">${byteVal === null ? "·" : byteVal >= 32 && byteVal < 127 ? escapeHtml(String.fromCharCode(byteVal)) : "."}</span>`,
      )
      .join("");
    rows.push(
      `<div class="hx-row"><span class="hx-at">${rowOffset.toString(16).padStart(4, "0")}</span><span class="hx-bytes">${hexSpans}</span><span class="hx-text">${asciiSpans}</span></div>`,
    );
  }

  return `<div class="hx-head">${t("BYTES")} <span>${t("{n} in this frame", { n: frame.bytes.length })}</span></div>${rows.join("")}`;
}

function renderInspectorBarHtml(frame: DissectedFrame): string {
  const totalBytes = frame.bytes.length;
  return frame.layers
    .map((layer) => {
      const len = layer.to - layer.from;
      const shortName = LAYER_SHORT_NAMES[layer.id] ?? layer.name.split(" ·")[0];
      return `<span class="ins-seg c-${getLayerColor(layer.id)}" data-layer="${layer.id}" style="flex:${Math.max(len, totalBytes * 0.045)}" title="${escapeHtml(t(layer.name))}"><b>${escapeHtml(t(shortName))}</b><i>${len}</i></span>`;
    })
    .join("");
}

export interface InspectorElement extends HTMLElement {
  _frame?: DissectedFrame | null;
}

function renderInspectorHeader(
  insEl: InspectorElement,
  lesson: Lesson,
  pktIdx: number,
): void {
  const frame = dissectLessonFrames(lesson)[pktIdx]!;
  const pktEvent = collectLessonPackets(lesson)[pktIdx];
  const row = pktEvent.row;
  insEl.dataset.index = String(pktIdx);

  const badgeEl = insEl.querySelector<HTMLElement>(".ins-badge")!;
  badgeEl.className = `ins-badge step-badge ${pktEvent.color}`;
  badgeEl.textContent = String(pktIdx + 1);

  insEl.querySelector<HTMLElement>(".ins-title b")!.textContent = t(pktEvent.label);
  insEl.querySelector<HTMLElement>(".ins-title span")!.textContent = isolateBidi(
    `${row.time} · ${row.src} → ${row.dst} · ${row.proto} · ${row.len}`,
  );

  const whereParts = [t(frame.at)];
  if (frame.segments > 1 && frame.messageLength !== null) {
    whereParts.push(
      t(
        "This row stands for {n} TCP segments carrying a {size}-byte message; the first segment is shown",
        {
          n: frame.segments,
          size: frame.messageLength.toLocaleString(t("en-US")),
        },
      ),
    );
  }
  if (pktEvent.lost) {
    whereParts.push(t("This packet was lost on the way"));
  }
  insEl.querySelector<HTMLElement>(".ins-where")!.textContent = whereParts.join(" · ");
  insEl.querySelector<HTMLElement>(".ins-bar")!.innerHTML = renderInspectorBarHtml(frame);
}

function renderInspectorBody(
  insEl: InspectorElement,
  lesson: Lesson,
  pktIdx: number,
): void {
  const frame = dissectLessonFrames(lesson)[pktIdx]!;
  const treeEl = insEl.querySelector<HTMLElement>(".ins-tree")!;
  const hexEl = insEl.querySelector<HTMLElement>(".ins-hex")!;
  treeEl.innerHTML = renderInspectorTreeHtml(frame);
  hexEl.innerHTML = renderInspectorHexHtml(frame);
  treeEl.scrollTop = 0;
  hexEl.scrollTop = 0;
  insEl._frame = frame;
}

function renderInspectorContent(
  insEl: InspectorElement,
  lesson: Lesson,
  pktIdx: number,
): void {
  renderInspectorHeader(insEl, lesson, pktIdx);
  renderInspectorBody(insEl, lesson, pktIdx);
}

function highlightInspectorBytes(
  insEl: InspectorElement,
  from?: number,
  to?: number,
  fieldEl?: Element | null,
): void {
  insEl.querySelectorAll(".is-lit").forEach((el) => el.classList.remove("is-lit"));
  if (from !== undefined && to !== undefined) {
    for (let i = from; i < to; i++) {
      insEl
        .querySelectorAll(`[data-i="${i}"]`)
        .forEach((el) => el.classList.add("is-lit"));
    }
    fieldEl?.classList.add("is-lit");
  }
}

function bindInspectorEvents(
  insEl: InspectorElement,
  actions: { prev: () => void; next: () => void; close: () => void },
): void {
  insEl.addEventListener("click", (ev) => {
    const target = ev.target as HTMLElement;
    const actionBtn = target.closest<HTMLElement>("[data-ins]");
    if (actionBtn) {
      const actionKey = actionBtn.dataset.ins as "prev" | "next" | "close";
      actions[actionKey]();
    }
    const segBtn = target.closest<HTMLElement>(".ins-seg");
    if (segBtn) {
      insEl
        .querySelector(`.ins-layer[data-layer="${segBtn.dataset.layer}"]`)
        ?.scrollIntoView({
          block: "start",
          behavior: isReducedMotion() ? "auto" : "smooth",
        });
    }
  });

  insEl.addEventListener("mouseover", (ev) => {
    const target = ev.target as HTMLElement;
    const fieldEl = target.closest<HTMLElement>(".ins-field[data-from]");
    if (fieldEl) {
      highlightInspectorBytes(
        insEl,
        Number(fieldEl.dataset.from),
        Number(fieldEl.dataset.to),
        fieldEl,
      );
      return;
    }
    const byteEl = target.closest<HTMLElement>("[data-i]");
    if (byteEl && insEl._frame) {
      const byteIdx = Number(byteEl.dataset.i);
      const matchingFields = insEl._frame.fields
        .map((f, idx): [DissectedField, number] => [f, idx])
        .filter(([f]) => byteIdx >= f.from && byteIdx < f.to)
        .sort((a, b) => a[0].to - a[0].from - (b[0].to - b[0].from));
      if (!matchingFields.length) {
        highlightInspectorBytes(insEl, byteIdx, byteIdx + 1);
        return;
      }
      const [bestField, bestIdx] = matchingFields[0];
      const domField = insEl.querySelector(`.ins-field[data-field="${bestIdx}"]`);
      highlightInspectorBytes(insEl, bestField.from, bestField.to, domField);
      domField?.scrollIntoView({ block: "nearest" });
    }
  });

  insEl.addEventListener("mouseleave", () => highlightInspectorBytes(insEl));
}

export interface PacketInspectorController {
  open: (lesson: Lesson, pktIdx: number) => void;
  close: () => void;
  step: (delta: number) => void;
  isOpen: () => boolean;
  index: () => number | null;
}

export function createPacketInspectorController(
  insEl: InspectorElement,
  {
    visible,
    onChange,
  }: {
    visible: () => number[];
    onChange: (idx: number | null) => void;
  },
): PacketInspectorController {
  let currentLesson: Lesson | null = null;
  const isOpen = () => !insEl.hidden && !insEl.classList.contains("is-closing");

  function open(lesson: Lesson, pktIdx: number) {
    currentLesson = lesson;
    const alreadyOpen = isOpen();
    insEl.getAnimations().forEach((anim) => anim.cancel());
    insEl.classList.remove("is-closing");
    insEl.hidden = false;
    renderInspectorContent(insEl, lesson, pktIdx);
    if (!alreadyOpen && !isReducedMotion()) {
      insEl.animate(
        [
          { opacity: 0, transform: "translateY(26px)" },
          { opacity: 1, transform: "none" },
        ],
        { duration: 320, easing: EASE_OUT_EXPO },
      );
    }
    onChange(pktIdx);
  }

  function close() {
    if (!insEl.hidden) {
      onChange(null);
      if (isReducedMotion()) {
        insEl.hidden = true;
        return;
      }
      insEl.classList.add("is-closing");
      insEl.getAnimations().forEach((anim) => anim.cancel());
      insEl.animate(
        [
          { opacity: 1, transform: "none" },
          { opacity: 0, transform: "translateY(18px)" },
        ],
        { duration: 200, easing: "ease-in" },
      ).onfinish = () => {
        if (insEl.classList.contains("is-closing")) {
          insEl.classList.remove("is-closing");
          insEl.hidden = true;
        }
      };
    }
  }

  function step(delta: number) {
    if (!isOpen() || !currentLesson) return;
    const visList = visible();
    const curPos = visList.indexOf(Number(insEl.dataset.index));
    const nextIdx = visList[curPos + delta];
    if (nextIdx !== undefined) {
      insEl.dataset.index = String(nextIdx);
      renderInspectorHeader(insEl, currentLesson, nextIdx);
      animateHorizontalSwap(
        insEl.querySelector<HTMLElement>(".ins-body")!,
        () =>
          insEl.dataset.index === String(nextIdx) &&
          renderInspectorBody(insEl, currentLesson!, nextIdx),
        delta,
        14,
      );
      onChange(nextIdx);
    }
  }

  bindInspectorEvents(insEl, {
    prev: () => step(-1),
    next: () => step(1),
    close,
  });

  return {
    open,
    close,
    step,
    isOpen,
    index: () => (isOpen() ? Number(insEl.dataset.index) : null),
  };
}

const VIEW_TABS: Array<["network" | "sequence", string, string]> = [
  [
    "network",
    "NETWORK",
    '<svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true"><path d="M8 1.8 L14 5 L8 8.2 L2 5 Z M2 8.4 L8 11.6 L14 8.4 M2 11.6 L8 14.8 L14 11.6" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/></svg>',
  ],
  [
    "sequence",
    "SEQUENCE",
    '<svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true"><path d="M3 1.5 V14.5 M13 1.5 V14.5" stroke="currentColor" stroke-width="1.5" stroke-dasharray="2 2"/><path d="M3 4.5 L12 6.5 M12 6.5 L9.6 7.4 M12 6.5 L10.2 4.6 M13 9.5 L4 11.5 M4 11.5 L5.8 9.6 M4 11.5 L6.4 12.4" stroke="currentColor" stroke-width="1.5" fill="none" stroke-linecap="round"/></svg>',
  ],
];

export function renderSimulationPanelHtml(): string {
  const buttonsHtml = VIEW_TABS.map(
    ([viewKey, label, iconSvg], idx) =>
      `<button type="button" role="tab" data-view="${viewKey}" aria-selected="${idx === 0}" class="${idx === 0 ? "is-active" : ""}">${iconSvg}<span ${tAttr(label)}</span></button>`,
  ).join("");

  return `
  <section class="panel simulation">
    ${renderNetworkTopologySvg()}
    ${renderSequenceDiagramHtml()}
    <div class="view-switch" role="tablist" data-t-label="View" aria-label="${t("View")}" data-t-title="Switch view (V)" title="${t("Switch view (V)")}">${buttonsHtml}<i class="view-indicator"></i></div>
    ${renderPacketInspectorHtml()}
  </section>`;
}

const VIEW_STORAGE_KEY = "protocol-explorer:view";

const loadSavedView = (): string | null => {
  try {
    return localStorage.getItem(VIEW_STORAGE_KEY);
  } catch {
    return null;
  }
};

export function initSimulationViewSwitcher(
  simEl: HTMLElement,
  onViewChange: (view: "network" | "sequence") => void = () => {},
): {
  toggle: () => void;
  view: () => "network" | "sequence";
} {
  const indicatorEl = simEl.querySelector<HTMLElement>(".view-indicator")!;

  function setView(view: "network" | "sequence", persist = true) {
    simEl.classList.toggle("is-sequence", view === "sequence");
    simEl.querySelectorAll<HTMLButtonElement>(".view-switch button").forEach((btn) => {
      const active = btn.dataset.view === view;
      btn.classList.toggle("is-active", active);
      btn.setAttribute("aria-selected", String(active));
      if (active) {
        indicatorEl.style.left = `${btn.offsetLeft}px`;
        indicatorEl.style.width = `${btn.offsetWidth}px`;
      }
    });
    onViewChange(view);
    if (persist) {
      try {
        localStorage.setItem(VIEW_STORAGE_KEY, view);
      } catch {}
    }
  }

  simEl.querySelector(".view-switch")!.addEventListener("click", (ev) => {
    const btn = (ev.target as HTMLElement).closest<HTMLButtonElement>("button");
    if (btn && (btn.dataset.view === "network" || btn.dataset.view === "sequence")) {
      setView(btn.dataset.view);
    }
  });

  setView(loadSavedView() === "sequence" ? "sequence" : "network", false);
  requestAnimationFrame(() => indicatorEl.classList.add("is-ready"));

  const updateIndicatorPosition = () => {
    const activeBtn = simEl.querySelector<HTMLButtonElement>(
      ".view-switch button.is-active",
    );
    if (activeBtn) {
      indicatorEl.style.left = `${activeBtn.offsetLeft}px`;
      indicatorEl.style.width = `${activeBtn.offsetWidth}px`;
    }
  };
  const ro = new ResizeObserver(updateIndicatorPosition);
  simEl.querySelectorAll(".view-switch button").forEach((btn) => ro.observe(btn));

  return {
    toggle: () =>
      setView(simEl.classList.contains("is-sequence") ? "network" : "sequence"),
    view: () => (simEl.classList.contains("is-sequence") ? "sequence" : "network"),
  };
}
