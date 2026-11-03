import { ICONS } from "../data";
import {
  escapeHtml,
  isRtl,
  isolateBidi,
  t,
  tAttr,
  toLocaleUpper,
} from "../i18n";
import {
  EASE_OUT_EXPO,
  animateHorizontalSwap,
  animateTextChange,
  prefersReducedMotion,
} from "../lib/motion";
import { collectLessonPackets } from "../lib/packet-dissector";
import type {
  FactPair,
  Lesson,
  NodeId,
  PacketEvent,
  SimulationState,
  StreamEvent,
} from "../types/protocol";
import { SHORT_NODE_NAMES } from "./isometric-topology";

const getNodeShortLabel = (lesson: Lesson, nodeId: NodeId): string =>
  t(lesson.labels?.[nodeId]?.[0] ?? SHORT_NODE_NAMES[nodeId]);

const PILL_LOCK_SVG =
  '<svg class="pill-lock" viewBox="0 0 12 14" width="10" height="12" aria-hidden="true"><path d="M3 6.5 V4.5 a3 3 0 0 1 6 0 V6.5" fill="none" stroke="currentColor" stroke-width="1.6"/><rect x="1.5" y="6.5" width="9" height="6.5" rx="1.3" fill="currentColor"/></svg>';

const renderFactsHtml = (facts: FactPair[]): string =>
  facts
    .map(
      ([label, val]) =>
        `<div><dt>${escapeHtml(toLocaleUpper(t(label)))}</dt><dd>${escapeHtml(t(val))}</dd></div>`,
    )
    .join("");

export function renderOverviewPanelHtml(): string {
  return `
  <section class="panel overview">
    <div class="panel-head bar">
      <h2 class="panel-title sm"></h2>
      <button class="more" type="button" data-t-label="More" aria-label="${t("More")}">${ICONS.dots}</button>
      <button class="back-btn" type="button" hidden>${ICONS.back}<span ${tAttr("OVERVIEW")}</span></button>
    </div>

    <div class="overview-stage">
      <div class="overview-body" data-view="overview">
        <div class="overview-name">
          <h3></h3>
          <span class="badge"><i></i><span ${tAttr("ACTIVE")}</span></span>
        </div>
        <p class="overview-full"></p>
        <p class="overview-desc"></p>
        <dl class="facts overview-facts"></dl>
      </div>

      <div class="overview-body explain" data-view="step" hidden aria-live="polite">
        <div class="explain-label"></div>
        <h3 class="explain-title"></h3>
        <p class="explain-sub"></p>
        <p class="explain-text"></p>
        <div class="explain-packet">
          <div class="explain-packet-clip">
            <div class="explain-packet-card">
              <div class="explain-packet-inner">
                <div class="explain-packet-head"><b></b><span></span></div>
                <div class="explain-payload"></div>
                <div class="explain-meta"></div>
              </div>
            </div>
          </div>
        </div>
        <dl class="facts explain-facts"></dl>
      </div>
    </div>
  </section>`;
}

export function initOverviewEvents(
  overviewEl: HTMLElement,
  onBack: () => void,
): void {
  overviewEl.querySelector(".back-btn")!.addEventListener("click", onBack);
}

interface OverviewPacketInfo {
  number: number;
  count: number;
  total: number;
  event: PacketEvent | StreamEvent;
}

interface OverviewContentInfo {
  label: string;
  title: string;
  desc: string;
  text: string;
  facts?: FactPair[];
  done?: boolean;
}

interface OverviewViewModel {
  lesson: Lesson;
  order: number;
  view: "overview" | "step";
  title: string;
  rank: number;
  content: OverviewContentInfo;
  packet: OverviewPacketInfo | null;
}

export interface OverviewElement extends HTMLElement {
  _shown?: OverviewViewModel | null;
  _latest?: OverviewViewModel;
}

function buildOverviewViewModel(
  state: SimulationState,
  lesson: Lesson,
  order: number,
): OverviewViewModel {
  const step = lesson.steps[state.activeStep];
  const allPkts = collectLessonPackets(lesson);
  const ev = state.event;
  const hasPacket =
    state.started &&
    !state.done &&
    (ev?.type === "packet" || ev?.type === "stream") &&
    ev.step === state.activeStep;

  const pktNum =
    hasPacket && (ev.type === "packet" || ev.type === "stream")
      ? allPkts.indexOf(
          ev.type === "stream"
            ? ev.packets[0]
            : allPkts.find((p) => p.row === ev.row)!,
        ) + 1
      : 0;

  return {
    lesson,
    order,
    view: state.started ? "step" : "overview",
    title: t(
      state.started
        ? state.done
          ? "LESSON SUMMARY"
          : "STEP DETAILS"
        : "PROTOCOL OVERVIEW",
    ),
    rank: state.started
      ? state.done
        ? lesson.steps.length
        : state.activeStep
      : -1,
    content: state.done
      ? { label: t("LESSON COMPLETE"), ...lesson.outro, done: true }
      : {
          label: t("STEP {n} OF {total}", {
            n: state.activeStep + 1,
            total: lesson.steps.length,
          }),
          title: step.title,
          desc: step.desc,
          text: step.detail,
          facts: step.facts,
        },
    packet:
      hasPacket && (ev.type === "packet" || ev.type === "stream")
        ? {
            number: pktNum,
            count: ev.type === "stream" ? ev.packets.length : 1,
            total: allPkts.length,
            event: ev,
          }
        : null,
  };
}

function populateOverviewCard(overviewEl: HTMLElement, lesson: Lesson): void {
  const ovBody = overviewEl.querySelector<HTMLElement>('[data-view="overview"]')!;
  ovBody.querySelector("h3")!.textContent = lesson.name;
  ovBody.querySelector(".overview-full")!.textContent = t(lesson.overview.full);
  ovBody.querySelector(".overview-desc")!.textContent = t(
    lesson.overview.description,
  );
  ovBody.querySelector(".overview-facts")!.innerHTML = renderFactsHtml(
    lesson.overview.facts,
  );
}

function populateExplainCard(
  overviewEl: HTMLElement,
  content: OverviewContentInfo,
): void {
  const expEl = overviewEl.querySelector<HTMLElement>(".explain")!;
  expEl.classList.toggle("is-done", Boolean(content.done));
  expEl.querySelector(".explain-label")!.textContent = content.label;
  expEl.querySelector(".explain-title")!.textContent = toLocaleUpper(
    t(content.title),
  );
  expEl.querySelector(".explain-sub")!.textContent = t(content.desc);
  expEl.querySelector(".explain-text")!.textContent = t(content.text);
  expEl.querySelector(".explain-facts")!.innerHTML = renderFactsHtml(
    content.facts ?? [],
  );
  expEl.scrollTop = 0;
}

function populateExplainPacketCard(
  overviewEl: HTMLElement,
  packetInfo: OverviewPacketInfo | null,
  lesson: Lesson,
): void {
  if (!packetInfo) return;
  const pktEl = overviewEl.querySelector<HTMLElement>(".explain-packet")!;
  const { event: ev, number: num, count, total } = packetInfo;

  pktEl.dataset.color = ev.color;
  pktEl.querySelector("b")!.innerHTML =
    (ev.locked ? PILL_LOCK_SVG : "") + escapeHtml(t(ev.label));
  pktEl.querySelector("span")!.textContent = toLocaleUpper(
    `${getNodeShortLabel(lesson, ev.from)} ${isRtl() ? "←" : "→"} ${getNodeShortLabel(lesson, ev.to)}`,
  );
  pktEl.querySelector(".explain-payload")!.textContent = ev.payload
    .map((line) => t(line))
    .join("\n");

  if (ev.type === "stream") {
    const lostCount = ev.packets.filter((p) => p.lost).length;
    const lengths = ev.packets.map((p) => p.row.len);
    const sizeText = lengths.every((l) => l === lengths[0])
      ? `${count} × ${lengths[0]}`
      : lengths.every((l) => l.endsWith(" B"))
        ? `${lengths.map((l) => l.slice(0, -2)).join(" + ")} B`
        : lengths.join(" + ");
    const suffix = lostCount
      ? ` · ${t(lostCount === 1 ? "1 LOST" : "{n} LOST", { n: lostCount })}`
      : ev.locked
        ? ` · ${t("ENCRYPTED")}`
        : "";
    pktEl.querySelector(".explain-meta")!.textContent =
      `${t("PACKETS {from}–{to} OF {total}", { from: num, to: num + count - 1, total })} · ${isolateBidi(sizeText)}${suffix}`;
  } else {
    const suffix = ev.lost
      ? ` · ${t("LOST ON THE WAY")}`
      : ev.locked
        ? ` · ${t("ENCRYPTED")}`
        : "";
    pktEl.querySelector(".explain-meta")!.textContent =
      `${t("PACKET {n} OF {total}", { n: num, total })} · ${isolateBidi(ev.row.proto)} · ${isolateBidi(ev.row.len)}${suffix}`;
  }
}

function animateExplainPacketHeight(
  overviewEl: HTMLElement,
  mutateFn: () => void,
): void {
  const pktEl = overviewEl.querySelector<HTMLElement>(".explain-packet")!;
  const beforeH = pktEl.offsetHeight;
  pktEl.getAnimations().forEach((anim) => anim.cancel());
  mutateFn();
  const afterH = pktEl.offsetHeight;
  if (beforeH !== afterH && !prefersReducedMotion()) {
    pktEl.animate([{ height: `${beforeH}px` }, { height: `${afterH}px` }], {
      duration: 420,
      easing: EASE_OUT_EXPO,
    });
  }
}

const updateExplainPacketContent = (
  overviewEl: HTMLElement,
  vm: OverviewViewModel,
): void => {
  if (vm.packet) {
    animateExplainPacketHeight(overviewEl, () =>
      populateExplainPacketCard(overviewEl, vm.packet, vm.lesson),
    );
  }
};

function applyOverviewViewModel(
  overviewEl: HTMLElement,
  vm: OverviewViewModel,
): void {
  populateOverviewCard(overviewEl, vm.lesson);
  overviewEl.querySelector<HTMLElement>('[data-view="overview"]')!.hidden =
    vm.view !== "overview";
  overviewEl.querySelector<HTMLElement>('[data-view="step"]')!.hidden =
    vm.view !== "step";
  populateExplainCard(overviewEl, vm.content);
  populateExplainPacketCard(overviewEl, vm.packet, vm.lesson);
  overviewEl
    .querySelector<HTMLElement>(".explain-packet")!
    .classList.toggle("is-open", Boolean(vm.packet));
}

function syncOverviewHeaderButtons(
  overviewEl: HTMLElement,
  inStepView: boolean,
): void {
  const backBtn = overviewEl.querySelector<HTMLElement>(".back-btn")!;
  const moreBtn = overviewEl.querySelector<HTMLElement>(".more")!;
  if (backBtn.hidden === inStepView) {
    backBtn.hidden = !inStepView;
    moreBtn.hidden = inStepView;
    if (!prefersReducedMotion()) {
      (inStepView ? backBtn : moreBtn).animate(
        [
          { transform: `translateX(${isRtl() ? -14 : 14}px)`, opacity: 0 },
          { transform: "none", opacity: 1 },
        ],
        { duration: 320, easing: EASE_OUT_EXPO },
      );
    }
  }
}

export function resetOverviewShownCache(overviewEl: OverviewElement): void {
  overviewEl._shown = null;
}

export function updateOverviewPanelState(
  overviewEl: OverviewElement,
  state: SimulationState,
  lesson: Lesson,
  order = 0,
): void {
  const nextVm = buildOverviewViewModel(state, lesson, order);
  const prevVm = overviewEl._shown;
  overviewEl._latest = nextVm;
  const getLatest = () => overviewEl._latest!;

  animateTextChange(
    overviewEl.querySelector<HTMLElement>(".panel-title")!,
    nextVm.title,
    !prevVm || nextVm.rank >= prevVm.rank ? 1 : -1,
  );
  syncOverviewHeaderButtons(overviewEl, nextVm.view === "step");

  if (!prevVm) {
    applyOverviewViewModel(overviewEl, nextVm);
  } else if (nextVm.lesson !== prevVm.lesson) {
    animateHorizontalSwap(
      overviewEl.querySelector<HTMLElement>(".overview-stage")!,
      () => applyOverviewViewModel(overviewEl, getLatest()),
      nextVm.order > prevVm.order ? 1 : -1,
      32,
    );
  } else if (nextVm.view !== prevVm.view) {
    animateHorizontalSwap(
      overviewEl.querySelector<HTMLElement>(".overview-stage")!,
      () => applyOverviewViewModel(overviewEl, getLatest()),
      nextVm.view === "step" ? 1 : -1,
      32,
    );
  } else if (nextVm.view === "step" && nextVm.rank !== prevVm.rank) {
    animateHorizontalSwap(
      overviewEl.querySelector<HTMLElement>(".explain")!,
      () => applyOverviewViewModel(overviewEl, getLatest()),
      nextVm.rank > prevVm.rank ? 1 : -1,
    );
  } else if (
    nextVm.view === "step" &&
    nextVm.packet?.number !== prevVm.packet?.number
  ) {
    const pktEl = overviewEl.querySelector<HTMLElement>(".explain-packet")!;
    const isReturnDir =
      nextVm.packet !== null &&
      ["client", "dns"].includes(nextVm.packet.event.to) &&
      nextVm.packet.event.from !== "client";
    if (nextVm.packet && prevVm.packet) {
      animateHorizontalSwap(
        pktEl.querySelector<HTMLElement>(".explain-packet-inner")!,
        () => updateExplainPacketContent(overviewEl, getLatest()),
        isReturnDir ? 1 : -1,
        18,
      );
    } else {
      animateExplainPacketHeight(overviewEl, () => {
        if (nextVm.packet) {
          populateExplainPacketCard(overviewEl, nextVm.packet, nextVm.lesson);
        }
        pktEl.classList.toggle("is-open", Boolean(nextVm.packet));
      });
    }
  }
  overviewEl._shown = nextVm;
}
