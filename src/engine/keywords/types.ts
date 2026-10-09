import type { Slot } from "../types";

/** One store-agnostic search phrase for a gift slot. */
export type SlotPhrase = {
  slot: Slot;
  phrase: string;
  /** Short note on the angle (for pivot / debugging). */
  angle: string;
  pivotCount: number;
};
