"use client";

import type { Frame } from "../frame";
import type { Text } from "../types";
import { CardsView, ChartView, CodeView, TableView } from "./BasicViews";
import { DiagramView } from "./DiagramView";
import { SequenceView } from "./SequenceView";
import type { CustomVisualRegistry } from "./types";

/** Picks the renderer for the frame's visual. */
export function Stage({
  frame,
  t,
  speed,
  customVisuals = {},
}: {
  frame: Frame;
  t: (text: Text | undefined | null) => string;
  speed: number;
  customVisuals?: CustomVisualRegistry;
}) {
  const visual = frame.visual;
  const common = { frame, t, speed };
  switch (visual.type) {
    case "diagram":
      return <DiagramView visual={visual} {...common} />;
    case "sequence":
      return <SequenceView visual={visual} {...common} />;
    case "code":
      return <CodeView visual={visual} {...common} />;
    case "table":
      return <TableView visual={visual} {...common} />;
    case "chart":
      return <ChartView visual={visual} {...common} />;
    case "cards":
      return <CardsView visual={visual} {...common} />;
    case "custom": {
      const Custom = customVisuals[visual.component];
      if (!Custom) {
        return (
          <p className="ex-missing">
            Custom visual “{visual.component}” is not registered in
            src/explainers/custom-visuals.tsx
          </p>
        );
      }
      return <Custom visual={visual} {...common} />;
    }
  }
}
