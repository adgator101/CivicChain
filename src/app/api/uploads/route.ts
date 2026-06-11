import { NextRequest, NextResponse } from "next/server";
import { uploadBuffer } from "@/lib/cloudinary";

const ALLOWED = new Set(["image/jpeg", "image/png", "image/webp"]);
const MAX_BYTES = 5 * 1024 * 1024; // 5 MB per file

export async function POST(request: NextRequest) {
  const formData = await request.formData();
  const files = formData.getAll("files").filter((f): f is File => f instanceof File);

  if (files.length === 0) {
    return NextResponse.json({ error: "No files provided" }, { status: 400 });
  }
  if (files.length > 5) {
    return NextResponse.json({ error: "Maximum 5 files" }, { status: 400 });
  }

  // Validate all files before touching the network.
  for (const file of files) {
    if (!ALLOWED.has(file.type)) {
      return NextResponse.json(
        { error: `Unsupported file type: ${file.type}` },
        { status: 400 }
      );
    }
    if (file.size > MAX_BYTES) {
      return NextResponse.json({ error: "File too large (max 5 MB)" }, { status: 400 });
    }
  }

  // Read all buffers and upload in parallel — no more sequential waterfall.
  const buffers = await Promise.all(
    files.map((f) => f.arrayBuffer().then((ab) => Buffer.from(ab)))
  );

  const urls = await Promise.all(
    buffers.map((buf) => uploadBuffer(buf, "civicchain/reports"))
  );

  return NextResponse.json({ urls });
}
