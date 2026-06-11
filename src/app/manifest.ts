import type { MetadataRoute } from "next";

// Web app manifest (Next.js App Router file convention). Makes CivicChain
// installable to a phone home screen and gives it an app-like standalone shell —
// the foundation for the offline complaint flow.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "CivicChain Nepal — Civic Accountability",
    short_name: "CivicChain",
    description:
      "Report civic issues — even offline. Your complaint is saved on your phone and sent automatically when you're back online.",
    start_url: "/offline-report",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#faf9f7",
    theme_color: "#22304a",
    categories: ["government", "utilities", "productivity"],
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      {
        src: "/icon-maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
    shortcuts: [
      {
        name: "Report an issue",
        short_name: "Report",
        url: "/offline-report",
        icons: [{ src: "/icon-192.png", sizes: "192x192" }],
      },
    ],
  };
}
