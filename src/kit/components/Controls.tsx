"use client";

import { useLocale } from "../locale";
import type { Player } from "../usePlayer";

/** Transport bar under the stage: back, play/pause, next, replay, speed. */
export function Controls({ player, total }: { player: Player; total: number }) {
  const { u } = useLocale();
  const { index, playing } = player;
  const atEnd = index >= total;
  return (
    <div className="ex-controls">
      <div className="ex-controls-buttons">
        <button type="button" className="ex-icon-btn" onClick={player.prev} disabled={index < 0} aria-label={u("prev")} title={u("prev")}>
          ◀
        </button>
        <button
          type="button"
          className="ex-play"
          onClick={player.toggle}
          aria-label={playing ? u("pause") : atEnd ? u("replay") : u("play")}
        >
          {playing ? "❚❚" : atEnd ? "↺" : "▶"}
          <span>{playing ? u("pause") : atEnd ? u("replay") : u("play")}</span>
        </button>
        <button type="button" className="ex-icon-btn" onClick={player.next} disabled={atEnd} aria-label={u("next")} title={u("next")}>
          ▶
        </button>
        <button type="button" className="ex-icon-btn" onClick={player.reset} aria-label={u("replay")} title={u("replay")}>
          ↺
        </button>
        <button type="button" className="ex-speed" onClick={player.cycleSpeed} title={u("speed")}>
          {player.speed}×
        </button>
      </div>
      <ol className="ex-steps-bar" aria-label={u("step")}>
        {Array.from({ length: total }, (_, i) => (
          <li key={i}>
            <button
              type="button"
              className={i < index ? "is-done" : i === index ? "is-active" : undefined}
              aria-label={`${u("step")} ${i + 1}`}
              aria-current={i === index ? "step" : undefined}
              onClick={() => player.jump(i)}
            >
              {i === index && playing && (
                <i
                  key={player.tick}
                  className="ex-step-timer"
                  style={{ animationDuration: `${player.durationMs}ms` }}
                />
              )}
            </button>
          </li>
        ))}
      </ol>
    </div>
  );
}
