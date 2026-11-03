"use client";

import { CUSTOM_VISUALS } from "../../explainers/custom-visuals";
import { ExplainerApp, type ExplainerAppProps } from "../../kit/components/ExplainerApp";

/** Client boundary: attaches the registered custom visuals. */
export default function ExplainerClient(props: Omit<ExplainerAppProps, "customVisuals">) {
  return <ExplainerApp {...props} customVisuals={CUSTOM_VISUALS} />;
}
