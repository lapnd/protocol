export const EASE_OUT_EXPO = "cubic-bezier(0.16, 1, 0.3, 1)";
export const EASE_IN_CUBIC = "cubic-bezier(0.5, 0, 0.75, 0)";
export const EASE_STANDARD = "cubic-bezier(0.4, 0, 0.2, 1)";

export function prefersReducedMotion(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export const isReducedMotion = prefersReducedMotion;

interface ActiveTransitionState {
  phase: "out" | "in";
  update: () => void;
  dir: number;
  entering?: Animation;
}

const activeTransitions = new WeakMap<HTMLElement, ActiveTransitionState>();

export interface SlideTransitionOptions {
  axis?: "x" | "y";
  dir?: number;
  distance?: number;
  out?: number;
  inn?: number;
}

/**
 * Smoothly slides an element out along `axis`, runs `updateDom()`, and slides it back in.
 * Handles mid-flight interruption gracefully.
 */
export function animateSlideSwap(
  element: HTMLElement,
  updateDom: () => void,
  {
    axis = "x",
    dir = 1,
    distance = 24,
    out = 160,
    inn = 300,
  }: SlideTransitionOptions = {},
): void {
  if (prefersReducedMotion()) {
    updateDom();
    return;
  }
  const translateCss = (offset: number) =>
    axis === "x" ? `translateX(${offset}px)` : `translateY(${offset}px)`;

  const existing = activeTransitions.get(element);
  if (existing?.phase === "out") {
    existing.update = updateDom;
    existing.dir = dir;
    return;
  }

  const computed = getComputedStyle(element);
  const currentKeyframe = {
    transform: computed.transform,
    opacity: Number(computed.opacity),
  };

  if (existing?.phase === "in" && currentKeyframe.opacity < 0.5) {
    existing.entering?.cancel();
    updateDom();
    existing.entering = element.animate(
      [currentKeyframe, { transform: "none", opacity: 1 }],
      {
        duration: inn * (1 - currentKeyframe.opacity),
        easing: EASE_OUT_EXPO,
      },
    );
    existing.entering.onfinish = () => {
      if (activeTransitions.get(element) === existing) {
        activeTransitions.delete(element);
      }
    };
    return;
  }

  existing?.entering?.cancel();
  const state: ActiveTransitionState = {
    phase: "out",
    update: updateDom,
    dir,
  };
  activeTransitions.set(element, state);

  const exitAnim = element.animate(
    [currentKeyframe, { transform: translateCss(-distance * dir), opacity: 0 }],
    {
      duration: out * currentKeyframe.opacity,
      easing: existing ? "linear" : EASE_IN_CUBIC,
      fill: "forwards",
    },
  );

  exitAnim.onfinish = () => {
    if (activeTransitions.get(element) !== state) return;
    state.update();
    state.phase = "in";
    state.entering = element.animate(
      [
        { transform: translateCss(distance * state.dir), opacity: 0 },
        { transform: "none", opacity: 1 },
      ],
      { duration: inn, easing: EASE_OUT_EXPO },
    );
    exitAnim.cancel();
    state.entering.onfinish = () => {
      if (activeTransitions.get(element) === state) {
        activeTransitions.delete(element);
      }
    };
  };
}

export const getRtlDirectionMultiplier = (): number =>
  typeof document !== "undefined" && document.documentElement.dir === "rtl"
    ? -1
    : 1;

export const animateHorizontalSwap = (
  element: HTMLElement,
  updateDom: () => void,
  dir = 1,
  distance = 24,
): void =>
  animateSlideSwap(element, updateDom, {
    axis: "x",
    dir: dir * getRtlDirectionMultiplier(),
    distance,
  });

/**
 * Updates `element.textContent` with a vertical slide-fade transition when the text changes.
 */
export function animateTextChange(
  element: HTMLElement,
  nextText: string,
  dir = 1,
  afterUpdate?: (el: HTMLElement) => void,
): void {
  if (element.dataset.text === nextText) return;
  const isInitial = element.dataset.text === undefined;
  element.dataset.text = nextText;
  const apply = () => {
    element.textContent = nextText;
    afterUpdate?.(element);
  };
  if (isInitial) {
    apply();
    return;
  }
  animateSlideSwap(element, apply, {
    axis: "y",
    dir,
    distance: 10,
    out: 120,
    inn: 240,
  });
}

interface GlideScrollElement extends HTMLElement {
  _glide?: { stopped?: boolean };
  _glideWatched?: boolean;
}

/**
 * Smoothly glides `container.scrollTop` to `targetScrollTop` with cubic ease-in-out,
 * cancelling if the user manually scrolls via wheel or touch.
 */
export function smoothScrollTo(
  container: GlideScrollElement,
  targetScrollTop: number,
): void {
  const startTop = container.scrollTop;
  const clampedTarget = Math.max(
    0,
    Math.min(targetScrollTop, container.scrollHeight - container.clientHeight),
  );
  const delta = clampedTarget - startTop;
  if (Math.abs(delta) < 1) return;
  if (prefersReducedMotion()) {
    container.scrollTop = startTop + delta;
    return;
  }
  const duration = Math.min(650, 280 + Math.abs(delta) * 0.8);
  const token: { stopped?: boolean } = (container._glide = {});
  if (!container._glideWatched) {
    container._glideWatched = true;
    const stopGlide = () => {
      if (container._glide) container._glide.stopped = true;
    };
    container.addEventListener("wheel", stopGlide, { passive: true });
    container.addEventListener("touchstart", stopGlide, { passive: true });
  }
  let startTime: number | undefined;
  const step = (now: number) => {
    if (token.stopped || container._glide !== token) return;
    startTime ??= now;
    const t = Math.min(1, (now - startTime) / duration);
    const eased = t < 0.5 ? 4 * t ** 3 : 1 - (2 - 2 * t) ** 3 / 2;
    container.scrollTop = startTop + delta * eased;
    if (t < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}

let currentPlaybackSpeed = 1;
let isPlaybackPaused = false;
const trackedWebAnimations = new Set<Animation>();

function syncAnimationPlaybackState(anim: Animation): void {
  anim.playbackRate = currentPlaybackSpeed;
  if (isPlaybackPaused && anim.playState === "running") {
    anim.pause();
  } else if (!isPlaybackPaused && anim.playState === "paused") {
    anim.play();
  }
}

export const playbackClock = {
  get speed(): number {
    return currentPlaybackSpeed;
  },
  get paused(): boolean {
    return isPlaybackPaused;
  },
  setSpeed(nextSpeed: number): void {
    currentPlaybackSpeed = nextSpeed;
    trackedWebAnimations.forEach(syncAnimationPlaybackState);
  },
  pause(): void {
    isPlaybackPaused = true;
    trackedWebAnimations.forEach(syncAnimationPlaybackState);
  },
  resume(): void {
    isPlaybackPaused = false;
    trackedWebAnimations.forEach(syncAnimationPlaybackState);
  },
  track(anim: Animation): Animation {
    trackedWebAnimations.add(anim);
    syncAnimationPlaybackState(anim);
    const cleanup = () => trackedWebAnimations.delete(anim);
    anim.addEventListener("finish", cleanup);
    anim.addEventListener("cancel", cleanup);
    return anim;
  },
};

export interface CancellationToken {
  cancelled: boolean;
  finish?: boolean;
}

/**
 * Runs a frame-by-frame animation scaled by `playbackClock.speed` and paused when `playbackClock.paused` is true.
 */
export function runScaledAnimation(
  durationMsOrFn: number | (() => number),
  token: CancellationToken,
  onProgress: (progress: number) => void = () => {},
): Promise<void> {
  return new Promise((resolve) => {
    let lastTimestamp: number | null = null;
    let elapsedScaledMs = 0;
    const tick = (now: number) => {
      if (token.cancelled) {
        resolve();
        return;
      }
      if (lastTimestamp !== null && !isPlaybackPaused) {
        elapsedScaledMs += (now - lastTimestamp) * currentPlaybackSpeed;
      }
      lastTimestamp = now;
      const totalDuration =
        typeof durationMsOrFn === "function"
          ? durationMsOrFn()
          : durationMsOrFn;
      const progress =
        totalDuration > 0
          ? Math.max(0, Math.min(1, elapsedScaledMs / totalDuration))
          : 1;
      onProgress(progress);
      if (progress < 1) {
        requestAnimationFrame(tick);
      } else {
        resolve();
      }
    };
    requestAnimationFrame(tick);
  });
}

export const waitScaled = (
  durationMsOrFn: number | (() => number),
  token: CancellationToken,
): Promise<void> => runScaledAnimation(durationMsOrFn, token);
