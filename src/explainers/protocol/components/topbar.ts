import { ICONS, PROTOCOL_LIST } from "../data";
import {
  LANGUAGES,
  getCurrentLang,
  t,
  tAttr,
  toLocaleUpper,
} from "../i18n";
import { animateTextChange } from "../lib/motion";
import { getLessonCompletionRatio, getLessonStatus } from "../lib/progress";
import type { Lesson, ProtocolId, SimulationState } from "../types/protocol";

const LOGO_CUBE_SVG = `
<svg class="logo-cube" viewBox="0 0 64 64" aria-hidden="true">
  <g fill="currentColor" stroke="var(--bg)" stroke-width="2.4" stroke-linejoin="round">
    <path d="M32 3 L58 16.5 L32 30 L6 16.5 Z" />
    <path d="M6 16.5 L32 30 L32 45.5 L6 32 Z" />
    <path d="M58 16.5 L32 30 L32 45.5 L58 32 Z" />
    <path d="M6 32 L32 45.5 L32 61 L6 47.5 Z" />
    <path d="M58 32 L32 45.5 L32 61 L58 47.5 Z" />
  </g>
</svg>`;

function renderLearningProgressHtml(): string {
  const segsHtml = PROTOCOL_LIST.map(
    (_, idx) => `<span class="learning-seg"><i style="--i:${idx}"></i></span>`,
  ).join("");
  return `
  <div class="learning">
    <div class="learning-head">
      <span class="learning-label" ${tAttr("LEARNING PROGRESS")}</span>
      <span class="learning-value"></span>
    </div>
    <div class="learning-bars" role="img">${segsHtml}</div>
    <div class="learning-sub"><span class="learning-done"></span> / ${PROTOCOL_LIST.length} <span ${tAttr("COMPLETE")}</span> <span class="dot">·</span> <span class="learning-active"></span> <span ${tAttr("IN PROGRESS")}</span></div>
  </div>`;
}

export function updateLearningProgressUi(
  topbarEl: HTMLElement,
  lessons: Record<ProtocolId, Lesson>,
): void {
  const items = PROTOCOL_LIST.map((meta) => ({
    name: meta.name,
    value: getLessonCompletionRatio(lessons[meta.id]),
    status: getLessonStatus(lessons[meta.id]),
  })).sort((a, b) => b.value - a.value);

  const avgPct = Math.round(
    (items.reduce((acc, item) => acc + item.value, 0) / items.length) * 100,
  );
  const learningEl = topbarEl.querySelector<HTMLElement>(".learning")!;

  learningEl.querySelectorAll<HTMLElement>(".learning-seg").forEach((segEl, idx) => {
    const item = items[idx];
    segEl.classList.toggle("partial", item.value > 0 && item.value < 1);
    segEl.title = `${item.name}: ${Math.round(item.value * 100)}%`;
    (segEl.firstElementChild as HTMLElement).style.width = `${item.value * 100}%`;
  });

  learningEl
    .querySelector(".learning-bars")!
    .setAttribute("aria-label", t("{pct}% complete", { pct: avgPct }));

  animateTextChange(
    learningEl.querySelector<HTMLElement>(".learning-value")!,
    `${avgPct}%`,
  );
  animateTextChange(
    learningEl.querySelector<HTMLElement>(".learning-done")!,
    String(items.filter((i) => i.status === "done").length),
  );
  animateTextChange(
    learningEl.querySelector<HTMLElement>(".learning-active")!,
    String(items.filter((i) => i.status === "progress").length),
  );
}

function renderCreditHtml(): string {
  return `
  <a class="credit" href="https://x.com/DilumSanjaya" target="_blank" rel="noopener noreferrer" data-t-title="Dilum Sanjaya on X" title="${t("Dilum Sanjaya on X")}">
    <span class="credit-label" ${tAttr("DESIGNED BY")}</span>
    <span class="credit-name">
      <svg class="credit-x" viewBox="0 0 24 24" width="13" height="13" aria-hidden="true"><path fill="currentColor" d="M17.75 3h3.07l-6.71 7.67L22 21h-6.18l-4.84-6.33L5.44 21H2.37l7.18-8.2L2 3h6.33l4.38 5.79L17.75 3Zm-1.08 16.18h1.7L7.4 4.73H5.58l11.09 14.45Z"/></svg>
      DilumSanjaya
    </span>
  </a>`;
}

function renderLanguageMenuHtml(): string {
  const curCode = getCurrentLang();
  const itemsHtml = LANGUAGES.map(
    (lang) => `<button type="button" role="menuitemradio" data-lang="${lang.code}" lang="${lang.html}" aria-checked="${lang.code === curCode}">
      <span>${lang.name}</span><b>${lang.short}</b></button>`,
  ).join("");
  const curShort = LANGUAGES.find((l) => l.code === curCode)!.short;

  return `
  <div class="lang">
    <button class="menu-btn" type="button" aria-haspopup="menu" aria-expanded="false" data-t-label="Language" aria-label="${t("Language")}" data-t-title="Language" title="${t("Language")}">
      ${ICONS.globe}<span class="lang-code">${curShort}</span>${ICONS.caret}
    </button>
    <div class="lang-menu" role="menu" hidden>${itemsHtml}</div>
  </div>`;
}

export function initLanguageMenuEvents(
  topbarEl: HTMLElement,
  onSelectLang: (langCode: string) => Promise<void>,
): void {
  const langWrap = topbarEl.querySelector<HTMLElement>(".lang")!;
  const menuBtn = langWrap.querySelector<HTMLButtonElement>(".menu-btn")!;
  const menuEl = langWrap.querySelector<HTMLElement>(".lang-menu")!;
  const getOptions = () => [
    ...menuEl.querySelectorAll<HTMLButtonElement>("[data-lang]"),
  ];

  function setMenuOpen(open: boolean, focusActive = true) {
    if (open === !menuEl.hidden) return;
    menuEl.hidden = !open;
    menuBtn.setAttribute("aria-expanded", String(open));
    if (open) {
      if (focusActive) {
        const opts = getOptions();
        (
          opts.find((el) => el.getAttribute("aria-checked") === "true") ??
          opts[0]
        ).focus();
      }
      document.addEventListener("pointerdown", handleOutsidePointerDown, true);
    } else {
      document.removeEventListener("pointerdown", handleOutsidePointerDown, true);
    }
  }

  const handleOutsidePointerDown = (ev: PointerEvent) => {
    if (!langWrap.contains(ev.target as Node)) {
      setMenuOpen(false, false);
    }
  };

  menuBtn.addEventListener("click", () => setMenuOpen(menuEl.hidden, true));

  menuEl.addEventListener("click", async (ev) => {
    const opt = (ev.target as HTMLElement).closest<HTMLElement>("[data-lang]");
    if (opt) {
      setMenuOpen(false);
      menuBtn.focus();
      if (opt.dataset.lang && opt.dataset.lang !== getCurrentLang()) {
        langWrap.classList.add("is-loading");
        try {
          await onSelectLang(opt.dataset.lang);
        } finally {
          langWrap.classList.remove("is-loading");
        }
      }
    }
  });

  langWrap.addEventListener("keydown", (ev) => {
    if (menuEl.hidden) return;
    const opts = getOptions();
    const curIdx = opts.indexOf(document.activeElement as HTMLButtonElement);
    if (ev.key === "ArrowDown" || ev.key === "ArrowUp") {
      ev.preventDefault();
      opts[
        (curIdx + (ev.key === "ArrowDown" ? 1 : -1) + opts.length) % opts.length
      ].focus();
    } else if (ev.key === "Home" || ev.key === "End") {
      ev.preventDefault();
      opts[ev.key === "Home" ? 0 : opts.length - 1].focus();
    } else if (ev.key === "Escape") {
      ev.preventDefault();
      setMenuOpen(false);
      menuBtn.focus();
    } else if (ev.key === "Tab") {
      setMenuOpen(false, false);
    }
  });
}

function syncLanguageMenuUi(topbarEl: HTMLElement): void {
  const curCode = getCurrentLang();
  topbarEl.querySelector<HTMLElement>(".lang-code")!.textContent =
    LANGUAGES.find((l) => l.code === curCode)!.short;
  topbarEl
    .querySelectorAll<HTMLElement>(".lang-menu [data-lang]")
    .forEach((opt) =>
      opt.setAttribute("aria-checked", String(opt.dataset.lang === curCode)),
    );
}

export const OSI_LAYERS = [
  "Physical",
  "Data Link",
  "Network",
  "Transport",
  "Session",
  "Presentation",
  "Application",
];

export function retranslateTopbarUi(topbarEl: HTMLElement): void {
  syncLanguageMenuUi(topbarEl);
  topbarEl.querySelectorAll<HTMLElement>(".osi-chips span").forEach((el, idx) => {
    el.title = t("Layer {n}: {name}", {
      n: idx + 1,
      name: t(OSI_LAYERS[idx]),
    });
  });
  delete topbarEl.dataset.lesson;
}

const measureContentWidth = (el: Element): number => {
  const range = document.createRange();
  range.selectNodeContents(el);
  return range.getBoundingClientRect().width;
};

function fitTextLetterSpacing(el: HTMLElement | null): void {
  if (!el) return;
  el.style.letterSpacing = "";
  const availWidth = el.getBoundingClientRect().width - 0.5;
  const contentWidth = measureContentWidth(el);
  if (availWidth <= 0 || contentWidth <= availWidth) return;
  const origSpacing = getComputedStyle(el).letterSpacing;
  el.style.letterSpacing = "0px";
  const zeroSpacingWidth = measureContentWidth(el);
  el.style.letterSpacing =
    zeroSpacingWidth >= availWidth
      ? "0px"
      : `calc(${origSpacing} * ${(availWidth - zeroSpacingWidth) / (contentWidth - zeroSpacingWidth)})`;
}

export function fitTopbarTypography(rootEl: HTMLElement): void {
  fitTextLetterSpacing(rootEl.querySelector<HTMLElement>(".topbar .now-step"));
  const h1El = rootEl.querySelector<HTMLElement>(".brand-text h1");
  const pEl = rootEl.querySelector<HTMLElement>(".brand-text p");
  if (!h1El?.offsetWidth || !pEl) return;
  pEl.style.letterSpacing = pEl.style.fontSize = "";
  const h1Width = measureContentWidth(h1El);
  const pWidth = measureContentWidth(pEl);
  if (pWidth <= h1Width) return;
  const computed = getComputedStyle(pEl);
  const fontSizePx = parseFloat(computed.fontSize);
  const origEm = parseFloat(computed.letterSpacing) / fontSizePx;
  const minEm = 0.02;
  pEl.style.letterSpacing = `${minEm}em`;
  const minSpacingWidth = measureContentWidth(pEl);
  if (minSpacingWidth <= h1Width) {
    pEl.style.letterSpacing = `${origEm - ((pWidth - h1Width) / (pWidth - minSpacingWidth)) * (origEm - minEm)}em`;
  } else {
    pEl.style.fontSize = `${(fontSizePx * h1Width) / minSpacingWidth}px`;
  }
}

function renderNowLearningHtml(): string {
  return `
  <div class="now">
    <div class="now-label" ${tAttr("NOW LEARNING")}</div>
    <div class="now-title"><span class="now-name"></span></div>
    <div class="now-progress">
      <span class="now-dots"></span>
      <span class="now-step"></span>
    </div>
  </div>`;
}

function renderOsiLayerHtml(): string {
  const chipsHtml = OSI_LAYERS.map(
    (name, idx) =>
      `<span data-layer="${idx + 1}" title="${t("Layer {n}: {name}", { n: idx + 1, name: t(name) })}">${idx + 1}</span>`,
  ).join("");
  return `
  <div class="osi">
    <div class="osi-head">
      <span class="osi-label" ${tAttr("OSI LAYER")}</span>
      <span class="osi-name"></span>
    </div>
    <div class="osi-chips"><i class="osi-marker"></i>${chipsHtml}</div>
  </div>`;
}

export function renderTopbarHtml(): string {
  return `
  <header class="topbar">
    <button class="drawer-btn" type="button" data-t-label="Protocols" aria-label="${t("Protocols")}" aria-expanded="false" aria-controls="protocols">${ICONS.menu}<span ${tAttr("PROTOCOLS")}</span></button>
    <a class="brand" href="${process.env.NEXT_PUBLIC_BASE_PATH || ""}/" title="All explainers" style="color:inherit;text-decoration:none">
      <div class="logo-frame">
        <span class="corner tl"></span><span class="corner tr"></span>
        <span class="corner bl"></span><span class="corner br"></span>
        ${LOGO_CUBE_SVG}
      </div>
      <div class="brand-text">
        <h1>PROTOCOL <em>EXPLORER</em></h1>
        <p ${tAttr("LEARN HOW THE INTERNET WORKS")}</p>
      </div>
    </a>

    <span class="topbar-sep"></span>
    ${renderNowLearningHtml()}
    <span class="topbar-sep"></span>
    ${renderOsiLayerHtml()}

    <div class="topbar-tools">
      <span class="topbar-sep"></span>
      ${renderLearningProgressHtml()}
      <span class="topbar-sep"></span>
      ${renderCreditHtml()}
      <span class="topbar-sep"></span>
      ${renderLanguageMenuHtml()}
      <div class="theme-toggle" role="group" data-t-label="Theme" aria-label="${t("Theme")}">
        <button type="button" data-theme-choice="light" aria-pressed="false" data-t-label="Light mode" aria-label="${t("Light mode")}" data-t-title="Light mode" title="${t("Light mode")}">${ICONS.sun}</button>
        <button type="button" data-theme-choice="dark" aria-pressed="false" data-t-label="Dark mode" aria-label="${t("Dark mode")}" data-t-title="Dark mode" title="${t("Dark mode")}">${ICONS.moon}</button>
      </div>
    </div>
  </header>`;
}

function syncOsiMarkerPosition(topbarEl: HTMLElement, animate = true): void {
  const activeChip = topbarEl.querySelector<HTMLElement>(".osi-chips .is-active");
  const markerEl = topbarEl.querySelector<HTMLElement>(".osi-marker")!;
  if (!activeChip || !activeChip.offsetWidth) return;
  if (!animate) markerEl.style.transition = "none";
  markerEl.style.left = `${activeChip.offsetLeft}px`;
  markerEl.style.width = `${activeChip.offsetWidth}px`;
  if (!animate) {
    requestAnimationFrame(() => markerEl.style.removeProperty("transition"));
  }
}

function setTopbarLesson(topbarEl: HTMLElement, lesson: Lesson): void {
  const prevLayer = topbarEl.dataset.layer
    ? Number(topbarEl.dataset.layer)
    : null;
  topbarEl.dataset.lesson = lesson.id;
  topbarEl.dataset.layer = String(lesson.layer);

  animateTextChange(
    topbarEl.querySelector<HTMLElement>(".now-name")!,
    `${lesson.name} · ${toLocaleUpper(t(lesson.title))}`,
  );
  animateTextChange(
    topbarEl.querySelector<HTMLElement>(".osi-name")!,
    toLocaleUpper(t(OSI_LAYERS[lesson.layer - 1])),
    prevLayer && lesson.layer < prevLayer ? -1 : 1,
  );

  const dotsEl = topbarEl.querySelector<HTMLElement>(".now-dots")!;
  if (dotsEl.children.length !== lesson.steps.length) {
    dotsEl.innerHTML = lesson.steps.map(() => "<i></i>").join("");
  }
  dotsEl.style.setProperty("--dots", String(lesson.steps.length));

  const targetChip = topbarEl.querySelector<HTMLElement>(
    `.osi-chips [data-layer="${lesson.layer}"]`,
  );
  topbarEl
    .querySelectorAll<HTMLElement>(".osi-chips span")
    .forEach((el) => el.classList.toggle("is-active", el === targetChip));
  syncOsiMarkerPosition(topbarEl);

  if (prevLayer === null) {
    requestAnimationFrame(() =>
      topbarEl.querySelector<HTMLElement>(".osi-marker")!.classList.add("is-ready"),
    );
    new ResizeObserver(() => syncOsiMarkerPosition(topbarEl, false)).observe(
      topbarEl.querySelector<HTMLElement>(".osi-chips")!,
    );
  }
}

export function updateTopbarState(
  topbarEl: HTMLElement,
  state: SimulationState,
  lesson: Lesson,
): void {
  if (topbarEl.dataset.lesson !== lesson.id) {
    setTopbarLesson(topbarEl, lesson);
  }
  topbarEl.querySelectorAll<HTMLElement>(".now-dots i").forEach((dotEl, idx) => {
    dotEl.className = `is-${state.steps[idx]}`;
  });
  const activeStep = lesson.steps[state.activeStep];
  const stepText = state.done
    ? t("LESSON COMPLETE")
    : state.started
      ? t("STEP {n}/{total} · {title}", {
          n: state.activeStep + 1,
          total: lesson.steps.length,
          title: toLocaleUpper(t(activeStep.title)),
        })
      : t("OVERVIEW · {n} STEPS", { n: lesson.steps.length });

  animateTextChange(
    topbarEl.querySelector<HTMLElement>(".now-step")!,
    stepText,
    state.started ? 1 : -1,
    fitTextLetterSpacing,
  );
}

const THEME_STORAGE_KEY = "explainer:theme";
const THEME_COLORS: Record<"light" | "dark", string> = {
  light: "#fdfdfe",
  dark: "#0b1020",
};

function syncThemeButtonsUi(topbarEl: HTMLElement, theme: "light" | "dark"): void {
  let saved: string | null = null;
  try {
    saved = localStorage.getItem(THEME_STORAGE_KEY);
  } catch {}
  if (saved) {
    for (const meta of document.querySelectorAll<HTMLMetaElement>(
      'meta[name="theme-color"]',
    )) {
      meta.content = THEME_COLORS[theme];
    }
  }
  topbarEl.querySelectorAll<HTMLElement>("[data-theme-choice]").forEach((btn) => {
    const isActive = btn.dataset.themeChoice === theme;
    btn.classList.toggle("is-active", isActive);
    btn.setAttribute("aria-pressed", String(isActive));
  });
}

function switchThemeWithTransition(
  topbarEl: HTMLElement,
  theme: "light" | "dark",
  triggerBtn?: HTMLElement,
): void {
  const docEl = document.documentElement;
  if (docEl.dataset.theme === theme) {
    syncThemeButtonsUi(topbarEl, theme);
    return;
  }
  const apply = () => {
    docEl.dataset.theme = theme;
    syncThemeButtonsUi(topbarEl, theme);
  };
  const docWithTransition = document as Document & {
    startViewTransition?: (cb: () => void) => { ready: Promise<void> };
  };
  if (
    !triggerBtn ||
    !docWithTransition.startViewTransition ||
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  ) {
    apply();
    return;
  }
  const rect = triggerBtn.getBoundingClientRect();
  const cx = rect.left + rect.width / 2;
  const cy = rect.top + rect.height / 2;
  const maxRadius = Math.hypot(
    Math.max(cx, innerWidth - cx),
    Math.max(cy, innerHeight - cy),
  );
  docWithTransition
    .startViewTransition(apply)
    .ready.then(() =>
      docEl.animate(
        {
          clipPath: [
            `circle(0px at ${cx}px ${cy}px)`,
            `circle(${maxRadius}px at ${cx}px ${cy}px)`,
          ],
        },
        {
          duration: 650,
          easing: "cubic-bezier(0.16, 1, 0.3, 1)",
          pseudoElement: "::view-transition-new(root)",
        } as KeyframeAnimationOptions,
      ),
    );
}

export function initThemeToggle(topbarEl: HTMLElement): void {
  const initialTheme =
    document.documentElement.dataset.theme === "dark" ? "dark" : "light";
  syncThemeButtonsUi(topbarEl, initialTheme);

  topbarEl.querySelector(".theme-toggle")!.addEventListener("click", (ev) => {
    const btn = (ev.target as HTMLElement).closest<HTMLElement>(
      "[data-theme-choice]",
    );
    if (btn && (btn.dataset.themeChoice === "light" || btn.dataset.themeChoice === "dark")) {
      const choice = btn.dataset.themeChoice;
      try {
        localStorage.setItem(THEME_STORAGE_KEY, choice);
      } catch {}
      switchThemeWithTransition(topbarEl, choice, btn);
    }
  });

  window
    .matchMedia("(prefers-color-scheme: dark)")
    .addEventListener("change", (ev) => {
      let saved: string | null = null;
      try {
        saved = localStorage.getItem(THEME_STORAGE_KEY);
      } catch {}
      if (!saved) {
        switchThemeWithTransition(topbarEl, ev.matches ? "dark" : "light");
      }
    });
}
