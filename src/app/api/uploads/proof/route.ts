import { NextRequest, NextResponse } from "next/server";
import exifr from "exifr";
import { uploadBuffer } from "@/lib/cloudinary";

const ALLOWED = new Set(["image/jpeg", "image/png", "image/webp"]);
const MAX_BYTES = 8 * 1024 * 1024; // 8 MB

// Single-image geotagged proof upload (STORY-012).
// Parses EXIF GPS from the buffer, then uploads to Cloudinary.
export async function POST(request: NextRequest) {
  const formData = await request.formData();
  const file = formData.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "No file provided" }, { status: 400 });
  }
  if (!ALLOWED.has(file.type)) {
    return NextResponse.json({ error: `Unsupported file type: ${file.type}` }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: "File too large (max 8 MB)" }, { status: 400 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());

  // Parse EXIF GPS and upload to Cloudinary in parallel.
  const [gps, url] = await Promise.all([
    exifr.gps(buffer).catch(() => null),
    uploadBuffer(buffer, "civicchain/proofs"),
  ]);

  const latitude =
    gps && Number.isFinite(gps.latitude) ? gps.latitude : null;
  const longitude =
    gps && Number.isFinite(gps.longitude) ? gps.longitude : null;

  return NextResponse.json({
    url,
    latitude,
    longitude,
    source: latitude != null ? "exif" : "none",
  });
}
