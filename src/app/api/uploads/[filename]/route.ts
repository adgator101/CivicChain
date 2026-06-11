import { NextResponse } from "next/server";

// Legacy local-storage route. Images are now stored on Cloudinary.
// Old filenames that were saved before the Cloudinary migration can't be
// recovered from here — this handler just returns a clean 404 so callers
// get a usable response instead of a silent routing miss.
export function GET() {
  return NextResponse.json(
    { error: "Image not found. Images are now served from Cloudinary." },
    { status: 404 }
  );
}
