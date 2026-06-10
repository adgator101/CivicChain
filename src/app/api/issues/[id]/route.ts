import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/session";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const user = await getCurrentUser();

  const issue = await prisma.issue.findUnique({
    where: { id },
    include: {
      reports: {
        select: {
          id: true,
          title: true,
          images: true,
          createdAt: true,
          user: { select: { id: true, name: true } },
        },
        orderBy: { createdAt: "desc" },
      },
      updates: {
        include: { author: { select: { id: true, name: true } } },
        orderBy: { createdAt: "asc" },
      },
      assignedTo: { select: { id: true, name: true, municipalityName: true } },
      rootIssue: true,
      _count: { select: { reports: true } },
    },
  });

  if (!issue) {
    return NextResponse.json({ error: "Issue not found" }, { status: 404 });
  }

  const myVerification = user
    ? (
        await prisma.issueVerification.findUnique({
          where: { issueId_userId: { issueId: id, userId: user.id } },
          select: { type: true },
        })
      )?.type ?? null
    : null;

  return NextResponse.json({ issue: { ...issue, myVerification } });
}
