#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";
import { execFileSync } from "node:child_process";

const postsJson = JSON.parse(
  fs.readFileSync(new URL("../lib/newsletter-fallback.generated.json", import.meta.url), "utf8")
);

const OUT_DIR = path.resolve("public/newsletter/generated");
const WIDTH = 1200;
const HEIGHT = 630;

const CLIENT_NICHE_SLUG_PREFIXES = [
  "ltb-",
  "prime_iv-",
  "prime-iv-",
  "youngs-",
  "leifson-",
  "otd-",
  "cps-",
  "imperium-",
  "alira-",
];

const OMNI_TOKENS = [
  "ai",
  "agent",
  "automation",
  "interlinked",
  "omni",
  "operator",
  "revenue",
  "business",
  "model",
  "openai",
  "anthropic",
  "nvidia",
  "microsoft",
  "salesforce",
  "google",
  "cursor",
  "saas",
];

function isOmniAiPost(post) {
  const slug = String(post.slug || "").toLowerCase();
  if (!slug || CLIENT_NICHE_SLUG_PREFIXES.some((prefix) => slug.startsWith(prefix))) return false;
  const haystack = `${slug} ${post.subject || ""} ${post.intro || ""} ${(post.keywords || []).join(" ")}`.toLowerCase();
  return OMNI_TOKENS.some((token) => haystack.includes(token));
}

function hashString(input) {
  let h = 2166136261;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function mulberry32(seed) {
  return function rand() {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function clamp(v) {
  return Math.max(0, Math.min(255, Math.round(v)));
}

function mix(a, b, t) {
  return a + (b - a) * t;
}

function smoothstep(edge0, edge1, x) {
  const t = Math.max(0, Math.min(1, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

function addGlow(rgb, x, y, cx, cy, radius, color, strength) {
  const d = Math.hypot(x - cx, y - cy) / radius;
  const t = Math.max(0, 1 - d);
  const falloff = t * t * strength;
  rgb[0] += color[0] * falloff;
  rgb[1] += color[1] * falloff;
  rgb[2] += color[2] * falloff;
}

function addPixel(raw, x, y, color, alpha = 1) {
  if (x < 0 || y < 0 || x >= WIDTH || y >= HEIGHT) return;
  const i = y * (WIDTH * 3 + 1) + 1 + x * 3;
  raw[i] = clamp(mix(raw[i], color[0], alpha));
  raw[i + 1] = clamp(mix(raw[i + 1], color[1], alpha));
  raw[i + 2] = clamp(mix(raw[i + 2], color[2], alpha));
}

function drawLine(raw, x0, y0, x1, y1, color, alpha = 1, width = 1) {
  const dx = x1 - x0;
  const dy = y1 - y0;
  const steps = Math.max(Math.abs(dx), Math.abs(dy));
  for (let s = 0; s <= steps; s++) {
    const x = Math.round(x0 + (dx * s) / steps);
    const y = Math.round(y0 + (dy * s) / steps);
    for (let oy = -width; oy <= width; oy++) {
      for (let ox = -width; ox <= width; ox++) {
        const falloff = 1 - Math.min(1, Math.hypot(ox, oy) / (width + 1));
        addPixel(raw, x + ox, y + oy, color, alpha * falloff);
      }
    }
  }
}

function drawCircle(raw, cx, cy, radius, color, alpha = 1) {
  const r2 = radius * radius;
  for (let y = Math.floor(cy - radius); y <= Math.ceil(cy + radius); y++) {
    for (let x = Math.floor(cx - radius); x <= Math.ceil(cx + radius); x++) {
      const d2 = (x - cx) ** 2 + (y - cy) ** 2;
      if (d2 <= r2) {
        const falloff = 1 - Math.sqrt(d2) / radius;
        addPixel(raw, x, y, color, alpha * (0.35 + falloff * 0.65));
      }
    }
  }
}

function drawBackground(post, outputBase) {
  const seed = hashString(`${post.slug}|${post.subject}|${(post.keywords || []).join(",")}`);
  const rand = mulberry32(seed);
  const raw = Buffer.alloc((WIDTH * 3 + 1) * HEIGHT);
  const subject = `${post.subject || ""} ${(post.keywords || []).join(" ")}`.toLowerCase();
  const style =
    /eye|vision|watch|monitor|see|ceo/.test(subject) ? "vision" :
    /data|model|clean|network|agent|openai|anthropic|nvidia|google|microsoft/.test(subject) ? "neural" :
    /revenue|sales|linkedin|competitor|operator|business/.test(subject) ? "energy" :
    "aqua";
  const palette =
    style === "energy" ? [[255, 184, 70], [255, 94, 92], [103, 206, 255]] :
    style === "vision" ? [[37, 209, 255], [99, 102, 241], [255, 219, 128]] :
    style === "aqua" ? [[65, 221, 255], [20, 184, 166], [190, 245, 255]] :
    [[78, 214, 255], [139, 112, 255], [255, 218, 128]];
  const accentA = palette[0];
  const accentB = palette[1];
  const accentC = palette[2];

  for (let y = 0; y < HEIGHT; y++) {
    const row = y * (WIDTH * 3 + 1);
    raw[row] = 0;
    const ny = y / HEIGHT;
    for (let x = 0; x < WIDTH; x++) {
      const nx = x / WIDTH;
      const vignette = Math.hypot(nx - 0.5, ny - 0.5);
      const grain = Math.abs(Math.sin((x * 13.17 + y * 79.31 + seed) * 0.011) * 43758.5453) % 1;

      const rgb = [
        4 + 6 * ny,
        7 + 9 * (1 - vignette),
        18 + 18 * (1 - ny),
      ];

      addGlow(rgb, nx, ny, 0.18, 0.28, 0.52, accentB, 0.34);
      addGlow(rgb, nx, ny, 0.78, 0.25, 0.48, accentA, 0.34);
      addGlow(rgb, nx, ny, 0.52, 0.50, 0.34, accentC, 0.28);

      if (style === "vision") {
        const dx = (nx - 0.52) / 0.34;
        const dy = (ny - 0.50) / 0.42;
        const eye = Math.max(0, 1 - Math.abs(dx * dx + dy * dy - 1) * 7);
        const iris = Math.max(0, 1 - Math.hypot((nx - 0.52) / 0.18, (ny - 0.50) / 0.27));
        rgb[0] += accentA[0] * eye * 0.28 + accentB[0] * iris * 0.42;
        rgb[1] += accentA[1] * eye * 0.28 + accentB[1] * iris * 0.42;
        rgb[2] += accentA[2] * eye * 0.28 + accentB[2] * iris * 0.42;
      }

      const organic = Math.abs(Math.sin((nx * 9.5 + Math.sin(ny * 8 + seed) * 0.8) * Math.PI));
      const membrane = organic > 0.965 ? 1 : 0;
      if ((style === "aqua" || style === "neural") && membrane) {
        rgb[0] += accentA[0] * 0.18;
        rgb[1] += accentA[1] * 0.18;
        rgb[2] += accentA[2] * 0.18;
      }

      const shade = 1 - Math.min(0.48, vignette * 0.78);
      const i = row + 1 + x * 3;
      raw[i] = clamp((rgb[0] + grain * 14) * shade);
      raw[i + 1] = clamp((rgb[1] + grain * 14) * shade);
      raw[i + 2] = clamp((rgb[2] + grain * 18) * shade);
    }
  }

  const nodeCount = style === "energy" ? 18 : 38;
  const nodes = Array.from({ length: nodeCount }, (_, i) => ({
    x: Math.round((0.10 + rand() * 0.82) * WIDTH),
    y: Math.round((0.12 + rand() * 0.74) * HEIGHT),
    r: 2 + Math.floor(rand() * 4),
    phase: i / Math.max(1, nodeCount - 1),
  }));
  const ribbonCount = style === "energy" ? 7 : 4;
  for (let r = 0; r < ribbonCount; r++) {
    const color = r % 3 === 0 ? accentA : r % 3 === 1 ? accentB : accentC;
    const amp = 42 + rand() * 62;
    const baseY = HEIGHT * (0.36 + rand() * 0.28);
    const slope = (rand() - 0.5) * 0.28;
    const phase = rand() * Math.PI * 2;
    let px = 0;
    let py = baseY;
    for (let x = 0; x < WIDTH; x += 4) {
      const t = x / WIDTH;
      const y =
        baseY +
        (t - 0.5) * HEIGHT * slope +
        Math.sin(t * Math.PI * (2.2 + rand() * 0.4) + phase) * amp +
        Math.sin(t * Math.PI * 11 + phase) * 9;
      if (x > 0) drawLine(raw, px, py, x, y, color, 0.16 + (style === "energy" ? 0.12 : 0.04), r % 2 === 0 ? 3 : 2);
      if (style === "energy" && r < 3) drawCircle(raw, x, y, 4 + rand() * 5, color, 0.04);
      px = x;
      py = y;
    }
  }

  for (let i = 0; i < nodes.length; i++) {
    for (let j = i + 1; j < nodes.length; j++) {
      const d = Math.hypot(nodes[i].x - nodes[j].x, nodes[i].y - nodes[j].y);
      if (d < (style === "neural" ? 190 : 145) && rand() > 0.48) {
        drawLine(raw, nodes[i].x, nodes[i].y, nodes[j].x, nodes[j].y, accentA, 0.10, 1);
      }
    }
  }
  for (const node of nodes) {
    drawCircle(raw, node.x, node.y, node.r + 7, accentB, 0.10);
    drawCircle(raw, node.x, node.y, node.r, [230, 248, 255], 0.55);
  }

  for (let i = 0; i < 110; i++) {
    const x = Math.round(rand() * WIDTH);
    const y = Math.round(rand() * HEIGHT);
    drawCircle(raw, x, y, 1 + rand() * 2.5, rand() > 0.5 ? accentA : accentB, 0.12 + rand() * 0.18);
  }

  const png = encodePng(WIDTH, HEIGHT, raw);
  const pngPath = `${outputBase}.png`;
  const webpPath = `${outputBase}.webp`;
  const jpgPath = `${outputBase}.jpg`;
  fs.writeFileSync(pngPath, png);
  execFileSync("cwebp", ["-quiet", "-q", "88", pngPath, "-o", webpPath]);
  execFileSync("ffmpeg", ["-y", "-loglevel", "error", "-i", pngPath, "-q:v", "3", jpgPath]);
  fs.unlinkSync(pngPath);
}

function crc32(buf) {
  let c = -1;
  for (const b of buf) {
    c ^= b;
    for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xedb88320 & -(c & 1));
  }
  return (c ^ -1) >>> 0;
}

function chunk(type, data) {
  const t = Buffer.from(type);
  const out = Buffer.alloc(8 + data.length + 4);
  out.writeUInt32BE(data.length, 0);
  t.copy(out, 4);
  data.copy(out, 8);
  out.writeUInt32BE(crc32(Buffer.concat([t, data])), 8 + data.length);
  return out;
}

function encodePng(width, height, raw) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 2;
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk("IHDR", ihdr),
    chunk("IDAT", zlib.deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

fs.mkdirSync(OUT_DIR, { recursive: true });

const posts = postsJson.filter(isOmniAiPost);
drawBackground({ slug: "default", subject: "Interlinked by Omni AI", keywords: ["AI", "automation"] }, path.join(OUT_DIR, "default"));
for (const post of posts) {
  drawBackground(post, path.join(OUT_DIR, post.slug));
}

console.log(`Generated ${posts.length + 1} landscape newsletter backgrounds in ${OUT_DIR}`);
