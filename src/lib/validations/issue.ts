import { z } from "zod";

// Issue/officer IDs are opaque keys. Most are cuids, but some (e.g. seeded demo
// issues) use friendly slugs like "seed-garbage-dharanline". We validate that an
// id is a non-empty string and let the action confirm it exists in the DB — so we
// never reject a legitimate id on format alone.
const id = z.string().min(1);

export const updateIssueStatusSchema = z.object({
  issueId: id,
  status: z.enum(["SUBMITTED", "VERIFIED", "ASSIGNED", "IN_PROGRESS", "RESOLVED", "REOPENED"]),
  comment: z.string().max(500).optional(),
  images: z.array(z.string()).max(5).default([]),
});

export const assignIssueSchema = z.object({
  issueId: id,
  assignedToId: z.string(),
  dueDate: z.string().datetime().optional(),
  comment: z.string().max(500).optional(),
});

// requests an officer to take an
// issue. No date here — the officer commits the completion date on acceptance.
export const requestAssignmentSchema = z.object({
  issueId: id,
  officerId: id,
  note: z.string().max(500).optional(),
});

// the requested officer accepts (committing a future completion date)
// or declines (optionally with a reason).
export const respondAssignmentSchema = z
  .object({
    issueId: id,
    decision: z.enum(["ACCEPT", "DECLINE"]),
    completionDate: z.string().datetime().optional(),
    note: z.string().max(500).optional(),
  })
  .refine((v) => v.decision !== "ACCEPT" || !!v.completionDate, {
    message: "A completion date is required to accept.",
    path: ["completionDate"],
  });

export const verifyIssueSchema = z.object({
  issueId: id,
  type: z.enum(["CONFIRM", "DISPUTE"]),
  comment: z.string().max(500).optional(),
  proofImages: z.array(z.string()).max(3).default([]),
  proofLatitude: z.number().optional(),
  proofLongitude: z.number().optional(),
});

export const createRootIssueSchema = z.object({
  title: z.string().min(5).max(120),
  description: z.string().min(10).max(1000),
  category: z.enum([
    "INFRASTRUCTURE",
    "WATER_SANITATION",
    "WASTE_MANAGEMENT",
    "ELECTRICITY",
    "ROAD",
    "ENVIRONMENT",
    "PUBLIC_SAFETY",
    "OTHER",
  ]),
  issueIds: z.array(id).min(1, "Select at least one issue"),
  municipalityName: z.string().optional(),
  districtName: z.string().optional(),
  provinceName: z.string().optional(),
});

export type UpdateIssueStatusInput = z.infer<typeof updateIssueStatusSchema>;
export type AssignIssueInput = z.infer<typeof assignIssueSchema>;
export type RequestAssignmentInput = z.infer<typeof requestAssignmentSchema>;
export type RespondAssignmentInput = z.infer<typeof respondAssignmentSchema>;
export type VerifyIssueInput = z.infer<typeof verifyIssueSchema>;
export type CreateRootIssueInput = z.infer<typeof createRootIssueSchema>;
