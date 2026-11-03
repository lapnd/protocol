"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { STORAGE_KEYS, readStorage, writeStorage } from "./storage";
import { plain, readingSeconds } from "./text";
import type { Lesson } from "./types";

export const SPEEDS = [0.5, 1, 1.5, 2] as const;

export interface Player {
  /** -1 = intro, 0..n-1 = steps, n = outro. */
  index: number;
  playing: boolean;
  speed: number;
  /** Milliseconds the current step lasts at the current speed (autoplay). */
  durationMs: number;
  /** Increments on every (re)start of a step; use as a React key. */
  tick: number;
  play: () => void;
  pause: () => void;
  toggle: () => void;
  next: () => void;
  prev: () => void;
  jump: (index: number) => void;
  reset: () => void;
  cycleSpeed: () => void;
}

/**
 * Step-through playback for one lesson. Autoplay waits for each step's
 * `duration` (or its reading time), scaled by speed, then advances.
 */
export function usePlayer(
  lesson: Lesson,
  resolveText: (t: Lesson["steps"][number]["body"]) => string,
  onReach?: (index: number) => void,
): Player {
  const total = lesson.steps.length;
  const [index, setIndex] = useState(-1);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [tick, setTick] = useState(0);
  const onReachRef = useRef(onReach);
  onReachRef.current = onReach;

  useEffect(() => {
    const saved = Number(readStorage(STORAGE_KEYS.speed));
    if ((SPEEDS as readonly number[]).includes(saved)) setSpeed(saved);
  }, []);

  // New lesson → back to the intro.
  useEffect(() => {
    setIndex(-1);
    setPlaying(false);
    setTick((t) => t + 1);
  }, [lesson]);

  const step = index >= 0 && index < total ? lesson.steps[index] : null;
  const seconds = step
    ? (step.duration ?? readingSeconds(plain(resolveText(step.body))))
    : 1.2;
  const durationMs = (seconds * 1000) / speed;

  useEffect(() => {
    if (index >= 0) onReachRef.current?.(index);
  }, [index]);

  useEffect(() => {
    if (!playing) return;
    if (index >= total) {
      setPlaying(false);
      return;
    }
    const id = window.setTimeout(() => {
      setIndex((i) => Math.min(total, i + 1));
      setTick((t) => t + 1);
    }, durationMs);
    return () => window.clearTimeout(id);
  }, [playing, index, total, durationMs, tick]);

  const jump = useCallback(
    (i: number) => {
      setIndex(Math.max(-1, Math.min(total, i)));
      setTick((t) => t + 1);
    },
    [total],
  );

  const play = useCallback(() => {
    setIndex(index < 0 || index >= total ? 0 : index);
    setTick((t) => t + 1);
    setPlaying(true);
  }, [index, total]);

  const pause = useCallback(() => setPlaying(false), []);
  const toggle = useCallback(
    () => (playing ? pause() : play()),
    [playing, pause, play],
  );

  const next = useCallback(() => {
    setPlaying(false);
    jump(index + 1);
  }, [index, jump]);

  const prev = useCallback(() => {
    setPlaying(false);
    jump(index - 1);
  }, [index, jump]);

  const reset = useCallback(() => {
    setPlaying(false);
    jump(-1);
  }, [jump]);

  const cycleSpeed = useCallback(() => {
    setSpeed((s) => {
      const nextSpeed = SPEEDS[(SPEEDS.indexOf(s as never) + 1) % SPEEDS.length];
      writeStorage(STORAGE_KEYS.speed, String(nextSpeed));
      return nextSpeed;
    });
  }, []);

  return {
    index,
    playing,
    speed,
    durationMs,
    tick,
    play,
    pause,
    toggle,
    next,
    prev,
    jump,
    reset,
    cycleSpeed,
  };
}
