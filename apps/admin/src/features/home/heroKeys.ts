import type { HeroCardKey } from "./types";

export const ALL_HERO_KEYS: HeroCardKey[] = ["earn", "biawin", "reward"];

export interface HeroKeyAvailability {
  /** Keys the form may offer. */
  available: HeroCardKey[];
  /** Create mode and every key is already used — the form must not offer (or submit) anything. */
  exhausted: boolean;
}

/**
 * Stage 5.17-B — `HomeHeroCard.cardKey` is a closed, `@unique` 3-value enum
 * (`earn`/`biawin`/`reward`); no new value can exist. `takenKeys` are the keys
 * held by OTHER rows.
 *
 * - create: only keys nobody holds; if none, the form shows an explicit
 *   "all keys are used" state instead of offering a taken key.
 * - edit: the row's own current key plus any free key.
 * The backend's 409 remains the authority (this only prevents the obvious).
 */
export function heroKeyAvailability(mode: "create" | "edit", takenKeys: HeroCardKey[], ownKey?: HeroCardKey): HeroKeyAvailability {
  const free = ALL_HERO_KEYS.filter((key) => !takenKeys.includes(key));
  if (mode === "edit") {
    const available = ALL_HERO_KEYS.filter((key) => key === ownKey || free.includes(key));
    return { available, exhausted: false };
  }
  return { available: free, exhausted: free.length === 0 };
}
