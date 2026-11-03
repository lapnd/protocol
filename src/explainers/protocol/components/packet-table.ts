import { ICONS } from "../data";
import { escapeHtml, isPureLatinInRtl, t, tAttr } from "../i18n";
import {
  EASE_OUT_EXPO,
  animateHorizontalSwap,
  animateTextChange,
  prefersReducedMotion,
} from "../lib/motion";
import { collectLessonPackets } from "../lib/packet-dissector";
import type { Lesson, SimulationState } from "../types/protocol";

const getLtrAttr = (text: string): string =>
  isPureLatinInRtl(t(text)) ? ' dir="ltr" class="is-ltr"' : "";

function renderPacketRowsHtml(lesson: Lesson): string {
  return collectLessonPackets(lesson)
    .map(
      ({ color, row, lost }, idx) => `
      <tr data-packet="${idx}" class="${lost ? "is-lost" : ""}" tabindex="0" hidden>
        <td><span class="step-badge ${color}">${idx + 1}</span></td>
        <td><bdi dir="ltr">${escapeHtml(row.time)}</bdi></td>
        <td><bdi dir="ltr">${escapeHtml(row.src)}</bdi></td>
        <td><bdi dir="ltr">${escapeHtml(row.dst)}</bdi></td>
        <td><bdi dir="ltr">${escapeHtml(row.proto)}</bdi></td>
        <td title="${escapeHtml(t(row.info))}"${getLtrAttr(row.info)}><span ${tAttr(row.info)}</span>${lost ? `<span class="lost-chip" ${tAttr("LOST")}</span>` : ""}</td>
        <td><bdi dir="ltr">${escapeHtml(row.len)}</bdi></td>
      </tr>`,
    )
    .join("");
}

export function renderPacketTableHtml(): string {
  const headersHtml = [
    "NO.",
    "TIME",
    "SOURCE",
    "DESTINATION",
    "PROTOCOL",
    "INFO",
    "SIZE",
  ]
    .map((h) => `<th ${tAttr(h)}</th>`)
    .join("");

  return `
  <section class="panel packets">
    <div class="panel-head bar">
      <h2 class="panel-title sm" ${tAttr("PACKET FLOW")}</h2>
      <div class="packet-legend" data-t-label="Colour key" aria-label="${t("Colour key")}"></div>
      <div class="packet-actions">
        <button class="btn speed" type="button" data-action="speed" data-t-title="Playback speed" title="${t("Playback speed")}"><span class="speed-label">1×</span></button>
        <button class="btn icon" type="button" data-action="prev" data-t-title="Previous step (←)" title="${t("Previous step (←)")}" data-t-label="Previous step" aria-label="${t("Previous step")}">
          <svg viewBox="0 0 12 12" width="12" height="12" aria-hidden="true"><path d="M7.8 1.8 L3.6 6 L7.8 10.2" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
        </button>
        <button class="btn primary toggle" type="button" data-action="toggle" data-t-title="Play / pause (Space)" title="${t("Play / pause (Space)")}">
          <span class="toggle-icon">
            <svg class="icon-playpause" viewBox="0 0 12 14" width="12" height="14" aria-hidden="true"><path class="pp-a"/><path class="pp-b"/></svg>
            ${ICONS.reset.replace("<svg", '<svg class="icon-replay"')}
          </span>
          <span class="toggle-label"></span>
        </button>
        <button class="btn" type="button" data-action="step" data-t-title="One packet at a time" title="${t("One packet at a time")}"><span ${tAttr("STEP")}</span></button>
        <button class="btn" type="button" data-action="reset" data-t-title="Back to the overview (Esc)" title="${t("Back to the overview (Esc)")}" data-t-label="Reset" aria-label="${t("Reset")}">${ICONS.reset}<span class="btn-text" ${tAttr("RESET")}</span></button>
      </div>
    </div>
    <div class="packet-scroll">
      <table class="packet-table">
        <colgroup>
          <col style="width:75px"><col style="width:125px"><col style="width:161px"><col style="width:165px">
          <col style="width:129px"><col><col style="width:86px">
        </colgroup>
        <thead>
          <tr>${headersHtml}</tr>
        </thead>
        <tbody class="packet-empty-body"><tr class="packet-empty" hidden><td colspan="7" ${tAttr("No packets on the wire yet.")}</td></tr></tbody>
        <tbody class="packet-rows"></tbody>
      </table>
    </div>
  </section>`;
}

interface ToggleButtonElement extends HTMLButtonElement {
  _need?: number;
}

const syncToggleIconicMode = (toggleBtn: ToggleButtonElement): void => {
  toggleBtn.classList.toggle(
    "is-iconic",
    getComputedStyle(toggleBtn).containerType === "inline-size" &&
      toggleBtn.clientWidth < (toggleBtn._need ?? 0),
  );
};

export function initPacketTableEvents(
  packetsEl: HTMLElement,
  actions: {
    toggle: () => void;
    step: () => void;
    reset: () => void;
    prev: () => void;
    speed: () => void;
    inspect: (pktIdx: number) => void;
  },
): void {
  const toggleBtn = packetsEl.querySelector<ToggleButtonElement>(".toggle")!;
  new ResizeObserver(() => syncToggleIconicMode(toggleBtn)).observe(toggleBtn);

  packetsEl.addEventListener("click", (ev) => {
    const target = ev.target as HTMLElement;
    const actionBtn = target.closest<HTMLButtonElement>("[data-action]");
    if (actionBtn && !actionBtn.disabled) {
      const actionKey = actionBtn.dataset.action as
        | "toggle"
        | "step"
        | "reset"
        | "prev"
        | "speed";
      actions[actionKey]();
    }
    const rowEl = target.closest<HTMLTableRowElement>("tr[data-packet]");
    if (rowEl && !rowEl.hidden) {
      actions.inspect(Number(rowEl.dataset.packet));
    }
  });

  packetsEl.addEventListener("keydown", (ev) => {
    if (ev.key === "Enter") {
      const rowEl = (ev.target as HTMLElement).closest<HTMLTableRowElement>(
        "tr[data-packet]",
      );
      if (rowEl && !rowEl.hidden) {
        actions.inspect(Number(rowEl.dataset.packet));
      }
    }
  });
}

const getElementOpacity = (el: HTMLElement): number =>
  el.hidden ? 0 : Number(getComputedStyle(el).opacity);

function fadeInTableRow(rowEl: HTMLElement, delayMs = 0): void {
  const curOpacity = getElementOpacity(rowEl);
  rowEl.dataset.shown = "1";
  rowEl.getAnimations().forEach((anim) => anim.cancel());
  rowEl.hidden = false;
  if (!prefersReducedMotion() && curOpacity < 1) {
    rowEl.animate(
      [
        { opacity: curOpacity, transform: `translateY(${10 * (1 - curOpacity)}px)` },
        { opacity: 1, transform: "none" },
      ],
      {
        duration: 360,
        delay: curOpacity > 0 ? 0 : delayMs,
        easing: EASE_OUT_EXPO,
        fill: "backwards",
      },
    );
  }
}

function fadeOutTableRow(rowEl: HTMLElement): void {
  const curOpacity = getElementOpacity(rowEl);
  const curTransform = rowEl.hidden ? "none" : getComputedStyle(rowEl).transform;
  rowEl.dataset.shown = "0";
  rowEl.getAnimations().forEach((anim) => anim.cancel());
  if (prefersReducedMotion() || curOpacity === 0) {
    rowEl.hidden = true;
    return;
  }
  const anim = rowEl.animate(
    [
      { opacity: curOpacity, transform: curTransform },
      { opacity: 0, transform: curTransform },
    ],
    { duration: 180 * curOpacity, fill: "forwards" },
  );
  anim.onfinish = () => {
    if (rowEl.dataset.shown === "0") {
      rowEl.hidden = true;
    }
    anim.cancel();
  };
}

const renderPacketLegendHtml = (lesson: Lesson): string =>
  (lesson.legend ?? [])
    .map(([color, label]) =>
      color
        ? `<span class="legend-item"><i class="legend-dot step-badge ${color}"></i>${escapeHtml(t(label))}</span>`
        : `<span class="legend-note">${escapeHtml(t(label))}</span>`,
    )
    .join("");

export interface PacketsElement extends HTMLElement {
  _latest?: SimulationState;
}

function setPacketTableLesson(
  packetsEl: PacketsElement,
  lesson: Lesson,
): void {
  const rowsBody = packetsEl.querySelector<HTMLElement>(".packet-rows")!;
  const legendEl = packetsEl.querySelector<HTMLElement>(".packet-legend")!;
  const isFirstInit = !packetsEl.dataset.lesson;

  packetsEl.dataset.lesson = lesson.id;
  if (isFirstInit) {
    legendEl.innerHTML = renderPacketLegendHtml(lesson);
  } else {
    animateHorizontalSwap(
      legendEl,
      () => {
        legendEl.innerHTML = renderPacketLegendHtml(lesson);
      },
      1,
      16,
    );
  }

  const visibleRows = [...rowsBody.children].filter(
    (el): el is HTMLElement => !(el as HTMLElement).hidden,
  );
  const populateRows = () => {
    if (packetsEl.dataset.lesson === lesson.id) {
      rowsBody.innerHTML = renderPacketRowsHtml(lesson);
      rowsBody.dataset.lesson = lesson.id;
      packetsEl.querySelector<HTMLElement>(".packet-scroll")!.scrollTop = 0;
      if (packetsEl._latest) {
        syncPacketRowsState(packetsEl, packetsEl._latest);
      }
    }
  };

  if (!visibleRows.length || prefersReducedMotion()) {
    populateRows();
    return;
  }
  visibleRows.forEach(fadeOutTableRow);
  setTimeout(populateRows, 200);
}

function syncPacketRowsState(
  packetsEl: PacketsElement,
  state: SimulationState,
): void {
  const rowsBody = packetsEl.querySelector<HTMLElement>(".packet-rows")!;
  if (rowsBody.dataset.lesson !== packetsEl.dataset.lesson) return;

  const rowEls = [
    ...packetsEl.querySelectorAll<HTMLTableRowElement>("tr[data-packet]"),
  ];
  const shouldShow = rowEls.map(
    (_, idx) => !state.started || state.packets[idx] !== "future",
  );
  const newlyShown = rowEls.filter(
    (el, idx) => shouldShow[idx] && el.dataset.shown !== "1",
  );
  const newlyHidden = rowEls.filter(
    (el, idx) => !shouldShow[idx] && el.dataset.shown === "1",
  );

  newlyHidden.forEach(fadeOutTableRow);
  newlyShown.forEach((el, idx) =>
    fadeInTableRow(
      el,
      (newlyHidden.length ? 200 : 0) + (newlyShown.length > 1 ? idx * 35 : 0),
    ),
  );
  rowEls.forEach((el, idx) =>
    el.classList.toggle(
      "is-current",
      state.started && state.packets[idx] === "current",
    ),
  );

  if (state.started && newlyShown.length === 1) {
    const scrollEl = packetsEl.querySelector<HTMLElement>(".packet-scroll")!;
    requestAnimationFrame(() =>
      scrollEl.scrollTo({ top: scrollEl.scrollHeight, behavior: "smooth" }),
    );
  }
  if (!state.started && newlyShown.length) {
    packetsEl
      .querySelector<HTMLElement>(".packet-scroll")!
      .scrollTo({ top: 0, behavior: "smooth" });
  }

  const emptyRow = packetsEl.querySelector<HTMLElement>(".packet-empty")!;
  const isEmpty = state.started && !shouldShow.some(Boolean);
  if (isEmpty && emptyRow.dataset.shown !== "1") {
    fadeInTableRow(emptyRow, newlyHidden.length ? 220 : 0);
  }
  if (!isEmpty && emptyRow.dataset.shown === "1") {
    fadeOutTableRow(emptyRow);
  }
}

export function updatePacketTableState(
  packetsEl: PacketsElement,
  state: SimulationState,
  lesson: Lesson,
): void {
  packetsEl._latest = state;
  if (packetsEl.dataset.lesson !== lesson.id) {
    setPacketTableLesson(packetsEl, lesson);
  } else {
    syncPacketRowsState(packetsEl, state);
  }

  const toggleBtn = packetsEl.querySelector<HTMLButtonElement>(".toggle")!;
  toggleBtn.classList.toggle("is-playing", state.playing);
  toggleBtn.classList.toggle("is-done", state.done && !state.playing);
  animateTextChange(
    toggleBtn.querySelector<HTMLElement>(".toggle-label")!,
    t(state.playing ? "PAUSE" : state.done ? "REPLAY" : "PLAY"),
  );
  packetsEl.querySelector<HTMLButtonElement>('[data-action="step"]')!.disabled =
    state.done;
  packetsEl.querySelector<HTMLButtonElement>('[data-action="prev"]')!.disabled =
    !state.started;
}

export function measureToggleMinWidth(packetsEl: HTMLElement): void {
  const labelEl = packetsEl.querySelector<HTMLElement>(".toggle-label")!;
  const savedText = labelEl.textContent;
  labelEl.style.minWidth = "";
  const maxWidth = Math.max(
    ...["PLAY", "PAUSE", "REPLAY"].map((key) => {
      labelEl.textContent = t(key);
      return labelEl.scrollWidth;
    }),
  );
  labelEl.textContent = savedText;
  labelEl.style.minWidth = `${maxWidth}px`;

  const toggleBtn = packetsEl.querySelector<ToggleButtonElement>(".toggle")!;
  const computed = getComputedStyle(toggleBtn);
  toggleBtn._need =
    maxWidth +
    16 +
    parseFloat(computed.columnGap || "12") +
    parseFloat(computed.paddingLeft) +
    parseFloat(computed.paddingRight) +
    2;
  syncToggleIconicMode(toggleBtn);
}

export function retranslatePacketTable(
  packetsEl: HTMLElement,
  lesson: Lesson,
): void {
  packetsEl.querySelector<HTMLElement>(".packet-legend")!.innerHTML =
    renderPacketLegendHtml(lesson);
  measureToggleMinWidth(packetsEl);
  packetsEl
    .querySelectorAll<HTMLTableCellElement>("tr[data-packet] td[title]")
    .forEach((td) => {
      const span = td.querySelector<HTMLElement>("[data-t]")!;
      const translated = t(span.dataset.t!);
      td.title = translated;
      const ltr = isPureLatinInRtl(translated);
      td.classList.toggle("is-ltr", ltr);
      if (ltr) {
        td.dir = "ltr";
      } else {
        td.removeAttribute("dir");
      }
    });
}

export function updateSpeedLabel(packetsEl: HTMLElement, speed: number): void {
  animateTextChange(
    packetsEl.querySelector<HTMLElement>(".speed-label")!,
    `${speed}×`,
  );
}
