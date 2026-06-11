// One-off generator for PWA icons. Renders a brand SVG (Nepal-flag-inspired
// double pennant on nilo) to the PNG sizes the web app manifest needs.
//   node scripts/generate-pwa-icons.mjs
import sharp from "sharp";
import { writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const NILO = "#22304a";
const SIMRIK = "#c42139";
const PAPER = "#faf9f7";

// `pad` = fraction of safe-zone padding around the glyph (maskable needs ~10%).
function svg({ size, rounded, pad }) {
  const cx = size / 2;
  // Pennant geometry scaled into the safe area.
  const inset = size * pad;
  const w = size - inset * 2;
  const top = inset;
  const peakGap = w * 0.16;
  // Two stacked triangular pennants (white over simrik), point-down.
  const p1 = `${inset},${top} ${inset + w},${top} ${cx},${top + w * 0.46}`;
  const t2 = top + w * 0.3;
  const p2 = `${inset},${t2} ${inset + w},${t2} ${cx},${t2 + w * 0.46}`;
  const radius = rounded ? size * 0.18 : 0;
  return Buffer.from(`
<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <rect width="${size}" height="${size}" rx="${radius}" ry="${radius}" fill="${NILO}"/>
  <polygon points="${p1}" fill="${SIMRIK}"/>
  <polygon points="${p2}" fill="${PAPER}"/>
  <circle cx="${cx}" cy="${size * 0.78}" r="${size * 0.055}" fill="${PAPER}"/>
  <rect x="${cx - size * 0.012}" y="${top}" width="${size * 0.024}" height="${size * 0.62}" fill="${PAPER}" opacity="0.85"/>
  ${void peakGap || ""}
</svg>`);
}

const outDir = resolve("public");
const targets = [
  { name: "icon-192.png", size: 192, rounded: true, pad: 0.16 },
  { name: "icon-512.png", size: 512, rounded: true, pad: 0.16 },
  { name: "icon-maskable-512.png", size: 512, rounded: false, pad: 0.22 },
  { name: "apple-touch-icon.png", size: 180, rounded: true, pad: 0.14 },
];

for (const t of targets) {
  const png = await sharp(svg(t)).png().toBuffer();
  await writeFile(resolve(outDir, t.name), png);
  console.log("wrote public/" + t.name);
}
