import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { IssueStatus, Priority, Category } from "@/generated/prisma/client";
import type { EscalationStatus } from "@/types";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// ─── Geospatial: haversine distance in meters ────────────────────────────────
export function haversineDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6_371_000; // Earth radius in meters
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// ─── Community Impact Score + priority auto-elevation ─────────────────────────
// Thresholds (per civicchain.mdc): 1→0.3, 3→0.6, 8→0.88 (HIGH), 15+→0.98 (CRITICAL).
// Priority auto-elevation here is PURE ARITHMETIC — the only allowed automatic
// priority change. It never lowers an existing higher priority.
export function computeImpact(reportCount: number): {
  score: number;
  priority?: Priority;
} {
  if (reportCount >= 15) return { score: 0.98, priority: "CRITICAL" };
  if (reportCount >= 8) return { score: 0.88, priority: "HIGH" };
  if (reportCount >= 3) return { score: 0.6 };
  return { score: 0.3 };
}

// Rank priorities so auto-elevation never demotes a manually-set higher priority.
const PRIORITY_RANK: Record<Priority, number> = {
  LOW: 0,
  MEDIUM: 1,
  HIGH: 2,
  CRITICAL: 3,
};

export function maxPriority(a: Priority, b: Priority): Priority {
  return PRIORITY_RANK[a] >= PRIORITY_RANK[b] ? a : b;
}

// SLA thresholds in hours by status
const SLA_HOURS: Record<IssueStatus, number | null> = {
  SUBMITTED: 48,
  VERIFIED: 72,
  ASSIGNED: 7 * 24,
  IN_PROGRESS: 14 * 24,
  RESOLVED: null,
  REOPENED: 7 * 24,
};

const PRIORITY_MULTIPLIERS: Record<Priority, number> = {
  CRITICAL: 0.25,
  HIGH: 0.5,
  MEDIUM: 1,
  LOW: 2,
};

export function computeEscalation(
  status: IssueStatus,
  priority: Priority,
  updatedAt: Date,
  dueDate: Date | null
): EscalationStatus {
  const slaHours = SLA_HOURS[status];
  if (slaHours === null) return { isEscalated: false, hoursOverdue: 0, threshold: "" };

  const effectiveSlaHours = dueDate
    ? (dueDate.getTime() - new Date(updatedAt).getTime()) / 3_600_000
    : slaHours * PRIORITY_MULTIPLIERS[priority];

  const hoursElapsed = (Date.now() - new Date(updatedAt).getTime()) / 3_600_000;
  const hoursOverdue = Math.max(0, hoursElapsed - effectiveSlaHours);

  return {
    isEscalated: hoursOverdue > 0,
    hoursOverdue: Math.round(hoursOverdue),
    threshold: `${Math.round(effectiveSlaHours)}h SLA`,
  };
}

export function formatRelativeTime(date: Date): string {
  const seconds = Math.floor((Date.now() - new Date(date).getTime()) / 1000);
  if (seconds < 60) return "just now";
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}

export function statusLabel(status: IssueStatus): string {
  const labels: Record<IssueStatus, string> = {
    SUBMITTED: "Submitted",
    VERIFIED: "Verified",
    ASSIGNED: "Assigned",
    IN_PROGRESS: "In Progress",
    RESOLVED: "Resolved",
    REOPENED: "Reopened",
  };
  return labels[status];
}

export function priorityLabel(priority: Priority): string {
  const labels: Record<Priority, string> = {
    LOW: "Low",
    MEDIUM: "Medium",
    HIGH: "High",
    CRITICAL: "Critical",
  };
  return labels[priority];
}

export function categoryLabel(category: Category): string {
  const labels: Record<Category, string> = {
    INFRASTRUCTURE: "Infrastructure",
    WATER_SANITATION: "Water & Sanitation",
    WASTE_MANAGEMENT: "Waste Management",
    ELECTRICITY: "Electricity",
    ROAD: "Road",
    ENVIRONMENT: "Environment",
    PUBLIC_SAFETY: "Public Safety",
    OTHER: "Other",
  };
  return labels[category];
}

// Confidence % shown to officers ("Confidence: 94%") derived from impact score.
export function impactConfidencePct(score: number): number {
  return Math.round(score * 100);
}
