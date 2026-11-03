import { ICONS, PROTOCOL_LIST } from "../data";
import { t, tAttr } from "../i18n";
import {
  EASE_OUT_EXPO,
  EASE_STANDARD,
  prefersReducedMotion,
  smoothScrollTo,
} from "../lib/motion";
import { getLessonStatus } from "../lib/progress";
import type { Lesson, ProtocolId, SimulationState } from "../types/protocol";

const SIDEBAR_TABS: Array<[string, string]> = [
  ["all", "ALL"],
  ["core", "CORE"],
  ["application", "APPLICATION"],
  ["security", "SECURITY"],
];

function renderLessonStepsHtml(lesson: Lesson): string {
  const stepsHtml = lesson.steps
    .map(
      (step, idx) => `
      <li class="step" data-step="${idx}" style="--i:${idx}">
        <button class="step-btn" type="button">
          <span class="step-num"><span>${idx + 1}</span>${ICONS.check.replace("<path", '<path pathLength="1"')}</span>
          <span class="step-text">
            <span class="step-title" ${tAttr(step.title, true)}</span>
            <span class="step-desc" ${tAttr(step.desc)}</span>
          </span>
        </button>
      </li>`,
    )
    .join("");

  return `<div class="steps-wrap"><div class="steps-clip"><ol class="steps">${stepsHtml}</ol></div></div>`;
}

export function renderSidebarHtml(
  lessons: Record<ProtocolId, Lesson>,
): string {
  const protoItemsHtml = PROTOCOL_LIST.map((meta) => {
    const lesson = lessons[meta.id];
    const status = getLessonStatus(lesson);
    return `
      <li class="proto ${lesson ? "has-lesson" : ""}" data-group="${meta.group}" ${lesson ? `data-lesson="${meta.id}"` : ""}>
        <button class="proto-row" type="button" aria-expanded="false">
          <span class="status-dot ${status}" data-status="${status}"></span>
          <span class="proto-text">
            <span class="proto-name">${meta.name}</span>
            <span class="proto-full" ${tAttr(meta.full)}</span>
          </span>
          <span class="proto-chev">${ICONS.chevron}</span>
        </button>
        ${lesson ? renderLessonStepsHtml(lesson) : ""}
      </li>`;
  }).join("");

  const tabsHtml = SIDEBAR_TABS.map(([groupKey, label], idx) => {
    const count =
      groupKey === "all"
        ? PROTOCOL_LIST.length
        : PROTOCOL_LIST.filter((p) => p.group === groupKey).length;
    return `<button class="tab ${idx === 0 ? "is-active" : ""}" type="button" role="tab" aria-selected="${idx === 0}" data-group="${groupKey}">
      <span ${tAttr(label)}</span><span class="tab-count">${count}</span>
    </button>`;
  }).join("");

  return `
  <aside class="panel sidebar" id="protocols">
    <div class="panel-head">
      <h2 class="panel-title" ${tAttr("INTERNET PROTOCOLS")}</h2>
      <button class="more" type="button" data-t-label="More" aria-label="${t("More")}">${ICONS.dots}</button>
      <button class="drawer-close" type="button" data-t-label="Close the protocol list" aria-label="${t("Close the protocol list")}" data-t-title="Close (Esc)" title="${t("Close (Esc)")}">${ICONS.close}</button>
    </div>
    <div class="tabs" role="tablist">${tabsHtml}<span class="tab-indicator"></span></div>
    <ul class="proto-list">${protoItemsHtml}</ul>
  </aside>`;
}

function syncSidebarTabIndicator(sidebarEl: HTMLElement): void {
  const activeTab = sidebarEl.querySelector<HTMLElement>(".tab.is-active")!;
  const indicator = sidebarEl.querySelector<HTMLElement>(".tab-indicator")!;
  indicator.style.left = `${activeTab.offsetLeft}px`;
  indicator.style.width = `${activeTab.offsetWidth}px`;
}

const getElementZoomScale = (el: HTMLElement): number =>
  el.getBoundingClientRect().height / el.offsetHeight || 1;

function spawnGhostItem(
  listEl: HTMLElement,
  itemEl: HTMLElement,
  { rect, opacity }: { rect: DOMRect; opacity: number },
  scale: number,
): void {
  const listRect = listEl.getBoundingClientRect();
  const ghost = itemEl.cloneNode(true) as HTMLElement;
  ghost.classList.add("proto-ghost");
  ghost.removeAttribute("data-lesson");
  ghost.dataset.ghostOf =
    itemEl.querySelector(".proto-name")!.textContent ?? "";
  Object.assign(ghost.style, {
    top: `${(rect.top - listRect.top) / scale + listEl.scrollTop}px`,
    left: `${(rect.left - listRect.left) / scale}px`,
    width: `${itemEl.offsetWidth}px`,
  });
  listEl.appendChild(ghost);
  ghost.animate([{ opacity }, { opacity: 0 }], {
    duration: 60 + 110 * opacity,
    easing: "ease-in",
    fill: "forwards",
  }).onfinish = () => ghost.remove();
}

function filterSidebarGroup(sidebarEl: HTMLElement, group: string): void {
  const listEl = sidebarEl.querySelector<HTMLElement>(".proto-list")!;
  const items = [
    ...listEl.querySelectorAll<HTMLElement>(":scope > .proto:not(.proto-ghost)"),
  ];
  const scale = getElementZoomScale(listEl);
  const reduced = prefersReducedMotion();
  const prevSnapshots = new Map<
    HTMLElement,
    { rect: DOMRect; top: number; opacity: number; moving: boolean }
  >();

  for (const item of items) {
    if (item.hidden) continue;
    const rect = item.getBoundingClientRect();
    prevSnapshots.set(item, {
      rect,
      top: rect.top,
      opacity: Number(getComputedStyle(item).opacity),
      moving: item.getAnimations().length > 0,
    });
  }

  let ghostCount = 0;
  for (const item of items) {
    const matches = group === "all" || item.dataset.group === group;
    if (!matches && !item.hidden && !reduced) {
      spawnGhostItem(listEl, item, prevSnapshots.get(item)!, scale);
      ghostCount++;
    }
  }

  for (const item of items) {
    item.getAnimations().forEach((anim) => anim.cancel());
    item.hidden = !(group === "all" || item.dataset.group === group);
  }

  if (reduced) return;

  const movingBands: Array<[number, number]> = [];
  for (const item of items) {
    const snap = prevSnapshots.get(item);
    if (item.hidden || !snap) continue;
    const newRect = item.getBoundingClientRect();
    movingBands.push([
      Math.min(snap.top, newRect.top),
      Math.max(snap.top, newRect.top) + newRect.height,
    ]);
  }

  let enteringIdx = 0;
  for (const item of items) {
    if (item.hidden) continue;
    const snap = prevSnapshots.get(item);
    if (snap) {
      const dy = (snap.top - item.getBoundingClientRect().top) / scale;
      if (Math.abs(dy) < 0.5 && snap.opacity >= 1) continue;
      item.animate(
        [
          { transform: `translateY(${dy}px)`, opacity: snap.opacity },
          { transform: "none", opacity: 1 },
        ],
        {
          duration: 360,
          delay: snap.moving || !ghostCount ? 0 : 90,
          easing: EASE_STANDARD,
          fill: "backwards",
        },
      );
    } else {
      const rect = item.getBoundingClientRect();
      const overlapsMoving = movingBands.some(
        ([bandTop, bandBottom]) =>
          bandTop < rect.bottom - 4 &&
          bandBottom > rect.top + 4 &&
          bandBottom - bandTop > rect.height + 8,
      );
      item.animate(
        [
          { opacity: 0, transform: "translateY(8px)" },
          { opacity: 1, transform: "none" },
        ],
        {
          duration: 300,
          delay: (overlapsMoving ? 250 : ghostCount ? 150 : 70) + enteringIdx++ * 22,
          easing: EASE_OUT_EXPO,
          fill: "backwards",
        },
      );
    }
  }
}

export function initSidebarEvents(
  sidebarEl: HTMLElement,
  {
    onStep,
    onSelect,
  }: {
    onStep: (stepIdx: number) => void;
    onSelect: (lessonId: ProtocolId) => void;
  },
): void {
  syncSidebarTabIndicator(sidebarEl);
  const ro = new ResizeObserver(() => syncSidebarTabIndicator(sidebarEl));
  sidebarEl.querySelectorAll(".tabs, .tab").forEach((el) => ro.observe(el));
  document.fonts.ready.then(() => {
    syncSidebarTabIndicator(sidebarEl);
    sidebarEl.querySelector(".tabs")!.classList.add("is-ready");
  });

  sidebarEl.addEventListener("click", (ev) => {
    const target = ev.target as HTMLElement;
    const stepBtn = target.closest<HTMLElement>(".proto.is-open .step-btn");
    if (stepBtn && stepBtn.parentElement) {
      onStep(Number(stepBtn.parentElement.dataset.step));
    }
    const protoRow = target.closest<HTMLElement>(
      ".proto.has-lesson > .proto-row",
    );
    if (protoRow && protoRow.parentElement?.dataset.lesson) {
      onSelect(protoRow.parentElement.dataset.lesson as ProtocolId);
    }
    const tabBtn = target.closest<HTMLElement>(".tab");
    if (tabBtn && !tabBtn.classList.contains("is-active")) {
      sidebarEl.querySelectorAll<HTMLElement>(".tab").forEach((tEl) => {
        const active = tEl === tabBtn;
        tEl.classList.toggle("is-active", active);
        tEl.setAttribute("aria-selected", String(active));
      });
      syncSidebarTabIndicator(sidebarEl);
      filterSidebarGroup(sidebarEl, tabBtn.dataset.group || "all");
    }
  });
}

function scrollProtocolIntoView(
  listEl: HTMLElement,
  itemEl: HTMLElement,
): void {
  const scale = getElementZoomScale(listEl);
  const listRect = listEl.getBoundingClientRect();
  const itemRect = itemEl.getBoundingClientRect();
  const itemTop = (itemRect.top - listRect.top) / scale + listEl.scrollTop;
  const itemHeight = itemRect.height / scale;
  const listHeight = listEl.clientHeight;
  const pad = 8;
  if (itemHeight + 2 * pad > listHeight || itemTop < listEl.scrollTop + pad) {
    smoothScrollTo(listEl, itemTop - pad);
  } else if (itemTop + itemHeight > listEl.scrollTop + listHeight - pad) {
    smoothScrollTo(listEl, itemTop + itemHeight - listHeight + pad);
  }
}

function setActiveSidebarLesson(
  sidebarEl: HTMLElement,
  lessonId: ProtocolId,
): void {
  const isFirstInit = !sidebarEl.dataset.lesson;
  sidebarEl.dataset.lesson = lessonId;

  for (const protoEl of sidebarEl.querySelectorAll<HTMLElement>(
    ".proto.has-lesson",
  )) {
    const isActive = protoEl.dataset.lesson === lessonId;
    if (isActive !== protoEl.classList.contains("is-open")) {
      if (isActive) {
        protoEl.classList.add("instant");
        protoEl.querySelectorAll<HTMLElement>(".step").forEach((stepEl) => {
          stepEl.classList.remove("is-active", "is-done");
          stepEl.style.removeProperty("--delay");
        });
        void protoEl.offsetWidth;
        protoEl.classList.remove("instant");
      }
      protoEl.classList.toggle("is-active", isActive);
      protoEl.classList.toggle("is-open", isActive);
      protoEl
        .querySelector(".proto-row")!
        .setAttribute("aria-expanded", String(isActive));
    }
  }

  const activeItemEl = sidebarEl.querySelector<HTMLElement>(
    `.proto[data-lesson="${lessonId}"]`,
  );
  if (!isFirstInit && activeItemEl) {
    setTimeout(() => {
      if (sidebarEl.dataset.lesson === lessonId) {
        scrollProtocolIntoView(
          sidebarEl.querySelector<HTMLElement>(".proto-list")!,
          activeItemEl,
        );
      }
    }, 460);
  }
}

export function refreshSidebarStatusDots(
  sidebarEl: HTMLElement,
  lessons: Record<ProtocolId, Lesson>,
): void {
  sidebarEl
    .querySelectorAll<HTMLElement>(".proto[data-lesson]")
    .forEach((protoEl) => {
      const dotEl = protoEl.querySelector<HTMLElement>(".status-dot")!;
      const lessonId = protoEl.dataset.lesson as ProtocolId;
      const status = getLessonStatus(lessons[lessonId]);
      if (dotEl.dataset.status !== status) {
        dotEl.dataset.status = status;
        dotEl.className = `status-dot ${status}`;
        if (!prefersReducedMotion()) {
          void dotEl.offsetWidth;
          dotEl.classList.add("is-changed");
        }
      }
    });
}

export function updateSidebarState(
  sidebarEl: HTMLElement,
  state: SimulationState,
  lesson: Lesson,
): void {
  if (sidebarEl.dataset.lesson !== lesson.id) {
    setActiveSidebarLesson(sidebarEl, lesson.id);
  }
  const stepEls = [
    ...sidebarEl.querySelectorAll<HTMLElement>(
      `.proto[data-lesson="${lesson.id}"] .step`,
    ),
  ];
  const newlyDone = stepEls.filter(
    (el, idx) =>
      state.steps[idx] === "done" && !el.classList.contains("is-done"),
  );
  const newlyUndone = stepEls
    .filter(
      (el, idx) =>
        state.steps[idx] !== "done" && el.classList.contains("is-done"),
    )
    .reverse();

  stepEls.forEach((el) => el.style.setProperty("--delay", "0ms"));
  newlyDone.forEach((el, idx) =>
    el.style.setProperty("--delay", `${idx * 90}ms`),
  );
  newlyUndone.forEach((el, idx) =>
    el.style.setProperty("--delay", `${idx * 50}ms`),
  );
  stepEls.forEach((el, idx) => {
    if (
      state.steps[idx] === "active" &&
      !el.classList.contains("is-active")
    ) {
      el.style.setProperty("--delay", `${newlyDone.length * 90}ms`);
    }
    el.classList.toggle("is-active", state.steps[idx] === "active");
    el.classList.toggle("is-done", state.steps[idx] === "done");
  });
}
