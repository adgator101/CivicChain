import { z } from "zod";

export const createReportSchema = z.object({
  title: z.string().min(5, "Title must be at least 5 characters").max(120),
  description: z.string().min(20, "Please describe the issue in more detail").max(2000),
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
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  address: z.string().optional(),
  wardNumber: z.number().int().min(1).max(50).optional(),
  municipalityName: z.string().optional(),
  districtName: z.string().optional(),
  provinceName: z.string().optional(),
  images: z.array(z.string()).max(5, "Maximum 5 images").default([]),
});

export type CreateReportInput = z.infer<typeof createReportSchema>;

// Used when the citizen resolves a 0.50–0.79 semantic-similarity prompt:
// either attach to the suggested issue, or submit as a separate new issue.
export const resolveReportSchema = createReportSchema.extend({
  decision: z.enum(["attach", "new"]),
  attachIssueId: z.string().optional(),
});

export type ResolveReportInput = z.infer<typeof resolveReportSchema>;
