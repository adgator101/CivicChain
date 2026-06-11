// Client-safe, pure recognition helper (no server imports, no AI, no randomness).
// Turns an officer's FACTUAL stats into a positive/neutral recognition tier.
//
// Principle: recognition is earned from real data and is only ever positive or
// neutral in public. There is no public "bad performer" signal here.

export const MIN_SAMPLE = 5; // committed resolutions needed before a tier is earned

export type OfficerStats = {
  resolved: number;
  committedResolved: number;
  onTime: number;
  onTimeRate: number | null;
  reopened: number;
};

export type Recognition = {
  tier: "trusted" | "reliable" | "new";
  label: string;
  blurb: string;
};

export function officerRecognition(s: OfficerStats): Recognition {
  if (s.committedResolved >= MIN_SAMPLE && s.onTimeRate != null) {
    if (s.onTimeRate >= 0.85 && s.reopened === 0) {
      return {
        tier: "trusted",
        label: "Trusted Responder",
        blurb: "Consistently resolves issues on time, and their fixes hold up.",
      };
    }
    if (s.onTimeRate >= 0.6) {
      return {
        tier: "reliable",
        label: "Reliable Responder",
        blurb: "Dependably resolves community issues.",
      };
    }
  }
  return {
    tier: "new",
    label: "Building their track record",
    blurb: "Working through community issues.",
  };
}

// "19 of 23 finished on time" — factual first, percentage second.
export function onTimeSummary(s: OfficerStats): string | null {
  if (s.committedResolved === 0 || s.onTimeRate == null) return null;
  const pct = Math.round(s.onTimeRate * 100);
  return `${s.onTime} of ${s.committedResolved} finished on time (${pct}%)`;
}
