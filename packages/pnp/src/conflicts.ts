import type { Qti3PnpPreference } from "./types.js";

export interface Qti3PnpSupportConflict {
  support: string;
  requested: Qti3PnpPreference;
  prohibited: Qti3PnpPreference;
}

export function findSupportConflicts(preferences: Qti3PnpPreference[]): Qti3PnpSupportConflict[] {
  const requested = new Map<string, Qti3PnpPreference>();
  const prohibited = new Map<string, Qti3PnpPreference>();
  for (const preference of preferences) {
    const support = preference.support.toLowerCase();
    if (preference.mode === "prohibited") prohibited.set(support, preference);
    else requested.set(support, preference);
  }
  const conflicts: Qti3PnpSupportConflict[] = [];
  for (const [support, requestedPreference] of requested) {
    const prohibitedPreference = prohibited.get(support);
    if (prohibitedPreference) {
      conflicts.push({
        support,
        requested: requestedPreference,
        prohibited: prohibitedPreference,
      });
    }
  }
  return conflicts;
}

export function conflictingSupportNames(preferences: Qti3PnpPreference[]): Set<string> {
  return new Set(findSupportConflicts(preferences).map((conflict) => conflict.support));
}
