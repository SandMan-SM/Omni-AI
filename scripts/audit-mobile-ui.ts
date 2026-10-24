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
//   icon-button-missing-name an icon-only <button> with no accessible name.
//                            A screen reader announces it as "button", so the
//                            control is unusable without sight of the icon.
//   inline-tap-target-under-44 a <button> sized by an inline `style` object
//                            whose height lands under 44px. The Tailwind tap
//                            rule can only see class names, so every
//                            inline-styled button was invisible to it.
//
// Read-only. It never writes a file and never touches the network.
//
//   npx tsx scripts/audit-mobile-ui.ts            # report, exit 1 on findings
//   npx tsx scripts/audit-mobile-ui.ts --quiet    # summary only
//
// Exits 0 when clean so it can be wired into a pre-ship check.

import * as fs from "fs";
import * as path from "path";
import * as ts from "typescript";

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

/**
 * Blanks out comments, preserving every byte offset and newline, so a
 * `<button` mentioned in a doc comment is not parsed as a real element.
 */
function stripComments(src: string): string {
  let out = src;
  // Block comments.
  out = out.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, " "));
  // Line comments (// to end of line), but not `://` inside a URL string.
  out = out.replace(/(^|[^:"'`\\])\/\/[^\n]*/g, (m, p1) => p1 + m.slice(p1.length).replace(/[^\n]/g, " "));
  return out;
}

/**
 * The inner content of a JSX element, matching nested tags of the same name.
 * Returns undefined when the element is never closed.
 */
function innerOf(src: string, openTagEnd: number, tag: string): string | undefined {
  const re = new RegExp(`<${tag}\\b|</${tag}>`, "g");
  re.lastIndex = openTagEnd;
  let depth = 1;
  let m: RegExpExecArray | null;
  while ((m = re.exec(src))) {
    if (m[0] === `</${tag}>`) {
      depth--;
      if (depth === 0) return src.slice(openTagEnd, m.index);
    } else {
      depth++;
    }
  }
  return undefined;
}

/**
 * The accessible name of a JSX element, following the shape of the
 * accessible-name computation: explicit labels first, then descendant text.
 *
 * This walks the TypeScript AST rather than the raw text, because the text
 * form of a name is not decidable with a regex — `{active ? <Pause/> : <Play/>}`
 * renders no text while `{u.name || u.email}` renders text, and both look
 * alike in the source.
 */
function jsxText(node: ts.Node): string | null {
  if (ts.isJsxText(node)) {
    const t = node.text.trim();
    return t.length ? t : null;
  }
  if (ts.isJsxExpression(node)) {
    return node.expression ? jsxExprText(node.expression) : null;
  }
  if (ts.isJsxElement(node)) {
    return jsxChildrenText(node.children);
  }
  if (ts.isJsxFragment(node)) {
    return jsxChildrenText(node.children);
  }
  return null;
}

function jsxChildrenText(children: ts.NodeArray<ts.JsxChild> | ts.NodeArray<ts.JsxChild>): string | null {
  for (const child of children) {
    const t = jsxText(child);
    if (t) return t;
  }
  return null;
}

/** The text an expression renders, if any. */
function jsxExprText(expr: ts.Expression): string | null {
  if (ts.isStringLiteral(expr) || ts.isNoSubstitutionTemplateLiteral(expr)) return expr.text;
  if (ts.isNumericLiteral(expr)) return String(expr.text);
  if (ts.isIdentifier(expr)) return expr.text;
  if (ts.isPropertyAccessExpression(expr) || ts.isElementAccessExpression(expr)) return expr.getText();
  if (ts.isNonNullExpression(expr)) return jsxExprText(expr.expression);
  if (ts.isParenthesizedExpression(expr)) return jsxExprText(expr.expression);
  if (ts.isConditionalExpression(expr)) {
    return jsxExprText(expr.whenTrue) ?? jsxExprText(expr.whenFalse);
  }
  if (ts.isBinaryExpression(expr)) {
    // `a || b` and `a ?? b` render whichever side is truthy; `a && b`
    // renders only `b`.
    const kind = expr.operatorToken.kind;
    if (kind === ts.SyntaxKind.BarBarToken || kind === ts.SyntaxKind.QuestionQuestionToken) {
      return jsxExprText(expr.left) ?? jsxExprText(expr.right);
    }
    if (kind === ts.SyntaxKind.AmpersandAmpersandToken) {
      return jsxExprText(expr.right);
    }
    // String concatenation renders text.
    if (kind === ts.SyntaxKind.PlusToken) {
      return jsxExprText(expr.left) ?? jsxExprText(expr.right);
    }
    return null;
  }
  if (ts.isJsxElement(expr) || ts.isJsxFragment(expr)) return jsxText(expr);
  if (ts.isCallExpression(expr)) {
    // Array methods return a list of elements, not text.
    if (ts.isPropertyAccessExpression(expr.expression)) {
      const name = expr.expression.name.text;
      if (["map", "filter", "forEach", "reduce", "flatMap", "some", "every"].includes(name)) {
        return null;
      }
    }
    // Anything else — a formatter, a string method — renders its return value.
    return expr.getText();
  }
  return null;
}

/** The accessible name of a `<button>` element, or null when it has none. */
function buttonAccessibleName(el: ts.JsxElement): string | null {
  for (const attr of el.openingElement.attributes.properties) {
    if (!ts.isJsxAttribute(attr)) continue;
    const name = attr.name.text;
    if (name === "aria-label" || name === "aria-labelledby") return name;
    if (name === "title" && attr.initializer) return "title";
  }
  const text = buttonVisibleText(el);
  if (text) return text;
  // A visually hidden label also names the button.
  const classes = classStrings(el.openingElement.getText()).join(" ");
  if (/sr-only/.test(classes)) return "sr-only";
  return null;
}

/**
 * The text a `<button>` renders, or null when it renders nothing but an
 * icon. This is what makes a control icon-only — it is independent of
 * whether the button carries an aria-label.
 */
function buttonVisibleText(el: ts.JsxElement): string | null {
  const text = jsxChildrenText(el.children);
  if (text) return text;
  // An image with alt text names the button it contains.
  for (const child of el.children) {
    if (!ts.isJsxElement(child)) continue;
    const tag = child.openingElement.tagName.getText();
    if (tag !== "img" && tag !== "Image") continue;
    for (const attr of child.openingElement.attributes.properties) {
      if (ts.isJsxAttribute(attr) && attr.name.text === "alt") return "alt";
    }
  }
  return null;
}

/**
 * Local `const NAME = { ... }` style objects, so a `style={iconBtn}` on a
 * button can be resolved to the padding/height it actually applies.
 */
function localStyleObjects(src: string): Map<string, string> {
  const out = new Map<string, string>();
  const re = /const\s+([A-Za-z_$][\w$]*)\s*(?::\s*React\.CSSProperties\s*)?=\s*\{/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(src))) {
    let i = m.index + m[0].length;
    let depth = 1;
    for (; i < src.length; i++) {
      if (src[i] === "{") depth++;
      else if (src[i] === "}") {
        depth--;
        if (depth === 0) break;
      }
    }
    out.set(m[1], src.slice(m.index + m[0].length, i));
  }
  return out;
}

/** A numeric px value for a style key, if the style object sets one. */
function stylePx(style: string, key: string): number | null {
  // Bare number: `padding: 8`
  const bare = style.match(new RegExp(`(?:^|[,{]\\s*)${key}\\s*:\\s*(\\d+(?:\\.\\d+)?)`));
  if (bare) return parseFloat(bare[1]);
  // Quoted px value: `padding: "8px 10px"`
  const quoted = style.match(
    new RegExp(`(?:^|[,{]\\s*)${key}\\s*:\\s*["'\`](\\d+(?:\\.\\d+)?)px`),
  );
  return quoted ? parseFloat(quoted[1]) : null;
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
  // Comments are blanked (offsets preserved) so a `<button` in a doc comment
  // is not mistaken for a real element.
  const code = stripComments(src);

  // 1. iOS input font floor.
  for (const tag of ["input", "textarea", "select"]) {
    for (const { body, index } of tagBodies(code, tag)) {
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
  for (const { body, index } of tagBodies(code, "div")) {
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
  for (const { body, index } of tagBodies(code, "a")) {
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
  for (const { body, index } of tagBodies(code, "Image")) {
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
    for (const { body, index } of tagBodies(code, tag)) {
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
  for (const { body, index } of tagBodies(code, "div")) {
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

  // 7. Icon-only buttons with no accessible name.
  //    A button whose only content is an icon is announced as "button" by a
  //    screen reader unless it carries an aria-label (or sr-only text), which
  //    makes the control unusable without sight of the glyph.
  const sf = ts.createSourceFile(file, src, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  /** Start offsets of buttons whose only content is an icon (no text at all). */
  const iconOnlyButtons = new Set<number>();
  const visit = (node: ts.Node) => {
    if (ts.isJsxElement(node)) {
      const tag = node.openingElement.tagName.getText(sf);
      if (tag === "button") {
        const start = node.getStart(sf);
        if (buttonVisibleText(node) === null) iconOnlyButtons.add(start);
        if (buttonAccessibleName(node) === null) {
          findings.push({
            rule: "icon-button-missing-name",
            file: rel,
            line: sf.getLineAndCharacterOfPosition(start).line + 1,
            detail:
              "<button> renders only an icon and has no aria-label / sr-only text — a screen reader announces it as an unnamed button",
          });
        }
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(sf);

  // 8. Tap targets under 44px that are sized by an inline style.
  //    The Tailwind rule above only sees class names, so a button styled by a
  //    `style={iconBtn}` object (dashboard surfaces) was invisible to it.
  const styleObjects = localStyleObjects(code);
  for (const { body, index } of tagBodies(code, "button")) {
    const classes = classStrings(body).join(" ");
    if (/\bh-11\b|\bh-12\b|\bmin-h-11\b|\bmin-h-\[44px\]/.test(classes)) continue;
    const styleMatch = body.match(/\bstyle\s*=/);
    if (!styleMatch) continue;
    // Collect every style object referenced by this button: `style={{ ...a }}`,
    // `style={a}`, `style={{ ...a, color: '#fff' }}`.
    const refs = new Set<string>();
    const inline = body.slice(styleMatch.index);
    const spreadRe = /\.\.\.([A-Za-z_$][\w$]*)/g;
    let m: RegExpExecArray | null;
    while ((m = spreadRe.exec(inline))) refs.add(m[1]);
    const direct = inline.match(/style\s*=\s*\{\{?\s*([A-Za-z_$][\w$]*)\s*[,}]/);
    if (direct) refs.add(direct[1]);

    let height: number | null = null;
    let minHeight: number | null = null;
    let padding: number | null = null;
    for (const ref of refs) {
      const obj = styleObjects.get(ref);
      if (!obj) continue;
      height = stylePx(obj, "height") ?? height;
      minHeight = stylePx(obj, "minHeight") ?? minHeight;
      padding = stylePx(obj, "padding") ?? stylePx(obj, "paddingTop") ?? padding;
    }
    // Keys set inline alongside the spread win over the shared object.
    height = stylePx(inline, "height") ?? height;
    minHeight = stylePx(inline, "minHeight") ?? minHeight;
    padding = stylePx(inline, "padding") ?? stylePx(inline, "paddingTop") ?? padding;

    // A full-width button is a large target whatever its height — the 44px
    // rule is about small square icon buttons, not wide CTA rows.
    if (/width\s*:\s*["']?100%/.test(inline)) continue;
    const styleWidth = stylePx(inline, "width");
    if (styleWidth !== null && styleWidth >= 44) continue;
    const declared = height ?? minHeight;
    if (declared !== null && declared < 44) {
      findings.push({
        rule: "inline-tap-target-under-44",
        file: rel,
        line: at(index),
        detail: `<button> is ${declared}px tall via an inline style — under the 44px minimum touch target`,
      });
      continue;
    }
    // No explicit height. The rendered height is padding*2 + the content, and
    // the content height is only knowable when the button renders nothing but
    // an icon — a text button's line box can be tall enough on its own. So the
    // padding heuristic is applied to icon-only buttons only, and only below
    // 12px of padding, where even a 20px glyph cannot reach 44px.
    if (declared === null && padding !== null && padding < 12) {
      const start = code.indexOf("<button", index);
      if (start >= 0 && iconOnlyButtons.has(start)) {
        findings.push({
          rule: "inline-tap-target-under-44",
          file: rel,
          line: at(index),
          detail: `<button> renders only an icon with ${padding}px inline padding — under the 44px minimum touch target`,
        });
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
