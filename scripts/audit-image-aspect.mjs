#!/usr/bin/env node
/**
 * audit:image-aspect — a declared image size must match the artwork it
 * points at.
 *
 * WHY THIS GATE EXISTS
 *
 * Next.js's `<Image width={1200} height={675} className="w-full h-auto" />`
 * reserves a box with the DECLARED ratio, then fills it with the source
 * image. When the two disagree the artwork is stretched: the dashboard
 * screenshot is 2000×1372 (1.458:1) and was declared 1200×675 (16:9), so
 * every sponsor page rendered it 18% shorter than it is. The dashboard
 * read as squashed. `tsc` cannot see it, `next build` cannot see it, and
 * neither can a unit test — the image is fetched, decoded and stretched
 * correctly according to the markup.
 *
 * This is the same shape as the sitemap-parity defect: a CONTRACT between
 * two artifacts (the markup's declared geometry and the file on disk) that
 * nothing compares. The fix is to compare them.
 *
 * RULES
 *
 *   1. image-aspect-mismatch
 *      A local `<Image src="/…">` with explicit `width` and `height`
 *      whose ratio differs from the referenced file's real pixel
 *      dimensions by more than 2% is a stretched image.
 *
 * SCOPE
 *
 *   Only LOCAL images are checked — a remote `src` cannot be measured
 *   without a network call, and a wrong remote URL is a broken-image
 *   problem, not a geometry one. `fill` images are exempt: they take
 *   their box from the parent and the artwork is cropped, not stretched.
 *
 *   Dimensions are read from the file header directly (PNG / JPEG / GIF /
 *   WebP / SVG), not through an external tool, so the gate runs the same
 *   on a laptop and in CI.
 */

import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const SCAN_DIRS = ["app", "components"];
const TOLERANCE = 0.02; // 2% — covers rounding in hand-written dimensions

const findings = [];

function walk(dir, out = []) {
  let entries;
  try {
    entries = readdirSync(dir);
  } catch {
    return out;
  }
  for (const entry of entries) {
    const full = path.join(dir, entry);
    let st;
    try {
      st = statSync(full);
    } catch {
      continue;
    }
    if (st.isDirectory()) {
      if (entry === "node_modules" || entry === ".next" || entry === ".git") continue;
      walk(full, out);
    } else if (/\.(tsx|ts)$/.test(entry)) {
      out.push(full);
    }
  }
  return out;
}

/**
 * Pixel dimensions of an image file, read from its header.
 *
 * Returns null when the format is not recognised or the header is
 * unreadable — an unknown format is not a mismatch, it is an unknown.
 */
export function imageDimensions(file) {
  let buf;
  try {
    buf = readFileSync(file);
  } catch {
    return null;
  }
  if (buf.length < 16) return null;

  // PNG — IHDR is the first chunk: 8-byte signature, then length + type.
  if (
    buf[0] === 0x89 &&
    buf[1] === 0x50 &&
    buf[2] === 0x4e &&
    buf[3] === 0x47
  ) {
    return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
  }

  // GIF87a / GIF89a — little-endian dimensions at offset 6.
  if (buf[0] === 0x47 && buf[1] === 0x49 && buf[2] === 0x46) {
    return { width: buf.readUInt16LE(6), height: buf.readUInt16LE(8) };
  }

  // WEBP — RIFF container; the dimensions live in the VP8/VP8L/VP8X chunk.
  if (
    buf.toString("ascii", 0, 4) === "RIFF" &&
    buf.toString("ascii", 8, 12) === "WEBP"
  ) {
    const chunk = buf.toString("ascii", 12, 16);
    if (chunk === "VP8 ") {
      // Lossy: 3-byte frame tag, 3-byte sync code, then 16-bit dimensions.
      return { width: buf.readUInt16LE(26) & 0x3fff, height: buf.readUInt16LE(28) & 0x3fff };
    }
    if (chunk === "VP8L") {
      // Lossless: 1 byte of flags, then 14 bits of width-1 and 14 of height-1.
      const bits = buf.readUInt32LE(21);
      return { width: (bits & 0x3fff) + 1, height: ((bits >> 14) & 0x3fff) + 1 };
    }
    if (chunk === "VP8X") {
      // Extended: 24-bit canvas width-1 and height-1, little-endian.
      const w = 1 + (buf[24] | (buf[25] << 8) | (buf[26] << 16));
      const h = 1 + (buf[27] | (buf[28] << 8) | (buf[29] << 16));
      return { width: w, height: h };
    }
    return null;
  }

  // JPEG — walk the segment markers to the frame header (SOF0..SOF15).
  if (buf[0] === 0xff && buf[1] === 0xd8) {
    let offset = 2;
    while (offset < buf.length - 9) {
      if (buf[offset] !== 0xff) {
        offset += 1;
        continue;
      }
      const marker = buf[offset + 1];
      // SOF0..SOF15, excluding DHT (c4), JPG (c8) and DAC (cc).
      if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
        return { height: buf.readUInt16BE(offset + 5), width: buf.readUInt16BE(offset + 7) };
      }
      const segLength = buf.readUInt16BE(offset + 2);
      if (segLength < 2) return null;
      offset += 2 + segLength;
    }
    return null;
  }

  // SVG — use width/height when both are absolute, else the viewBox.
  if (buf.toString("ascii", 0, 4) === "<?xm" || buf.toString("ascii", 0, 200).includes("<svg")) {
    const text = buf.toString("utf8");
    const w = text.match(/\bwidth\s*=\s*"([0-9.]+)/);
    const h = text.match(/\bheight\s*=\s*"([0-9.]+)/);
    if (w && h) return { width: parseFloat(w[1]), height: parseFloat(h[1]) };
    const vb = text.match(/viewBox\s*=\s*"[\d.\-]+\s+[\d.\-]+\s+([\d.]+)\s+([\d.]+)/);
    if (vb) return { width: parseFloat(vb[1]), height: parseFloat(vb[2]) };
    return null;
  }

  return null;
}

/**
 * Every local `<Image src="/…">` with explicit width and height.
 *
 * The pattern is deliberately simple: the three attributes have to be on
 * the same element, and `src` has to come first so the width/height that
 * belong to it can be read. A `fill` image has no width/height and is
 * skipped by construction.
 */
function localImageDeclarations(src) {
  const out = [];
  const re = /<Image\b([\s\S]{0,800}?)\/?>/g;
  let m;
  while ((m = re.exec(src))) {
    const attrs = m[1];
    const s = attrs.match(/\bsrc\s*=\s*["'`]([^"'`]+)["'`]/);
    if (!s) continue;
    const srcValue = s[1];
    if (!srcValue.startsWith("/")) continue; // remote or imported
    const w = attrs.match(/\bwidth\s*=\s*\{(\d+(?:\.\d+)?)\}/);
    const h = attrs.match(/\bheight\s*=\s*\{(\d+(?:\.\d+)?)\}/);
    if (!w || !h) continue; // fill images take their box from the parent
    out.push({
      src: srcValue,
      width: parseFloat(w[1]),
      height: parseFloat(h[1]),
      index: m.index,
    });
  }
  return out;
}

function scanFile(file) {
  const src = readFileSync(file, "utf8");
  const decls = localImageDeclarations(src);
  if (!decls.length) return 0;

  let checked = 0;
  for (const d of decls) {
    const target = path.join(ROOT, "public", d.src.replace(/^\//, ""));
    if (!existsSync(target)) continue; // broken image — a different gate
    const dims = imageDimensions(target);
    if (!dims || !dims.width || !dims.height) continue;
    checked += 1;

    const declared = d.width / d.height;
    const actual = dims.width / dims.height;
    if (Math.abs(declared - actual) / actual <= TOLERANCE) continue;

    const line = src.slice(0, d.index).split("\n").length;
    const scale = declared / actual;
    const direction = scale > 1 ? "stretched vertically" : "squashed vertically";
    findings.push({
      file: path.relative(ROOT, file),
      line,
      detail:
        `"${d.src}" is declared as ${d.width}×${d.height} (ratio ${declared.toFixed(3)}) ` +
        `but the artwork is ${dims.width}×${dims.height} (ratio ${actual.toFixed(3)}), so it ` +
        `renders ${direction}. Declare the asset's own proportions.`,
    });
  }
  return checked;
}

// ── Run ─────────────────────────────────────────────────────────────────────

const files = [];
for (const dir of SCAN_DIRS) {
  const full = path.join(ROOT, dir);
  if (existsSync(full)) walk(full, files);
}

let checked = 0;
for (const file of files) checked += scanFile(file);

for (const f of findings) {
  console.error(`[image-aspect] ${f.file}:${f.line} — image-aspect-mismatch`);
  console.error(`    ${f.detail}`);
}

console.log(
  `[image-aspect] examined ${files.length} file(s) containing ${checked} local <Image> ` +
    `declaration(s) with explicit dimensions; ${findings.length} finding(s) across 1 rule.`,
);

if (findings.length > 0) {
  console.error("[image-aspect] FAILED — an image renders stretched.");
  process.exit(1);
}
console.log("[image-aspect] no findings — every declared image matches its artwork.");
