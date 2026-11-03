"use client";

/**
 * Custom visuals, referenced from content as
 *   { type: "custom", component: "<name>", props: { ... } }
 *
 * Use one only when no built-in visual (diagram, sequence, code, table,
 * chart, cards) fits. Each component receives { visual, frame, t, speed };
 * read `frame.current.custom` for per-step data.
 */
import type { CustomVisualRegistry, VisualProps } from "../kit/visuals/types";

type CustomProps = VisualProps<Extract<VisualProps["visual"], { type: "custom" }>>;

/** Example: a big number that changes per step (state.custom.value). */
function BigNumber({ visual, frame, t }: CustomProps) {
  const props = visual.props as { label?: string; unit?: string } | undefined;
  const value = (frame.current.custom?.value as number | undefined) ?? 0;
  return (
    <div style={{ textAlign: "center" }}>
      <div style={{ fontSize: 72, fontWeight: 800, color: "var(--ex-accent)" }}>
        {value.toLocaleString()}
        {props?.unit ? <small style={{ fontSize: 28 }}> {props.unit}</small> : null}
      </div>
      {props?.label && <div style={{ color: "var(--ex-ink-3)" }}>{t(props.label)}</div>}
    </div>
  );
}

export const CUSTOM_VISUALS: CustomVisualRegistry = {
  "big-number": BigNumber,
};
