// Static audit for the mobile defects that `tsc` and `next build` cannot see.
//
// Why this exists: in the 2026-10-23 mobile audit, every real defect (a 19px
// horizontal clip, iOS viewport zoom on focus, a submit button clipped out of
// reach inside a modal, 40px tap targets) passed `npm run check` and
// `npm run build` cleanly. They only appeared when a human opened the page at
// 375px. Nothing in the toolchain catches them, so they come back.
//
// This script encodes the rules we had to learn the hard way, as a gate that
// runs in a second and never lies:
//
//   ios-input-font-floor     iOS Safari zooms the viewport when a focused
//                            field computes under 16px, and the zoom breaks
//                            the 375px layout for the rest of the session.
//   grid-1fr-min-content     `grid-cols-[1fr_auto_1fr]` tracks have a
//                            min-content minimum, so long words overflow.
//   dead-href                `href="#"` is a link that goes nowhere.
//   image-missing-alt        next/image without alt.
//   tap-target-under-44      WCAG / iOS HIG minimum touch target.
//   fixed-width-overflow     hardcoded px widths wider than a 375px viewport.
//
// Read-only. It never writes a file and never touches the network.
//
//   npx tsx scripts/audit-mobile-ui.ts            # report, exit 1 on findings
//   npx tsx scripts/audit-mobile-ui.ts --quiet    # summary only
//
// Exits 0 when clean so it can be wired into a pre-ship check.

import * as fs from "fs";
import * as path from "path";

type Finding = {
  rule: string;
  file: string;
  line: number;
  detail: string;
};

const ROOT = path.resolve(process.cwd());
const SCAN_DIRS = ["app", "components", "lib"];
const SKIP_DIRS = new Set(["node_modules", ".next", ".next-prod", ".turbo", "dist", "build"]);
const QUIET = process.argv.includes("--quiet");

/** Tailwind font-size utilities and their pixel values. */
const FONT_SIZES: Record<string, number> = {
  "text-xs": 12,
  "text-sm": 14,
  "text-base": 16,
  "text-lg": 18,
  "text-xl": 20,
  "text-2xl": 24,
  "text-3xl": 30,
  "text-4xl": 36,
};

/** Tailwind spacing scale -> px, for the fixed `h-`/`w-` utilities. */
const SPACING: Record<string, number> = {
  "1": 4, "2": 8, "3": 12, "4": 16, "5": 20, "6": 24, "7": 28, "8": 32,
  "9": 36, "10": 40, "11": 44, "12": 48, "14": 56, "16": 64, "20": 80,
};

function walk(dir: string, out: string[] = []): string[] {
  if (!fs.existsSync(dir)) return out;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name.startsWith(".") && entry.name !== ".well-known") continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (SKIP_DIRS.has(entry.name)) continue;
      walk(full, out);
    } else if (/\.(tsx|ts|jsx|js)$/.test(entry.name)) {
      out.push(full);
    }
  }
  return out;
}

/** All className="..." / className={`...`} string bodies in a source file. */
function classStrings(src: string): string[] {
  const out: string[] = [];
  const re = /className\s*=\s*(?:"([^"]*)"|'([^']*)'|\{`([^`]*)`\})/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(src))) {
    out.push(m[1] ?? m[2] ?? m[3] ?? "");
  }
  return out;
}

/** Raw JSX tag bodies, e.g. `<input ...>` up to the closing `>` of the tag. */
function tagBodies(src: string, tag: string): Array<{ body: string; index: number }> {
  const out: Array<{ body: string; index: number }> = [];
  const re = new RegExp(`<${tag}\\b`, "g");
  let m: RegExpExecArray | null;
  while ((m = re.exec(src))) {
    let i = m.index + m[0].length;
    let depth = 0;
    let quote: string | null = null;
    let inTemplate = false;
    for (; i < src.length; i++) {
      const ch = src[i];
      if (quote) {
        if (ch === quote && src[i - 1] !== "\\") quote = null;
        continue;
      }
      if (ch === '"' || ch === "'") { quote = ch; continue; }
      if (ch === "`") { inTemplate = !inTemplate; continue; }
      if (inTemplate) continue;
      if (ch === "{") { depth++; continue; }
      if (ch === "}") { depth--; continue; }
      if (depth === 0 && ch === ">") break;
    }
    out.push({ body: src.slice(m.index, i + 1), index: m.index });
  }
  return out;
}

function lineOf(src: string, index: number): number {
  let line = 1;
  for (let i = 0; i < index && i < src.length; i++) if (src[i] === "\n") line++;
  return line;
}

/** The mobile (unprefixed) font size declared in a class list, if any. */
function baseFontSize(classes: string): number | null {
  let size: number | null = null;
  for (const cls of classes.split(/\s+/)) {
    if (!cls) continue;
    // A responsive variant does not set the mobile size.
    if (/^(sm|md|lg|xl|2xl|min-|max-):/.test(cls)) continue;
    if (cls in FONT_SIZES) {
      size = FONT_SIZES[cls];
      continue;
    }
    const arbitrary = cls.match(/^text-\[(\d+(?:\.\d+)?)px\]$/);
    if (arbitrary) size = parseFloat(arbitrary[1]);
  }
  return size;
}

/** The largest fixed height declared in a class list, in px. */
function fixedHeight(classes: string): number | null {
  let max: number | null = null;
  for (const cls of classes.split(/\s+/)) {
    if (!cls) continue;
    if (/^(sm|md|lg|xl|2xl|min-|max-):/.test(cls)) continue;
    if (cls.startsWith("min-h-")) {
      const v = SPACING[cls.slice("min-h-".length)];
      if (v) max = Math.max(max ?? 0, v);
      continue;
    }
    if (cls.startsWith("h-")) {
      const v = SPACING[cls.slice("h-".length)];
      if (v) max = Math.max(max ?? 0, v);
    }
  }
  return max;
}

function auditFile(file: string, src: string, findings: Finding[]) {
  const rel = path.relative(ROOT, file);
  const at = (index: number) => lineOf(src, index);

  // 1. iOS input font floor.
  for (const tag of ["input", "textarea", "select"]) {
    for (const { body, index } of tagBodies(src, tag)) {
      if (/\btype\s*=\s*["'](hidden|checkbox|radio|submit|button|range|color|file)["']/.test(body)) continue;
      const classes = classStrings(body).join(" ");
      const inline = body.match(/fontSize\s*:\s*(\d+(?:\.\d+)?)/);
      const size = baseFontSize(classes);
      const small =
        (size !== null && size < 16) || (inline && parseFloat(inline[1]) < 16);
      if (small) {
        findings.push({
          rule: "ios-input-font-floor",
          file: rel,
          line: at(index),
          detail: `mobile font-size ${inline ? `${inline[1]}px inline` : `${size}px`} — iOS Safari zooms on focus below 16px`,
        });
      }
    }
  }

  // 2. Grid tracks with a min-content minimum.
  for (const { body, index } of tagBodies(src, "div")) {
    for (const classes of classStrings(body)) {
      const grids = classes.match(/grid-cols-\[([^\]]+)\]/g) ?? [];
      for (const g of grids) {
        const tracks = g.slice("grid-cols-[".length, -1).split(/[,_]/);
        if (tracks.some((t) => /^[\d.]*fr$/.test(t.trim())) && !g.includes("minmax(")) {
          findings.push({
            rule: "grid-1fr-min-content",
            file: rel,
            line: at(index),
            detail: `${g} — bare 1fr has a min-content minimum and overflows at 375px; use minmax(0,1fr)`,
          });
        }
      }
    }
  }

  // 3. Dead links.
  for (const { body, index } of tagBodies(src, "a")) {
    if (/href\s*=\s*(["']#["']|\{`#`\}|\{#\})/.test(body)) {
      findings.push({
        rule: "dead-href",
        file: rel,
        line: at(index),
        detail: "href=\"#\" placeholder — the link goes nowhere",
      });
    }
  }

  // 4. Images without alt text.
  for (const { body, index } of tagBodies(src, "Image")) {
    if (!/\balt\s*=/.test(body)) {
      findings.push({
        rule: "image-missing-alt",
        file: rel,
        line: at(index),
        detail: "<Image> has no alt attribute",
      });
    }
  }

  // 5. Tap targets under 44px.
  for (const tag of ["button", "a"]) {
    for (const { body, index } of tagBodies(src, tag)) {
      if (tag === "a" && !/href\s*=/.test(body)) continue;
      const classes = classStrings(body).join(" ");
      if (!classes) continue;
      const h = fixedHeight(classes);
      if (h !== null && h < 44 && !/min-h-11\b|min-h-\[44px\]/.test(classes)) {
        findings.push({
          rule: "tap-target-under-44",
          file: rel,
          line: at(index),
          detail: `<${tag}> is ${h}px tall — under the 44px minimum touch target`,
        });
      }
    }
  }

  // 6. Hardcoded widths wider than a 375px viewport.
  //    Decorative glows are absolutely positioned and clipped by their
  //    parent's `overflow-hidden`, so a wide box there is intentional.
  for (const { body, index } of tagBodies(src, "div")) {
    for (const classes of classStrings(body)) {
      if (/\b(absolute|fixed)\b/.test(classes) || /blur-/.test(classes)) continue;
      const w = classes.match(/(?<![a-z-])(?:min-)?w-\[\d+px\]/g) ?? [];
      for (const decl of w) {
        const px = parseInt(decl.match(/(\d+)px/)![1], 10);
        if (px >= 400) {
          findings.push({
            rule: "fixed-width-overflow",
            file: rel,
            line: at(index),
            detail: `${decl} — wider than a 375px viewport`,
          });
        }
      }
    }
  }
}

function main() {
  const files = SCAN_DIRS.flatMap((d) => walk(path.join(ROOT, d)));
  const findings: Finding[] = [];
  for (const file of files) {
    const src = fs.readFileSync(file, "utf8");
    auditFile(file, src, findings);
  }

  const byRule = new Map<string, Finding[]>();
  for (const f of findings) {
    if (!byRule.has(f.rule)) byRule.set(f.rule, []);
    byRule.get(f.rule)!.push(f);
  }

  if (!QUIET) {
    for (const [rule, list] of [...byRule.entries()].sort()) {
      console.log(`\n${rule} (${list.length})`);
      for (const f of list) {
        console.log(`  ${f.file}:${f.line}  ${f.detail}`);
      }
    }
  }

  const total = findings.length;
  console.log(
    `\nscanned ${files.length} files — ${total} finding${total === 1 ? "" : "s"} across ${byRule.size} rule${byRule.size === 1 ? "" : "s"}`,
  );
  if (total > 0) {
    console.log("Fix the findings above, or document why each one is acceptable.");
    process.exit(1);
  }
  console.log("No mobile UI findings.");
}

main();
