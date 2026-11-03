import {
  type CancellationToken,
  playbackClock,
  waitScaled,
} from "../lib/motion";
import type {
  Lesson,
  LessonEvent,
  SimulationState,
  StepExecutionEvent,
} from "../types/protocol";
import type { NetworkCanvasController } from "./network-canvas";
import { SEQUENCE_TIMINGS } from "./sequence-diagram";

const STEP_PACING: Record<
  "network" | "sequence",
  { event: number; step: number; quick: number }
> = {
  network: { event: 450, step: 1100, quick: 120 },
  sequence: { event: 260, step: 650, quick: 80 },
};

function getSequenceEventDuration(event: LessonEvent): number {
  return event.type === "packet"
    ? event.quick
      ? SEQUENCE_TIMINGS.quick
      : SEQUENCE_TIMINGS.draw
    : event.type === "stream"
      ? (event.packets.length - 1) * SEQUENCE_TIMINGS.stagger +
        SEQUENCE_TIMINGS.draw
      : event.type === "note"
        ? SEQUENCE_TIMINGS.note
        : 0;
}

export interface SimulationController {
  reset: () => void;
  dispose: () => void;
  toggle: () => void;
  pause: () => void;
  play: () => void;
  step: () => void;
  setMode: (mode: "network" | "sequence") => void;
  jump: (stepIndex: number) => void;
}

export function createSimulationController(
  lesson: Lesson,
  netCtrl: NetworkCanvasController,
  onUpdate: (state: SimulationState) => void,
  { mode: initialMode = "network" }: { mode?: "network" | "sequence" } = {},
): SimulationController {
  const flatEvents: StepExecutionEvent[] = [
    { type: "focus", ...lesson.start, step: 0 },
    ...lesson.steps.flatMap((stepObj, stepIdx) =>
      stepObj.events.map((ev) => ({ ...ev, step: stepIdx })),
    ),
  ];

  const stepLastEventIndices = lesson.steps.map((_, stepIdx) =>
    flatEvents.findLastIndex((ev) => ev.step === stepIdx),
  );

  let cursorIndex = 0;
  let runningIndex = -1;
  let isPlaying = false;
  let runToken: CancellationToken = { cancelled: false };
  let pauseToken: CancellationToken | null = null;
  let currentMode: "network" | "sequence" = initialMode;

  function buildState(): SimulationState {
    const isDone = cursorIndex >= flatEvents.length && runningIndex === -1;
    const isStarted = cursorIndex > 0 || runningIndex !== -1;
    const currentEvIdx = runningIndex !== -1 ? runningIndex : cursorIndex - 1;
    const activeStep =
      currentEvIdx >= 0 ? flatEvents[currentEvIdx].step : 0;
    const isPacketOrStream = (ev: StepExecutionEvent) =>
      ev.type === "packet" || ev.type === "stream";
    const activePktEvIdx =
      currentEvIdx >= 0 && isPacketOrStream(flatEvents[currentEvIdx])
        ? currentEvIdx
        : -1;

    return {
      playing: isPlaying,
      running: runningIndex !== -1,
      started: isStarted,
      done: isDone,
      activeStep,
      event: currentEvIdx >= 0 ? flatEvents[currentEvIdx] : null,
      steps: lesson.steps.map((_, idx) =>
        idx === activeStep && isStarted && !isDone
          ? "active"
          : stepLastEventIndices[idx] < cursorIndex
            ? "done"
            : "todo",
      ),
      packets: flatEvents.flatMap((ev, idx) => {
        if (!isPacketOrStream(ev)) return [];
        const status =
          idx === activePktEvIdx
            ? "current"
            : idx < cursorIndex
              ? "past"
              : "future";
        return ev.type === "stream" ? ev.packets.map(() => status) : [status];
      }),
      notes: flatEvents.flatMap((ev, idx) =>
        ev.type === "note"
          ? [idx < cursorIndex || idx === runningIndex ? "past" : "future"]
          : [],
      ),
    };
  }

  let notifyScheduled = false;
  let isDisposed = false;

  function scheduleNotify(): void {
    if (!notifyScheduled) {
      notifyScheduled = true;
      queueMicrotask(() => {
        notifyScheduled = false;
        if (!isDisposed) {
          onUpdate(buildState());
        }
      });
    }
  }

  function applyStateUpToCursor(): void {
    const snap = netCtrl.snapshot();
    if (cursorIndex === 0) {
      netCtrl.overview(lesson.nodes, lesson.labels);
    } else {
      flatEvents.slice(0, cursorIndex).forEach((ev) => netCtrl.apply(ev));
    }
    netCtrl.morph(snap, runToken);
  }

  function getInterEventDelay(evIdx: number): number {
    const nextEv = flatEvents[evIdx + 1];
    const curEv = flatEvents[evIdx];
    const pacing = STEP_PACING[currentMode];
    const nextQuick =
      nextEv && "quick" in nextEv ? Boolean(nextEv.quick) : false;
    const curQuick = "quick" in curEv ? Boolean(curEv.quick) : false;
    return nextEv.step !== curEv.step
      ? pacing.step
      : nextQuick && curQuick
        ? pacing.quick
        : pacing.event;
  }

  async function executeNextEvent(): Promise<void> {
    if (runningIndex !== -1) return;
    if (cursorIndex >= flatEvents.length) {
      isPlaying = false;
      scheduleNotify();
      return;
    }
    const targetIdx = cursorIndex;
    const activeToken = runToken;
    runningIndex = targetIdx;
    scheduleNotify();

    if (currentMode === "sequence") {
      netCtrl.apply(flatEvents[targetIdx]);
      await waitScaled(getSequenceEventDuration(flatEvents[targetIdx]), activeToken);
    } else {
      await netCtrl.run(flatEvents[targetIdx], activeToken);
    }

    if (activeToken !== runToken) return;
    if (activeToken.finish) {
      runToken = { cancelled: false };
      netCtrl.clear();
      netCtrl.apply(flatEvents[targetIdx]);
    }
    runningIndex = -1;
    cursorIndex = targetIdx + 1;
    if (cursorIndex >= flatEvents.length) {
      isPlaying = false;
    }
    scheduleNotify();
    if (!isPlaying) return;

    const pToken: CancellationToken = (pauseToken = { cancelled: false });
    await waitScaled(() => getInterEventDelay(targetIdx), pToken);
    if (pauseToken === pToken) {
      pauseToken = null;
    }
    if (!pToken.cancelled && isPlaying) {
      executeNextEvent();
    }
  }

  function cancelRunning(): void {
    runToken.cancelled = true;
    runToken = { cancelled: false };
    if (pauseToken) {
      pauseToken.cancelled = true;
    }
    pauseToken = null;
    runningIndex = -1;
    netCtrl.clear();
    playbackClock.resume();
  }

  function reset(): void {
    cancelRunning();
    isPlaying = false;
    cursorIndex = 0;
    applyStateUpToCursor();
    scheduleNotify();
  }

  function play(): void {
    if (cursorIndex >= flatEvents.length && runningIndex === -1) {
      reset();
    }
    isPlaying = true;
    playbackClock.resume();
    scheduleNotify();
    if (runningIndex === -1 && !pauseToken) {
      executeNextEvent();
    }
  }

  function pause(): void {
    isPlaying = false;
    playbackClock.pause();
    scheduleNotify();
  }

  return {
    reset,
    dispose() {
      cancelRunning();
      isPlaying = false;
      isDisposed = true;
    },
    toggle: () => (isPlaying ? pause() : play()),
    pause,
    play,
    step() {
      isPlaying = false;
      if (pauseToken) {
        pauseToken.cancelled = true;
      }
      pauseToken = null;
      playbackClock.resume();
      scheduleNotify();
      if (runningIndex === -1) {
        executeNextEvent();
      }
    },
    setMode(nextMode) {
      if (nextMode !== currentMode) {
        currentMode = nextMode;
        if (nextMode === "sequence" && runningIndex !== -1) {
          runToken.finish = true;
          runToken.cancelled = true;
        }
      }
    },
    jump(stepIndex) {
      cancelRunning();
      cursorIndex = flatEvents.findIndex((ev) => ev.step === stepIndex);
      applyStateUpToCursor();
      play();
    },
  };
}
