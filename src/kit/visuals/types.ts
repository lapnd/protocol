import type { ComponentType } from "react";
import type { Frame } from "../frame";
import type { Text, Visual } from "../types";

/** Props every visual renderer receives. */
export interface VisualProps<V extends Visual = Visual> {
  visual: V;
  frame: Frame;
  /** Resolve translatable text in the active locale. */
  t: (text: Text | undefined | null) => string;
  /** Playback speed multiplier, for animations. */
  speed: number;
}

/** A custom visual registered by name; receives the `custom` visual. */
export type CustomVisualComponent = ComponentType<
  VisualProps<Extract<Visual, { type: "custom" }>>
>;

export type CustomVisualRegistry = Record<string, CustomVisualComponent>;
