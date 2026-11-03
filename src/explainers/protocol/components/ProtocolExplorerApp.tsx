"use client";

import { useEffect, useRef } from "react";
import { PROTOCOL_LESSONS, PROTOCOL_LIST } from "../data";
import {
  initSavedLanguage,
  isRtl,
  onLanguageChange,
  setLanguage,
  translateDomTree,
} from "../i18n";
import { playbackClock, prefersReducedMotion } from "../lib/motion";
import { recordLessonProgress } from "../lib/progress";
import type { Lesson, ProtocolId, SimulationState } from "../types/protocol";
import { createNetworkCanvasController } from "./network-canvas";
import {
  type OverviewElement,
  initOverviewEvents,
  renderOverviewPanelHtml,
  resetOverviewShownCache,
  updateOverviewPanelState,
} from "./overview-panel";
import {
  type InspectorElement,
  createPacketInspectorController,
  initSimulationViewSwitcher,
  renderSimulationPanelHtml,
} from "./packet-inspector";
import {
  type PacketsElement,
  initPacketTableEvents,
  measureToggleMinWidth,
  renderPacketTableHtml,
  retranslatePacketTable,
  updatePacketTableState,
  updateSpeedLabel,
} from "./packet-table";
import {
  type SequenceElement,
  initSequenceDiagramScrollAndResize,
  reflowSequenceDiagram,
  updateSequenceDiagramState,
} from "./sequence-diagram";
import {
  initSidebarEvents,
  refreshSidebarStatusDots,
  renderSidebarHtml,
  updateSidebarState,
} from "./sidebar";
import {
  type SimulationController,
  createSimulationController,
} from "./simulation-engine";
import {
  fitTopbarTypography,
  initLanguageMenuEvents,
  initThemeToggle,
  renderTopbarHtml,
  retranslateTopbarUi,
  updateLearningProgressUi,
  updateTopbarState,
} from "./topbar";

const LAYOUT_BREAKPOINTS = [
  { name: "wide", min: 1440, canvas: 1672 },
  { name: "medium", min: 1100, canvas: 1180 },
  { name: "tablet", min: 900, canvas: 900 },
  { name: "narrow", min: 640, canvas: 640 },
  { name: "phone", min: 0, canvas: 380 },
] as const;

const SPEED_OPTIONS = [0.5, 1, 1.5, 2];
const SPEED_STORAGE_KEY = "protocol-explorer:speed";

function mountProtocolExplorerApp(rootEl: HTMLElement): () => void {
  rootEl.innerHTML = `
  <div class="shell">
    ${renderTopbarHtml()}
    <main class="workspace">
      ${renderSidebarHtml(PROTOCOL_LESSONS)}
      ${renderSimulationPanelHtml()}
      ${renderOverviewPanelHtml()}
      ${renderPacketTableHtml()}
    </main>
    <div class="scrim" aria-hidden="true"></div>
  </div>
`;

  const docEl = document.documentElement;
  const shellEl = rootEl.querySelector<HTMLElement>(".shell")!;
  const drawerBtn = rootEl.querySelector<HTMLButtonElement>(".drawer-btn")!;
  const sidebarEl = rootEl.querySelector<HTMLElement>(".sidebar")!;
  const isDrawerOpen = () => shellEl.classList.contains("is-drawer-open");

  function setDrawerOpen(open: boolean): void {
    const isStacked = docEl.classList.contains("is-stacked");
    shellEl.classList.toggle("is-drawer-open", open);
    docEl.classList.toggle("is-locked", open);
    drawerBtn.setAttribute("aria-expanded", String(open));
    sidebarEl.inert = isStacked && !open;
    if (open) {
      sidebarEl
        .querySelector<HTMLElement>(".drawer-close")!
        .focus({ preventScroll: true });
    } else if (isStacked && sidebarEl.contains(document.activeElement)) {
      drawerBtn.focus({ preventScroll: true });
    }
  }

  function applyResponsiveLayout(): void {
    const vw = docEl.clientWidth;
    const bp = LAYOUT_BREAKPOINTS.find((b) => vw >= b.min)!;
    const zoom =
      bp.name === "wide" ? vw / bp.canvas : Math.min(1, vw / bp.canvas);
    const isStacked = !(bp.name === "wide" || bp.name === "medium");
    docEl.dataset.layout = bp.name;
    docEl.classList.toggle("is-stacked", isStacked);
    docEl.classList.toggle(
      "is-single",
      bp.name === "narrow" || bp.name === "phone",
    );
    if (isStacked) {
      sidebarEl.inert = !isDrawerOpen();
    } else {
      setDrawerOpen(false);
    }
    (shellEl.style as unknown as { zoom: string }).zoom = String(zoom);
    shellEl.style.width = `${vw / zoom}px`;
    shellEl.style.height = isStacked ? "" : `${window.innerHeight / zoom}px`;
    shellEl.style.minHeight = isStacked ? `${window.innerHeight / zoom}px` : "";
    fitTopbarTypography(rootEl);
  }

  drawerBtn.addEventListener("click", () => setDrawerOpen(!isDrawerOpen()));
  sidebarEl
    .querySelector(".drawer-close")!
    .addEventListener("click", () => setDrawerOpen(false));
  rootEl
    .querySelector(".scrim")!
    .addEventListener("click", () => setDrawerOpen(false));

  applyResponsiveLayout();
  window.addEventListener("resize", applyResponsiveLayout);
  window.addEventListener("orientationchange", applyResponsiveLayout);

  const topbarEl = rootEl.querySelector<HTMLElement>(".topbar")!;
  const overviewEl = rootEl.querySelector<OverviewElement>(".overview")!;
  const packetsEl = rootEl.querySelector<PacketsElement>(".packets")!;
  const simEl = rootEl.querySelector<HTMLElement>(".simulation")!;
  const seqEl = rootEl.querySelector<SequenceElement>(".sequence")!;

  let currentLesson: Lesson | null = null;
  let simCtrl: SimulationController | null = null;
  let latestState: SimulationState | null = null;

  const viewSwitcher = initSimulationViewSwitcher(simEl, (mode) =>
    simCtrl?.setMode(mode),
  );

  const getVisiblePacketIndices = (): number[] =>
    [...packetsEl.querySelectorAll<HTMLTableRowElement>("tr[data-packet]")]
      .filter((tr) => !tr.hidden && tr.dataset.shown === "1")
      .map((tr) => Number(tr.dataset.packet));

  const inspector = createPacketInspectorController(
    simEl.querySelector<InspectorElement>(".inspector")!,
    {
      visible: getVisiblePacketIndices,
      onChange: (idx) => {
        for (const el of rootEl.querySelectorAll(".is-inspected")) {
          el.classList.remove("is-inspected");
        }
        docEl.classList.toggle("is-inspecting", idx !== null);
        if (idx === null) return;
        rootEl
          .querySelectorAll(
            `tr[data-packet="${idx}"], .seq-arrow[data-packet="${idx}"]`,
          )
          .forEach((el) => el.classList.add("is-inspected"));

        const rowEl = packetsEl.querySelector<HTMLElement>(
          `tr[data-packet="${idx}"]`,
        )!;
        const scrollEl =
          packetsEl.querySelector<HTMLElement>(".packet-scroll")!;
        const headHeight =
          packetsEl.querySelector<HTMLElement>("thead")!.offsetHeight;
        if (rowEl.offsetTop < scrollEl.scrollTop + headHeight) {
          scrollEl.scrollTo({
            top: rowEl.offsetTop - headHeight,
            behavior: "smooth",
          });
        } else if (
          rowEl.offsetTop + rowEl.offsetHeight >
          scrollEl.scrollTop + scrollEl.clientHeight
        ) {
          scrollEl.scrollTo({
            top:
              rowEl.offsetTop + rowEl.offsetHeight - scrollEl.clientHeight,
            behavior: "smooth",
          });
        }
      },
    },
  );

  const inspectPacket = (pktIdx: number): void => {
    if ((latestState?.playing || latestState?.running) && simCtrl) {
      simCtrl.pause();
    }
    if (currentLesson) {
      inspector.open(currentLesson, pktIdx);
    }
  };

  seqEl.addEventListener("click", (ev) => {
    const arrowEl = (ev.target as Element).closest<SVGGElement>(
      ".seq-arrow.is-shown",
    );
    if (arrowEl) {
      inspectPacket(Number(arrowEl.dataset.packet));
    }
  });

  initSequenceDiagramScrollAndResize(seqEl);
  const netCtrl = createNetworkCanvasController(
    rootEl.querySelector<SVGSVGElement>(".network")!,
  );

  updateLearningProgressUi(topbarEl, PROTOCOL_LESSONS);
  initThemeToggle(topbarEl);

  function syncUiWithState(
    state: SimulationState,
    lesson: Lesson = currentLesson!,
  ): void {
    updateTopbarState(topbarEl, state, lesson);
    updateSidebarState(sidebarEl, state, lesson);
    updateOverviewPanelState(
      overviewEl,
      state,
      lesson,
      PROTOCOL_LIST.findIndex((p) => p.id === lesson.id),
    );
    updatePacketTableState(packetsEl, state, lesson);
    const inspectedIdx = inspector.index();
    if (
      inspectedIdx !== null &&
      !getVisiblePacketIndices().includes(inspectedIdx)
    ) {
      inspector.close();
    }
    updateSequenceDiagramState(seqEl, state, lesson);
  }

  function selectLesson(lessonId: ProtocolId): void {
    if (currentLesson?.id === lessonId) {
      simCtrl?.reset();
      return;
    }
    inspector.close();
    simCtrl?.dispose();
    currentLesson = PROTOCOL_LESSONS[lessonId];
    const activeLesson = currentLesson;
    simCtrl = createSimulationController(
      activeLesson,
      netCtrl,
      (state) => {
        latestState = state;
        if (recordLessonProgress(activeLesson, state)) {
          updateLearningProgressUi(topbarEl, PROTOCOL_LESSONS);
          refreshSidebarStatusDots(sidebarEl, PROTOCOL_LESSONS);
        }
        syncUiWithState(state, activeLesson);
      },
      { mode: viewSwitcher.view() },
    );
    simCtrl.reset();
  }

  function applyFullRetranslation(): void {
    translateDomTree(rootEl);
    retranslateTopbarUi(topbarEl);
    fitTopbarTypography(topbarEl);
    updateLearningProgressUi(topbarEl, PROTOCOL_LESSONS);
    if (currentLesson) {
      resetOverviewShownCache(overviewEl);
      retranslatePacketTable(packetsEl, currentLesson);
      netCtrl.retext();
      reflowSequenceDiagram(seqEl);
      if (inspector.isOpen()) {
        inspector.open(currentLesson, inspector.index()!);
      }
      if (latestState) {
        syncUiWithState(latestState);
      }
    }
  }

  onLanguageChange(() => {
    const docWithTransition = document as Document & {
      startViewTransition?: (cb: () => void) => { finished: Promise<void> };
    };
    if (!docWithTransition.startViewTransition || prefersReducedMotion()) {
      applyFullRetranslation();
      return;
    }
    docEl.classList.add("is-retexting");
    docWithTransition
      .startViewTransition(applyFullRetranslation)
      .finished.finally(() => docEl.classList.remove("is-retexting"));
  });

  initLanguageMenuEvents(topbarEl, (code) => setLanguage(code));

  const closeDrawerSoon = () => {
    if (isDrawerOpen()) {
      setTimeout(() => setDrawerOpen(false), 220);
    }
  };

  initSidebarEvents(sidebarEl, {
    onStep: (stepIdx) => {
      simCtrl?.jump(stepIdx);
      closeDrawerSoon();
    },
    onSelect: (lessonId) => {
      selectLesson(lessonId);
      closeDrawerSoon();
    },
  });

  initOverviewEvents(overviewEl, () => simCtrl?.reset());

  function applySpeed(speed: number, persist = true): void {
    playbackClock.setSpeed(speed);
    updateSpeedLabel(packetsEl, speed);
    if (persist) {
      try {
        localStorage.setItem(SPEED_STORAGE_KEY, String(speed));
      } catch {}
    }
  }

  try {
    const savedSpeed = Number(localStorage.getItem(SPEED_STORAGE_KEY));
    if (SPEED_OPTIONS.includes(savedSpeed)) {
      applySpeed(savedSpeed, false);
    }
  } catch {}

  const cycleSpeed = () =>
    applySpeed(
      SPEED_OPTIONS[
        (SPEED_OPTIONS.indexOf(playbackClock.speed) + 1) % SPEED_OPTIONS.length
      ],
    );

  document.fonts.ready.then(() => {
    measureToggleMinWidth(packetsEl);
    fitTopbarTypography(topbarEl);
  });

  initPacketTableEvents(packetsEl, {
    toggle: () => simCtrl?.toggle(),
    step: () => simCtrl?.step(),
    reset: () => simCtrl?.reset(),
    prev: () => stepBackward(),
    speed: cycleSpeed,
    inspect: inspectPacket,
  });

  function stepForward(): void {
    if (!latestState?.started) {
      simCtrl?.jump(0);
      return;
    }
    if (
      currentLesson &&
      latestState.activeStep < currentLesson.steps.length - 1
    ) {
      simCtrl?.jump(latestState.activeStep + 1);
    }
  }

  function stepBackward(): void {
    if (latestState?.started && currentLesson) {
      if (latestState.done) {
        simCtrl?.jump(currentLesson.steps.length - 1);
        return;
      }
      if (latestState.activeStep > 0) {
        simCtrl?.jump(latestState.activeStep - 1);
      } else {
        simCtrl?.reset();
      }
    }
  }

  const handleRightArrow = () =>
    inspector.isOpen() ? inspector.step(1) : stepForward();
  const handleLeftArrow = () =>
    inspector.isOpen() ? inspector.step(-1) : stepBackward();

  const keyBindings: Record<string, () => void> = {
    " ": () => simCtrl?.toggle(),
    ArrowRight: () => (isRtl() ? handleLeftArrow() : handleRightArrow()),
    ArrowLeft: () => (isRtl() ? handleRightArrow() : handleLeftArrow()),
    Escape: () =>
      isDrawerOpen()
        ? setDrawerOpen(false)
        : inspector.isOpen()
          ? inspector.close()
          : simCtrl?.reset(),
    v: () => viewSwitcher.toggle(),
    V: () => viewSwitcher.toggle(),
  };

  const isInteractiveTarget = (target: EventTarget | null): boolean =>
    target instanceof Element &&
    Boolean(
      target.closest(
        'input, textarea, select, [contenteditable="true"], .lang-menu',
      ),
    );

  const handleKeyEvent = (ev: KeyboardEvent): void => {
    const action = keyBindings[ev.key];
    if (
      !action ||
      !simCtrl ||
      ev.ctrlKey ||
      ev.metaKey ||
      ev.altKey ||
      isInteractiveTarget(ev.target)
    ) {
      return;
    }
    ev.preventDefault();
    if (ev.type === "keydown" && !ev.repeat) {
      action();
    }
  };

  window.addEventListener("keydown", handleKeyEvent);
  window.addEventListener("keyup", handleKeyEvent);

  document.fonts.ready.then(() => selectLesson("http"));

  return () => {
    window.removeEventListener("resize", applyResponsiveLayout);
    window.removeEventListener("orientationchange", applyResponsiveLayout);
    window.removeEventListener("keydown", handleKeyEvent);
    window.removeEventListener("keyup", handleKeyEvent);
    simCtrl?.dispose();
  };
}

export default function ProtocolExplorerApp() {
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    let cleanup: (() => void) | undefined;
    let cancelled = false;
    initSavedLanguage().then(() => {
      if (!cancelled) {
        cleanup = mountProtocolExplorerApp(el);
      }
    });
    return () => {
      cancelled = true;
      cleanup?.();
    };
  }, []);

  return <div id="app" ref={rootRef} />;
}
