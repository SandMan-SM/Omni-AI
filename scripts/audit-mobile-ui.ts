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
//   dead-href                `href="#"` is a link that goes nowhere — either
//                            literal, or an expression that can resolve to
//                            "#" (`href={x ?? '#'}`).
//   hydration-window-check  window.matchMedia read during render (behind a
//                            typeof-window guard) — the server and the
//                            phone disagree, so React discards the server
//                            HTML and re-renders the page on the client.
//   display-heading-overflow a display heading with a fixed inline font size
//                            (40px+) never steps down at 375px. A Tailwind
//                            `text-4xl sm:text-6xl` does; `fontSize: 56`
//                            does not.
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
//   form-control-missing-label a form control with no aria-label, no matching
//                            <label htmlFor>, and no wrapping <label>.
//   dead-internal-link        an href that resolves to no route. Next.js
//                            serves the not-found page with a 200 status, so
//                            the break is invisible to a status check.
//
// The accessible-name rules walk the TypeScript AST rather than the source
// text: whether an expression renders text is not decidable with a regex —
// {active ? <Pause/> : <Play/>} renders none while {u.name || u.email}
// renders text, and both look alike in the source.
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

/**
 * Every rule this gate knows about. The summary line reports this count, not
 * the count of rules that happened to fire — a gate that prints "0 findings
 * across 0 rules" reads like a gate that ran nothing. Any rule name used in
 * a finding must appear here, so a typo in a rule name cannot silently
 * disable the check that owns it.
 */
const RULE_NAMES = [
  "ios-input-font-floor",
  "grid-1fr-min-content",
  "dead-href",
  "display-heading-overflow",
  "hydration-window-check",
  "image-missing-alt",
  "tap-target-under-44",
  "fixed-width-overflow",
  "icon-button-missing-name",
  "form-control-missing-label",
  "inline-tap-target-under-44",
  "dead-internal-link",
] as const;
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
 * A JSX element in either of the two shapes the AST gives it.
 *
 * `<input />` parses as a `JsxSelfClosingElement` and `<input></input>` as a
 * `JsxElement`. They are different node kinds, and an earlier version of this
 * gate only walked `JsxElement` — which meant every self-closing control was
 * invisible to the accessible-name rules. Since self-closing is how nearly
 * every `<input />`, `<textarea />` and `<button />` is written, the
 * `form-control-missing-label` rule silently audited almost nothing.
 */
type JsxEl = ts.JsxElement | ts.JsxSelfClosingElement;

/**
 * The two JSX node kinds do not have the same shape: a `JsxElement` wraps
 * its tag in an `openingElement`, a `JsxSelfClosingElement` does not. These
 * adapters are the only place that difference is handled.
 */
function jsxTagName(el: JsxEl, sf: ts.SourceFile): string {
  return ts.isJsxElement(el)
    ? el.openingElement.tagName.getText(sf)
    : el.tagName.getText(sf);
}

/** The attributes of a JSX element, in either node shape. */
function jsxAttrs(el: JsxEl): readonly ts.JsxAttributeLike[] {
  return ts.isJsxElement(el)
    ? el.openingElement.attributes.properties
    : el.attributes.properties;
}

/** The opening tag's source text, for class-name extraction. */
function jsxOpeningText(el: JsxEl): string {
  return ts.isJsxElement(el) ? el.openingElement.getText() : el.getText();
}

/** The children of a JSX element. A self-closing element has none. */
function jsxChildren(el: JsxEl): readonly ts.JsxChild[] {
  return ts.isJsxElement(el) ? el.children : [];
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

/**
 * The accessible name of a form control, or null when it has none. A control
 * is named by an aria-label, by a `<label htmlFor>` pointing at its id, or by
 * being wrapped in a `<label>` element.
 */
function controlAccessibleName(
  el: JsxEl,
  htmlFor: Set<string>,
  wrappedInLabel: boolean,
): string | null {
  let id: string | null = null;
  for (const attr of jsxAttrs(el)) {
    if (!ts.isJsxAttribute(attr)) continue;
    const name = attr.name.text;
    if (name === "aria-label" || name === "aria-labelledby") return name;
    if (name === "id" && attr.initializer) {
      id = attributeValueText(attr.initializer);
    }
  }
  if (id && htmlFor.has(id)) return "label";
  if (wrappedInLabel) return "label";
  return null;
}

/**
 * The value of an attribute initializer, when it is a string literal, a bare
 * identifier, or a template literal.
 *
 * `id="email"` and `id={fieldId}` both name the control. A template literal
 * (`` id={`website-${key}`} ``) names it by a shape that depends on runtime
 * data, but the *source* of two matching attributes is identical, so the
 * template is normalised to its source text and a control's `id` can still be
 * matched to a label's `htmlFor`.
 */
function attributeValueText(initializer: ts.JsxAttributeValue): string | null {
  if (ts.isStringLiteral(initializer)) return initializer.text;
  if (ts.isNoSubstitutionTemplateLiteral(initializer)) return initializer.text;
  if (ts.isJsxExpression(initializer) && initializer.expression) {
    const expr = initializer.expression;
    if (ts.isStringLiteral(expr)) return expr.text;
    if (ts.isIdentifier(expr)) return expr.text;
    if (ts.isNoSubstitutionTemplateLiteral(expr)) return expr.text;
    if (ts.isTemplateExpression(expr)) {
      let out = expr.head.text;
      for (const span of expr.templateSpans) {
        out += `\${${span.expression.getText()}}${span.literal.text}`;
      }
      return out;
    }
  }
  return null;
}

/**
 * True when a control is removed from the accessibility tree and therefore
 * does not need an accessible name.
 *
 * Three ways that happens in this codebase:
 *  - `aria-hidden="true"` — the honeypot pattern (an off-screen field that
 *    traps bot submissions) uses this so a screen reader never reaches it.
 *  - `type="hidden"` — not rendered at all.
 *  - the `hidden` utility class — `display: none`, so the control is not
 *    in the tree. (A responsive variant such as `md:hidden` is NOT exempt:
 *    the control is still visible on smaller viewports.)
 */
function isHiddenFromA11y(el: JsxEl): boolean {
  for (const attr of jsxAttrs(el)) {
    if (!ts.isJsxAttribute(attr)) continue;
    const name = attr.name.text;
    if (name === "aria-hidden" && attr.initializer) {
      const value = attributeValueText(attr.initializer);
      if (value === "true") return true;
    }
    if (name === "type" && attr.initializer) {
      const value = attributeValueText(attr.initializer);
      if (value === "hidden") return true;
    }
    if (name === "className") {
      const classes = classStrings(attr.getText()).join(" ");
      if (classes.split(/\s+/).includes("hidden")) return true;
    }
  }
  return false;
}

/**
 * True when a control spreads its props, so the caller may be the one that
 * names it. The shared `Input` / `Textarea` primitives in `components/ui`
 * forward every prop to the underlying element; their callers pass
 * `aria-label` (or wrap them in a `<FormLabel>`), and the primitive itself
 * cannot know which.
 */
function spreadsProps(el: JsxEl): boolean {
  const attrs = jsxAttrs(el);
  return attrs.some((a) => ts.isJsxSpreadAttribute(a));
}

/** The accessible name of a `<button>` element, or null when it has none. */
function buttonAccessibleName(el: JsxEl): string | null {
  for (const attr of jsxAttrs(el)) {
    if (!ts.isJsxAttribute(attr)) continue;
    const name = attr.name.text;
    if (name === "aria-label" || name === "aria-labelledby") return name;
    if (name === "title" && attr.initializer) return "title";
  }
  const text = buttonVisibleText(el);
  if (text) return text;
  // A visually hidden label also names the button.
  const classes = classStrings(jsxOpeningText(el)).join(" ");
  if (/sr-only/.test(classes)) return "sr-only";
  return null;
}

/**
 * The text a `<button>` renders, or null when it renders nothing but an
 * icon. This is what makes a control icon-only — it is independent of
 * whether the button carries an aria-label.
 */
function buttonVisibleText(el: JsxEl): string | null {
  const text = jsxChildrenText(jsxChildren(el) as ts.NodeArray<ts.JsxChild>);
  if (text) return text;
  // An image with alt text names the button it contains.
  for (const child of jsxChildren(el)) {
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

/**
 * The vertical padding of a `padding` shorthand, in px.
 *
 * `padding: 14` → 28 (all four sides), `padding: "10px 12px"` → 20
 * (top + bottom), `"10px 12px 14px"` → 24, `"10px 12px 14px 16px"` → 24.
 * Returns null when the value is not a plain px shorthand (`%`, `rem`,
 * a CSS variable), because those cannot be resolved to a pixel count.
 */
function styleVerticalPadding(style: string): number | null {
  const match = style.match(
    /(?:^|[,{]\s*)padding\s*:\s*(?:"([^"]*)"|'([^']*)'|([\d.]+))/,
  );
  if (!match) return null;
  const raw = match[1] ?? match[2] ?? match[3];
  if (raw === undefined) return null;

  // Bare number: every side is the same.
  if (/^[\d.]+$/.test(raw)) {
    const n = parseFloat(raw);
    return Number.isFinite(n) ? n * 2 : null;
  }

  const parts = raw.trim().split(/\s+/);
  if (!parts.every(p => /^\d+(?:\.\d+)?px$/.test(p))) return null;
  const nums = parts.map(p => parseFloat(p));
  switch (nums.length) {
    case 1: return nums[0] * 2;
    case 2: return nums[0] * 2;
    case 3: return nums[0] + nums[2];
    case 4: return nums[0] + nums[2];
    default: return null;
  }
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

function auditFile(file: string, src: string, findings: Finding[], routes: string[]) {
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
  //    Two shapes count. A literal `href="#"`, and a conditional href whose
  //    expression can RESOLVE to "#" (`href={lead.linkedin_url ?? '#'}`).
  //    The conditional shape is the one the live audit found and the plain
  //    rule missed — the anchor was disabled with pointer-events, but it was
  //    still in the DOM as a link that goes nowhere.
  for (const { body, index } of tagBodies(code, "a")) {
    if (/href\s*=\s*(["']#["']|\{`#`\}|\{#\})/.test(body)) {
      findings.push({
        rule: "dead-href",
        file: rel,
        line: at(index),
        detail: "href=\"#\" placeholder — the link goes nowhere",
      });
      continue;
    }
    const expr = body.match(/href\s*=\s*\{([\s\S]*?)\}/);
    if (!expr) continue;
    const value = expr[1];
    const fallsBackToHash =
      /(\?\?|\|\|)\s*['"`]#['"`]/.test(value) || /:\s*['"`]#['"`]/.test(value);
    if (fallsBackToHash) {
      findings.push({
        rule: "dead-href",
        file: rel,
        line: at(index),
        detail: `href can resolve to "#" (${value.replace(/\s+/g, " ").trim().slice(0, 60)}) — render a disabled element instead of an anchor`,
      });
    }
  }

  // 4. Display headings with a fixed inline font size.
  //    A Tailwind `text-4xl sm:text-6xl` steps down on a phone; an inline
  //    `fontSize: 56` does not. A fixed 40px+ display heading overflows a
  //    375px viewport as soon as the headline runs longer than a few words.
  //    OG/Twitter image canvases are 1200×630 by definition, so they are
  //    exempt — they are never rendered in a viewport.
  if (!/opengraph-image|twitter-image/.test(rel)) {
    for (const tag of ["h1", "h2"]) {
      for (const { body, index } of tagBodies(code, tag)) {
        if (/fontSize\s*:\s*['"]?clamp\(/.test(body)) continue;
        const size = body.match(/fontSize\s*:\s*['"]?(\d+(?:\.\d+)?)/);
        if (!size) continue;
        const px = parseFloat(size[1]);
        if (px < 40) continue;
        findings.push({
          rule: "display-heading-overflow",
          file: rel,
          line: at(index),
          detail: `<${tag}> has a fixed inline fontSize of ${px}px — it does not step down at 375px; use clamp() or a responsive class`,
        });
      }
    }
  }

  // 5. Render-time browser detection.
  //    `typeof window !== "undefined" && window.matchMedia(...)` is how a
  //    component asks "am I on a touch device?" — but if it is evaluated
  //    during render, the server answers false and the phone answers true.
  //    The server HTML and the first client render then disagree about
  //    which buttons exist, React reports a hydration mismatch, and the
  //    whole page is thrown away and re-rendered on the client. The
  //    `typeof window` guard is itself the tell: inside a useEffect it is
  //    redundant, because effects only ever run in the browser.
  {
    const re =
      /typeof window\s*!==\s*["']undefined["'][\s\S]{0,240}?window\.matchMedia|window\.matchMedia[\s\S]{0,240}?typeof window\s*!==\s*["']undefined["']/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(code))) {
      findings.push({
        rule: "hydration-window-check",
        file: rel,
        line: at(m.index),
        detail: "window.matchMedia is read with a typeof-window guard — if this runs during render the server and the phone disagree (hydration mismatch); move it into a useEffect",
      });
    }
  }

  // 6. Images without alt text.
  //
  // Both `<Image>` and a raw `<img>` count. The raw one is the interesting
  // case: it is the escape hatch people reach for when next/image would
  // need a domain allowlisted, so it is exactly where an alt attribute
  // gets forgotten — and a screen reader then announces the file name.
  // `alt=""` is accepted: a decorative image is correctly marked by an
  // EMPTY alt, not by an absent one.
  for (const tag of ["Image", "img"]) {
    for (const { body, index } of tagBodies(code, tag)) {
      if (!/\balt\s*=/.test(body)) {
        findings.push({
          rule: "image-missing-alt",
          file: rel,
          line: at(index),
          detail: `<${tag}> has no alt attribute`,
        });
      }
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

  // Every `htmlFor` in the file, so a control's id can be matched to its label.
  // Both a literal (`htmlFor="email"`) and an identifier (`htmlFor={fieldId}`)
  // are collected, so `id={fieldId}` on the control matches `htmlFor={fieldId}`
  // on the label. A template literal names the control by a shape no static
  // check can resolve, so it is not collected and the control falls back to
  // its other naming mechanisms.
  const htmlFor = new Set<string>();
  const collectHtmlFor = (node: ts.Node) => {
    if (ts.isJsxAttribute(node) && node.name.text === "htmlFor" && node.initializer) {
      const value = attributeValueText(node.initializer);
      if (value) htmlFor.add(value);
    }
    ts.forEachChild(node, collectHtmlFor);
  };
  collectHtmlFor(sf);

  const visit = (node: ts.Node, inLabel: boolean, inComponent: boolean) => {
    // Both JSX shapes must be visited: `<input />` is a self-closing
    // element and is a different AST node kind from `<input></input>`.
    const el: JsxEl | null = ts.isJsxElement(node)
      ? node
      : ts.isJsxSelfClosingElement(node)
        ? node
        : null;
    if (el) {
      const tag = jsxTagName(el, sf);
      if (tag === "button") {
        const start = el.getStart(sf);
        if (buttonVisibleText(el) === null) iconOnlyButtons.add(start);
        if (buttonAccessibleName(el) === null) {
          findings.push({
            rule: "icon-button-missing-name",
            file: rel,
            line: sf.getLineAndCharacterOfPosition(start).line + 1,
            detail:
              "<button> renders only an icon and has no aria-label / sr-only text — a screen reader announces it as an unnamed button",
          });
        }
      }
      if (tag === "input" || tag === "textarea" || tag === "select") {
        let type = "";
        for (const attr of jsxAttrs(el)) {
          if (!ts.isJsxAttribute(attr)) continue;
          if (attr.name.text === "type" && attr.initializer && ts.isStringLiteral(attr.initializer)) {
            type = attr.initializer.text;
          }
        }
        const notNameable = ["hidden", "checkbox", "radio", "submit", "button", "range", "color", "file"];
        if (!notNameable.includes(type)) {
          // A control passed to a custom component may be wrapped in a label
          // by that component's own markup, which this file cannot see.
          if (
            !inComponent &&
            !isHiddenFromA11y(el) &&
            !spreadsProps(el) &&
            controlAccessibleName(el, htmlFor, inLabel) === null
          ) {
            findings.push({
              rule: "form-control-missing-label",
              file: rel,
              line: sf.getLineAndCharacterOfPosition(el.getStart(sf)).line + 1,
              detail: `<${tag}> has no aria-label, no matching <label htmlFor>, and no wrapping <label>`,
            });
          }
        }
      }
    }
    const isLabel = !!el && jsxTagName(el, sf) === "label";
    const nextInLabel = inLabel || isLabel;
    // A capitalised tag is a React component, not an HTML element.
    const isComponent = !!el && /^[A-Z]/.test(jsxTagName(el, sf));
    const nextInComponent = inComponent || isComponent;
    ts.forEachChild(node, (child) => visit(child, nextInLabel, nextInComponent));
  };
  visit(sf, false, false);

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
    let fontSize: number | null = null;
    let verticalPadding: number | null = null;
    for (const ref of refs) {
      const obj = styleObjects.get(ref);
      if (!obj) continue;
      height = stylePx(obj, "height") ?? height;
      minHeight = stylePx(obj, "minHeight") ?? minHeight;
      padding = stylePx(obj, "padding") ?? stylePx(obj, "paddingTop") ?? padding;
      fontSize = stylePx(obj, "fontSize") ?? fontSize;
      verticalPadding = styleVerticalPadding(obj) ?? verticalPadding;
    }
    // Keys set inline alongside the spread win over the shared object.
    height = stylePx(inline, "height") ?? height;
    minHeight = stylePx(inline, "minHeight") ?? minHeight;
    padding = stylePx(inline, "padding") ?? stylePx(inline, "paddingTop") ?? padding;
    fontSize = stylePx(inline, "fontSize") ?? fontSize;
    verticalPadding = styleVerticalPadding(inline) ?? verticalPadding;

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

    // A text button with a known font size and known vertical padding has a
    // computable rendered height: the text's line box (font-size × 1.2 for
    // the UA default line-height) plus the padding above and below it. This
    // is the case the icon-only heuristic above cannot see — a
    // `padding: '10px 12px'` + `fontSize: 12` button renders ~34px tall and
    // is a legal 44px target only if the author said so.
    //
    // It applies to text-only buttons: a child component (an icon) adds its
    // own box, and the rendered height is then not the text's line box.
    if (declared === null && fontSize !== null && verticalPadding !== null) {
      const start = code.indexOf("<button", index);
      const body = start >= 0 ? code.slice(start, code.indexOf(">", start) + 1) : "";
      const hasIconChild = /<[A-Z][A-Za-z0-9]*[\s/>]/.test(body);
      const rendered = Math.round(fontSize * 1.2 + verticalPadding);
      if (!hasIconChild && rendered < 44) {
        findings.push({
          rule: "inline-tap-target-under-44",
          file: rel,
          line: at(index),
          detail: `<button> renders ~${rendered}px tall (${fontSize}px text + ${verticalPadding}px padding) — under the 44px minimum touch target`,
        });
      }
    }
  }

  // 9. Internal links that resolve to nothing.
  //    Next.js serves the not-found page with a 200 status, so a link to a
  //    route that does not exist is invisible to a status check and to the
  //    build — it only shows up as a customer staring at "Not Found".
  //
  //    Only paths with two or more segments are checked. The root route
  //    `/[slug]` is the daily landing page, which is backed by a database
  //    row rather than the filesystem, so a single-segment path may be a
  //    valid landing page or a typo — a static check cannot tell them apart.
  const linkRe = /(?:href|redirect)\s*=\s*\{\s*["'`]([^"'`]+)["'`]/g;
  const linkRe2 = /(?:href|redirect)\s*=\s*["'`]([^"'`]+)["'`]/g;
  const seenLinks = new Set<string>();
  for (const re of [linkRe, linkRe2]) {
    let m: RegExpExecArray | null;
    while ((m = re.exec(code))) {
      const raw = m[1];
      if (!raw.startsWith("/")) continue;
      if (raw.includes("{")) continue; // built at runtime
      const href = raw.split("#")[0].split("?")[0];
      if (!href || seenLinks.has(href)) continue;
      seenLinks.add(href);
      const normalized = href.length > 1 ? href.replace(/\/$/, "") : href;
      if (normalized.split("/").filter(Boolean).length < 2) continue;
      if (routes.some((r) => routeMatches(r, normalized))) continue;
      if (isStaticFile(ROOT, normalized)) continue;
      findings.push({
        rule: "dead-internal-link",
        file: rel,
        line: at(m.index),
        detail: `"${raw}" does not resolve to any route — Next.js serves the not-found page with a 200 status, so this looks like a working link`,
      });
    }
  }
}

/**
 * Every route the app serves, as path patterns. Route groups — `(group)` —
 * do not appear in the URL, so they are dropped; dynamic segments stay as
 * `[param]` so a link can be matched against them.
 */
function buildRouteTable(root: string): string[] {
  const patterns: string[] = [];
  const walkRoutes = (dir: string, prefix: string) => {
    if (!fs.existsSync(dir)) return;
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (entry.name.startsWith("(") && entry.name.endsWith(")")) walkRoutes(full, prefix);
        else walkRoutes(full, `${prefix}/${entry.name}`);
      } else if (/^(page|route)\.(tsx|ts|jsx|js)$/.test(entry.name)) {
        patterns.push(prefix === "" ? "/" : prefix);
      }
    }
  };
  walkRoutes(path.join(root, "app"), "");
  return patterns;
}

/** Whether a URL path is served by a route pattern. */
function routeMatches(pattern: string, href: string): boolean {
  if (pattern === href) return true;
  const p = pattern.split("/").filter(Boolean);
  const h = href.split("/").filter(Boolean);
  for (let i = 0; i < p.length; i++) {
    const seg = p[i];
    if (seg.startsWith("[...")) return h.length >= i; // catch-all
    if (i >= h.length) return false;
    if (seg.startsWith("[")) continue; // dynamic segment matches anything
    if (seg !== h[i]) return false;
  }
  return p.length === h.length;
}

/**
 * A path that resolves to a file rather than a route — a static asset in
 * public/, or a metadata file served straight out of app/.
 */
function isStaticFile(root: string, href: string): boolean {
  const rel = href.replace(/^\//, "");
  if (fs.existsSync(path.join(root, "public", rel))) return true;
  if (fs.existsSync(path.join(root, "app", rel))) return true;
  return false;
}

function main() {
  const files = SCAN_DIRS.flatMap((d) => walk(path.join(ROOT, d)));
  const findings: Finding[] = [];
  const routes = buildRouteTable(ROOT);
  for (const file of files) {
    const src = fs.readFileSync(file, "utf8");
    auditFile(file, src, findings, routes);
  }

  const byRule = new Map<string, Finding[]>();
  for (const f of findings) {
    if (!byRule.has(f.rule)) byRule.set(f.rule, []);
    byRule.get(f.rule)!.push(f);
  }

  const unknownRules = [...byRule.keys()].filter(
    (rule) => !(RULE_NAMES as readonly string[]).includes(rule),
  );
  if (unknownRules.length > 0) {
    console.error(
      `audit-mobile-ui: unknown rule name(s): ${unknownRules.join(", ")} — a rule that reports under a name not in RULE_NAMES is not being counted`,
    );
    process.exit(1);
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
    `\nscanned ${files.length} files — ${total} finding${total === 1 ? "" : "s"} across ${RULE_NAMES.length} rule${RULE_NAMES.length === 1 ? "" : "s"}`,
  );
  if (total > 0) {
    console.log("Fix the findings above, or document why each one is acceptable.");
    process.exit(1);
  }
  console.log("No mobile UI findings.");
}

main();
