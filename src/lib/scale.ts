// The balance score and its five classes. Mirrors pipeline/gap.py so the
// planner can recompute scores in the browser when seats are changed.
import type { ClassKey } from "./types";

export const SCORE_K = 1.2;
export const PAD = 3;
export const CUTS: [number, number] = [25, 60];

/** +100 = acute shortage, -100 = saturated. */
export function scoreOf(demand: number, supply: number): number {
  return 100 * Math.tanh(SCORE_K * Math.log((demand + PAD) / (supply + PAD)));
}

export const CLASS_ORDER: ClassKey[] = ["saturated", "surplus", "balanced", "shortage", "acute_shortage"];

export function classOf(score: number): ClassKey {
  if (score >= CUTS[1]) return "acute_shortage";
  if (score >= CUTS[0]) return "shortage";
  if (score > -CUTS[0]) return "balanced";
  if (score > -CUTS[1]) return "surplus";
  return "saturated";
}

const VAR: Record<ClassKey, string> = {
  acute_shortage: "acute",
  shortage: "shortage",
  balanced: "balanced",
  surplus: "surplus",
  saturated: "saturated",
};

/** CSS colour for a class fill, and the readable ink to set on top of it. */
export const classFill = (c: ClassKey) => `var(--cls-${VAR[c]})`;
export const classInk = (c: ClassKey) => `var(--on-cls-${VAR[c]})`;
export const scoreFill = (score: number) => classFill(classOf(score));

/** Demand-to-supply ratio implied by a score threshold, for explaining the classes. */
export const ratioAt = (score: number) => Math.exp(Math.atanh(score / 100) / SCORE_K);
