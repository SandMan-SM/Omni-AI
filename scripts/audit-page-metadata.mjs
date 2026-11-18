#!/usr/bin/env node
/**
 * audit:page-metadata — every page must ship a title and a description.
 *
 * WHY THIS GATE EXISTS
 *
 * CLAUDE.md says "every page exports `metadata` (title + description)" and
 * AGENT_MEMORY.md carries it as a running "Next" item — "apply the
 * seo-metadata-factory to any NEW route as it is created". Both are PROSE.
 * A new page that forgets its metadata compiles, builds, deploys, renders
 * (the browser tab shows the raw path), and is crawled with no description:
 * nothing in the toolchain objects.
 *
 * This is the same shape as the sitemap-parity defect that session 60
 * found: a rule that lives in a sentence, and a control that would have
 * caught the sentence being broken. The difference is that there the rule
 * was about a CONTRACT between two artifacts; here it is about a single
 * artifact carrying the fields a crawler and a human reader need.
 *
 * RULES
 *
 *   1. page-without-metadata
 *      A page whose segment chain declares no `metadata` and no
 *      `generateMetadata` — neither in the page itself nor in any layout
 *      above it (Next.js merges metadata down the layout chain, so a
 *      layout's title and description apply to every page beneath it).
 *
 *   2. page-metadata-without-title-or-description
 *      A page that declares its OWN metadata as an object LITERAL without
 *      both a `title` and a `description` key. A metadata value built by a
 *      factory call (`buildMetadata({...})`, `legacyBrandMetadata()`) is
 *      exempt: the factory owns the shape, and this gate cannot read
 *      through a call. Only a literal is judged.
 *
 * SCOPE
 *
 *   Every `page.tsx` under `app/`. Route handlers, OG images and API routes
 *   are not pages and are not crawled for a title.
 *
 * FAILS CLOSED
 *
 *   If the tree cannot be walked, the gate reports what it could not read
 *   rather than printing "no findings".
 */

import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const ROOT = process.cwd();
const APP_DIR = "app";

const METADATA_EXPORT = /export\s+(?:const|let|var)\s+(metadata|generateMetadata)\b/;
const METADATA_FUNCTION = /export\s+(?:async\s+)?function\s+(metadata|generateMetadata)\b/;
const METADATA_REEXPORT = /export\s*\{[^}]*\b(metadata|generateMetadata)\b[^}]*\}/;

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
    } else if (entry === "page.tsx") {
      out.push(full);
    }
  }
  return out;
}

function readFile(file) {
  try {
    return readFileSync(file, "utf8");
  } catch {
    return null;
  }
}

/**
 * The metadata declaration in a file, if it has one.
 *
 * Returns { kind: "export" | "literal" | "factory", body } — `kind` says
 * whether the value is an object literal (which this gate can read) or
 * something built by a call (which it cannot).
 */
export function metadataDeclaration(source) {
  if (source === null) return null;

  // A function declaration or a re-export has no object to read.
  if (METADATA_FUNCTION.test(source) || METADATA_REEXPORT.test(source)) {
    return { kind: "export", body: null };
  }

  const constMatch = source.match(METADATA_EXPORT);
  if (!constMatch) return null;

  const after = source.slice(constMatch.index);
  const braceAt = after.indexOf("{");
  const callAt = after.search(/=\s*[A-Za-z_$]/);
  if (braceAt === -1 || (callAt !== -1 && callAt < braceAt)) {
    // The value is built by something other than an object literal.
    return { kind: "factory", body: null };
  }

  // Read the literal: brace-count from the first brace.
  let depth = 0;
  let end = braceAt;
  for (; end < after.length; end += 1) {
    const ch = after[end];
    if (ch === "{") depth += 1;
    else if (ch === "}") {
      depth -= 1;
      if (depth === 0) break;
    }
  }
  return { kind: "literal", body: after.slice(braceAt, end + 1) };
}

/**
 * Every page in a tree, and whether its segment chain declares metadata.
 */
export function scanPages(root, appDir = APP_DIR) {
  const appPath = path.join(root, appDir);
  const pages = walk(appPath);
  const findings = [];
  let withMetadata = 0;

  for (const page of pages) {
    const pageRelative = path.relative(root, page);

    // Walk the segment chain: the page's own directory, then every
    // directory above it, looking for a metadata export in the page or in
    // any layout.
    let dir = path.dirname(page);
    let declared = false;
    let own = null;

    for (;;) {
      const pageFile = path.join(dir, "page.tsx");
      const layoutFile = path.join(dir, "layout.tsx");

      if (path.resolve(pageFile) === path.resolve(page)) {
        own = metadataDeclaration(readFile(pageFile));
      }
      const layout = metadataDeclaration(readFile(layoutFile));
      if (own || layout) {
        declared = true;
        break;
      }

      const up = path.dirname(dir);
      if (up === dir || !up.startsWith(appPath)) break;
      dir = up;
    }

    if (declared) withMetadata += 1;
    else {
      findings.push({
        file: pageRelative,
        line: 1,
        rule: "page-without-metadata",
        detail:
          "this page declares no `metadata` and no `generateMetadata`, and no layout above it does either — " +
          "so it ships with no title and no description.",
      });
      continue;
    }

    if (own && own.kind === "literal") {
      const hasTitle = /\btitle\s*:/.test(own.body);
      const hasDescription = /\bdescription\s*:/.test(own.body);
      if (!hasTitle || !hasDescription) {
        const missing = [hasTitle ? null : "title", hasDescription ? null : "description"].filter(Boolean);
        findings.push({
          file: pageRelative,
          line: 1,
          rule: "page-metadata-without-title-or-description",
          detail:
            `this page declares its own metadata object without ${missing.join(" and ")} — ` +
            "build it with the metadata factory so the canonical, OG and Twitter fields come with it.",
        });
      }
    }
  }

  return { pages: pages.length, withMetadata, findings };
}

// ── Run ─────────────────────────────────────────────────────────────────────

const invokedDirectly =
  process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (invokedDirectly) {
  if (!existsSync(path.join(ROOT, APP_DIR))) {
    console.error(`[page-metadata] ${APP_DIR}/ does not exist — the result is UNKNOWN.`);
    process.exit(2);
  }

  const report = scanPages(ROOT, APP_DIR);

  for (const f of report.findings) {
    console.error(`[page-metadata] ${f.file}:${f.line} — ${f.rule}`);
    console.error(`    ${f.detail}`);
  }

  console.log(
    `[page-metadata] examined ${report.pages} page(s); ${report.withMetadata} declare metadata in their ` +
      `segment chain; ${report.findings.length} finding(s) across 2 rules.`,
  );

  if (report.findings.length > 0) {
    console.error("[page-metadata] FAILED — a page ships without a title or a description.");
    process.exit(1);
  }
  console.log("[page-metadata] no findings — every page ships a title and a description.");
}
