// Basis a LOCAL_BODY_HEAD must pick when manually verifying an issue
// (SUBMITTED → VERIFIED) without waiting for the weighted community threshold.
// Recording an explicit basis + attestation turns a one-click override into an
// accountable, auditable decision logged on the issue timeline.
export const VERIFY_BASIS = {
  FIELD_INSPECTION: "Confirmed by field / site inspection",
  CREDIBLE_EVIDENCE: "Attached photo evidence reviewed and credible",
  MULTIPLE_REPORTS: "Corroborated by multiple independent citizen reports",
  OFFICIAL_RECORD: "Matches official records / a known issue",
  OTHER: "Other (explained in note)",
} as const;

export type VerifyBasis = keyof typeof VERIFY_BASIS;

export const VERIFY_BASIS_KEYS = Object.keys(VERIFY_BASIS) as [VerifyBasis, ...VerifyBasis[]];
