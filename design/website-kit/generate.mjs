/**
 * ProfJohns website design kit — low/mid-fidelity marketing-site sections.
 *
 * Generates SVG mockups (Figma-importable: drag any .svg into Figma and it
 * becomes editable vectors) in the product's Swiss system: flat, zero
 * gradients, 1px borders, ink + teal, skeleton bars for copy, REAL text only
 * on key actions. Every product depiction mirrors the actual UI (canvas
 * nodes, Compose tab, Watch inbox, agent cards) — nothing invented.
 *
 * Run: node design/website-kit/generate.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const OUT = path.dirname(fileURLToPath(import.meta.url));

// ---- Tokens (mirrors src/app/globals.css) ----------------------------------
const INK = "#171717";
const PAPER = "#ffffff";
const CANVAS = "#f5f5f5";
const G50 = "#fafafa";
const G100 = "#f4f4f5";
const G200 = "#e5e5e5";
const G300 = "#d4d4d4";
const G400 = "#a3a3a3";
const G500 = "#737373";
const TEAL = "#019A99";
const SLATE = "#2A5C6F";
// node accents (approximations of the oklch node identities)
const N_EXPLORER = "#3d74c6"; // sources — blue
const N_PROCESSOR = "#8a5cd6"; // synthesize — violet
const N_WRITING = "#2f9e6b"; // draft — green
const N_READER = "#d9952b"; // reader/audit — amber
const N_MEDIA = "#2aa3c0"; // media — cyan
const N_ASSIST = TEAL;

const FONT = `font-family="Inter, -apple-system, system-ui, sans-serif"`;

// ---- Primitives -------------------------------------------------------------
const rect = (x, y, w, h, fill, rx = 0, extra = "") =>
  `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${fill}" rx="${rx}" ${extra}/>`;

const line = (x1, y1, x2, y2, stroke = G200, sw = 1) =>
  `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${stroke}" stroke-width="${sw}"/>`;

const border = (x, y, w, h, rx = 8, stroke = G200, fill = PAPER, sw = 1) =>
  `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${fill}" stroke="${stroke}" stroke-width="${sw}" rx="${rx}"/>`;

const circle = (cx, cy, r, fill) => `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${fill}"/>`;

const text = (x, y, str, size = 13, fill = INK, weight = 500, anchor = "start", extra = "") =>
  `<text x="${x}" y="${y}" ${FONT} font-size="${size}" font-weight="${weight}" fill="${fill}" text-anchor="${anchor}" ${extra}>${str}</text>`;

/** Skeleton copy bar. */
const skel = (x, y, w, h = 10, fill = G200, rx = 5) => rect(x, y, w, h, fill, rx);

/** A run of skeleton lines (paragraph). */
function paragraph(x, y, w, lines = 3, lh = 18, h = 9) {
  let s = "";
  for (let i = 0; i < lines; i++) {
    const lw = i === lines - 1 ? w * 0.62 : w * (0.92 + (i % 2) * 0.08);
    s += skel(x, y + i * lh, Math.min(lw, w), h);
  }
  return s;
}

/** Primary (ink) button with real label. */
function buttonPrimary(x, y, label, w = null) {
  const width = w ?? label.length * 7.4 + 36;
  return (
    rect(x, y, width, 38, INK, 8) +
    text(x + width / 2, y + 24, label, 13, PAPER, 600, "middle")
  );
}

/** Secondary (outline) button. */
function buttonSecondary(x, y, label, w = null) {
  const width = w ?? label.length * 7.4 + 36;
  return (
    border(x, y, width, 38, 8) +
    text(x + width / 2, y + 24, label, 13, INK, 500, "middle")
  );
}

/** Tiny pill tag (real short label allowed). */
function pill(x, y, label, color = G500, bg = G100) {
  const w = label.length * 6.2 + 18;
  return (
    rect(x, y, w, 20, bg, 10) + text(x + w / 2, y + 13.5, label, 10, color, 600, "middle")
  );
}

/** Citation chip — the traceability atom (mirrors .lattice-citation). */
function citeChip(x, y, label = "[1]") {
  const w = label.length * 6.4 + 12;
  return (
    rect(x, y, w, 16, "#e6f4f4", 4) +
    text(x + w / 2, y + 11.5, label, 9.5, TEAL, 600, "middle")
  );
}

/** Product node card — mirrors NodeShell (label above, flat white card). */
function nodeCard(x, y, w, h, accent, label, bodyFn) {
  let s = "";
  // label strip above (grip + icon dot + name)
  s += circle(x + 5, y - 11, 2, G300) + circle(x + 11, y - 11, 2, G300);
  s += circle(x + 22, y - 11, 4, accent);
  s += text(x + 32, y - 7, label, 11, G500, 600);
  // card
  s += border(x, y, w, h, 10);
  if (bodyFn) s += bodyFn(x + 12, y + 12, w - 24, h - 24);
  return s;
}

/** Edge between two points — flat neutral connector like the canvas. */
const edge = (x1, y1, x2, y2) =>
  `<path d="M ${x1} ${y1} C ${x1 + 60} ${y1}, ${x2 - 60} ${y2}, ${x2} ${y2}" stroke="${G400}" stroke-width="1.5" fill="none"/>`;

/** Section wrapper. */
function svg(w, h, body, bg = PAPER) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
${rect(0, 0, w, h, bg)}
${body}</svg>`;
}

/** Faint dot-grid patch (canvas field). */
function dotGrid(x, y, w, h, gap = 22) {
  let s = rect(x, y, w, h, CANVAS, 12);
  for (let gx = x + gap; gx < x + w; gx += gap)
    for (let gy = y + gap; gy < y + h; gy += gap) s += circle(gx, gy, 1, G300);
  return s;
}

/** The ProfJohns "guy" placeholder mark (simplified: teal roundel + face hint). */
function logoMark(x, y, r = 14) {
  return (
    circle(x, y, r, "#e6f4f4") +
    circle(x - r * 0.32, y - r * 0.1, r * 0.14, TEAL) +
    circle(x + r * 0.32, y - r * 0.1, r * 0.14, TEAL) +
    `<path d="M ${x - r * 0.3} ${y + r * 0.38} Q ${x} ${y + r * 0.6} ${x + r * 0.3} ${y + r * 0.38}" stroke="${TEAL}" stroke-width="2" fill="none" stroke-linecap="round"/>`
  );
}

// ---- Reusable product mockups ----------------------------------------------

/** Mini research canvas: Sources -> Synthesize -> Draft, wired. */
function miniCanvas(x, y, w, h) {
  let s = dotGrid(x, y, w, h);
  const cw = Math.min(190, w * 0.26);
  const y0 = y + h * 0.24;
  // Sources node
  s += nodeCard(x + w * 0.06, y0, cw, 96, N_EXPLORER, "Sources", (bx, by, bw) => {
    let b = border(bx, by, bw, 26, 8, G200, G50);
    b += circle(bx + 13, by + 13, 4, G400);
    b += skel(bx + 24, by + 9, bw - 60, 8, G300);
    b += rect(bx + bw - 26, by + 4, 20, 18, INK, 6);
    b += paragraph(bx, by + 36, bw, 2, 14, 7);
    return b;
  });
  // Synthesize node
  s += nodeCard(x + w * 0.40, y0 - 26, cw, 130, N_PROCESSOR, "Synthesize", (bx, by, bw) => {
    let b = pill(bx, by, "Claims", N_PROCESSOR, "#f1eafe");
    b += paragraph(bx, by + 28, bw, 2, 13, 7);
    b += citeChip(bx, by + 56) + citeChip(bx + 34, by + 56, "[2]");
    b += line(bx, by + 82, bx + bw, by + 82);
    b += skel(bx, by + 90, bw * 0.7, 7, G300);
    return b;
  });
  // Draft node
  s += nodeCard(x + w * 0.74, y0 - 6, cw, 112, N_WRITING, "Draft", (bx, by, bw) => {
    let b = skel(bx, by, bw * 0.5, 10, G300);
    b += paragraph(bx, by + 20, bw, 2, 13, 7);
    b += `<g>${citeChip(bx + bw * 0.55, by + 33, "[1]")}</g>`;
    b += paragraph(bx, by + 56, bw, 2, 13, 7);
    return b;
  });
  // edges
  s += edge(x + w * 0.06 + cw, y0 + 48, x + w * 0.40, y0 + 39);
  s += edge(x + w * 0.40 + cw, y0 + 39, x + w * 0.74, y0 + 50);
  return s;
}

/** Compose split: board strip left -> document with cited sections right. */
function composeMock(x, y, w, h) {
  let s = "";
  const half = w * 0.46;
  // left: board
  s += dotGrid(x, y, half, h);
  s += nodeCard(x + 24, y + 40, half - 120, 74, N_PROCESSOR, "Synthesize", (bx, by, bw) => {
    let b = paragraph(bx, by, bw, 2, 14, 7);
    b += citeChip(bx, by + 32) + citeChip(bx + 34, by + 32, "[2]") + citeChip(bx + 68, by + 32, "[3]");
    return b;
  });
  s += nodeCard(x + 60, y + h - 118, half - 150, 64, N_EXPLORER, "Sources", (bx, by, bw) =>
    paragraph(bx, by, bw, 2, 14, 7),
  );
  // arrow bridge
  const bx = x + half + 8;
  s += `<path d="M ${bx} ${y + h / 2} l 34 0 m -8 -8 l 8 8 l -8 8" stroke="${INK}" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`;
  s += text(bx + 16, y + h / 2 - 16, "Compose", 11, INK, 600, "middle");
  // right: document
  const dx = x + w * 0.54 + 16;
  const dw = w - (w * 0.54 + 16);
  s += border(dx, y, dw, h, 12);
  s += skel(dx + 24, y + 26, dw * 0.5, 14, G300);
  s += line(dx + 24, y + 54, dx + dw - 24, y + 54);
  // section 1: H2 + cited paragraph
  s += skel(dx + 24, y + 70, dw * 0.36, 11, G400);
  s += paragraph(dx + 24, y + 92, dw - 48, 2, 16, 8);
  s += citeChip(dx + 24 + (dw - 48) * 0.52, y + 105);
  // section 2
  s += skel(dx + 24, y + 142, dw * 0.42, 11, G400);
  s += paragraph(dx + 24, y + 164, dw - 48, 3, 16, 8);
  s += citeChip(dx + 24 + (dw - 48) * 0.3, y + 177, "[2]");
  s += citeChip(dx + 24 + (dw - 48) * 0.75, y + 193, "[3]");
  return s;
}

// ---- Sections ----------------------------------------------------------------
const W = 1440;
const sections = [];

// 01 · Nav
sections.push([
  "01-nav",
  svg(
    W,
    72,
    logoMark(48, 36) +
      text(70, 41, "ProfJohns", 15, TEAL, 700) +
      skel(180, 31, 56) + skel(256, 31, 56) + skel(332, 31, 56) + skel(408, 31, 56) +
      buttonSecondary(W - 260, 17, "Sign in", 92) +
      buttonPrimary(W - 152, 17, "Start researching", 128) +
      line(0, 71, W, 71),
  ),
]);

// 02 · Hero — canvas is the headline
sections.push([
  "02-hero",
  svg(
    W,
    640,
    pill(560, 64, "VISUAL RESEARCH CANVAS", TEAL, "#e6f4f4") +
      skel(400, 110, 640, 26, G300, 13) +
      skel(470, 152, 500, 26, G300, 13) +
      skel(520, 208, 400, 11) +
      skel(560, 228, 320, 11) +
      buttonPrimary(600, 268, "Start researching") +
      buttonSecondary(760, 268, "See how it works") +
      miniCanvas(120, 350, W - 240, 250),
  ),
]);

// 03 · Social proof strip
sections.push([
  "03-social-proof",
  svg(
    W,
    120,
    text(W / 2, 40, "TRUSTED BY RESEARCHERS AT", 10, G400, 600, "middle", 'letter-spacing="2"') +
      [0, 1, 2, 3, 4, 5].map((i) => skel(240 + i * 170, 62, 120, 22, G200, 6)).join("") ,
    G50,
  ),
]);

// 04 · Process — Scout, Synthesize, Compose
sections.push([
  "04-process",
  svg(
    W,
    460,
    text(W / 2, 70, "HOW IT WORKS", 10, TEAL, 700, "middle", 'letter-spacing="2"') +
      skel(520, 92, 400, 20, G300, 10) +
      [
        { t: "Scout", a: N_EXPLORER, cta: "Run search" },
        { t: "Synthesize", a: N_PROCESSOR, cta: "Synthesize sources" },
        { t: "Compose", a: N_WRITING, cta: "Draft section" },
      ]
        .map((step, i) => {
          const x = 140 + i * 400;
          let s = border(x, 160, 360, 230, 12);
          s += circle(x + 34, 194, 14, "#e6f4f4");
          s += text(x + 34, 199, String(i + 1), 12, TEAL, 700, "middle");
          s += text(x + 58, 199, step.t, 15, INK, 600);
          s += paragraph(x + 24, 226, 312, 2, 16, 8);
          s += border(x + 24, 274, 312, 70, 8, G200, G50);
          s += circle(x + 44, 296, 5, step.a);
          s += skel(x + 58, 291, 200, 9, G300);
          s += skel(x + 44, 314, 240, 7);
          s += text(x + 24, 372, step.cta, 11.5, TEAL, 600);
          if (i < 2)
            s += `<path d="M ${x + 372} 275 l 16 0 m -6 -6 l 6 6 l -6 6" stroke="${G400}" stroke-width="1.5" fill="none"/>`;
          return s;
        })
        .join(""),
  ),
]);

// 05 · Feature — the canvas (full-bleed board)
sections.push([
  "05-feature-canvas",
  svg(
    W,
    560,
    pill(120, 70, "THINK SPATIALLY", TEAL, "#e6f4f4") +
      skel(120, 108, 420, 20, G300, 10) +
      paragraph(120, 148, 380, 3, 18, 9) +
      text(120, 232, "Right-click to add a node", 11.5, TEAL, 600) +
      miniCanvas(120, 270, W - 240, 240),
  ),
]);

// 06 · Feature — Compose (canvas → paper) — THE USP
sections.push([
  "06-feature-compose",
  svg(
    W,
    560,
    pill(120, 64, "CANVAS TO PAPER", N_WRITING, "#e7f5ee") +
      skel(120, 100, 460, 20, G300, 10) +
      paragraph(120, 140, 400, 2, 18, 9) +
      text(120, 208, "Propose outline from board", 11.5, TEAL, 600) +
      composeMock(120, 240, W - 240, 270),
  ),
]);

// 07 · Feature — traceable citations (anti-fabrication)
sections.push([
  "07-feature-citations",
  svg(W, 420, (() => {
    let s = pill(120, 70, "EVERY CLAIM TRACES BACK", TEAL, "#e6f4f4");
    s += skel(120, 108, 420, 20, G300, 10);
    s += paragraph(120, 148, 380, 3, 18, 9);
    // right: doc paragraph with cite chip wired to a source card
    const dx = 640, dy = 90;
    s += border(dx, dy, 420, 150, 12);
    s += paragraph(dx + 24, dy + 28, 372, 2, 18, 9);
    s += citeChip(dx + 24 + 372 * 0.45, dy + 44);
    s += paragraph(dx + 24, dy + 76, 372, 2, 18, 9);
    // source card
    s += border(dx + 500, dy + 30, 240, 110, 12);
    s += circle(dx + 524, dy + 56, 5, N_EXPLORER);
    s += skel(dx + 538, dy + 51, 160, 9, G300);
    s += paragraph(dx + 524, dy + 76, 190, 2, 14, 7);
    s += pill(dx + 524, dy + 108, "OPEN ACCESS", N_WRITING, "#e7f5ee");
    // trace line from chip to card
    s += `<path d="M ${dx + 24 + 372 * 0.45 + 30} ${dy + 52} C ${dx + 420} ${dy + 40}, ${dx + 450} ${dy + 70}, ${dx + 500} ${dy + 80}" stroke="${TEAL}" stroke-width="1.5" fill="none" stroke-dasharray="4 4"/>`;
    return s;
  })()),
]);

// 08 · Feature — Agents
sections.push([
  "08-feature-agents",
  svg(
    W,
    420,
    text(W / 2, 64, "YOUR RESEARCH AGENTS", 10, TEAL, 700, "middle", 'letter-spacing="2"') +
      skel(560, 86, 320, 18, G300, 9) +
      [
        ["Scout", N_EXPLORER],
        ["Synthesizer", N_PROCESSOR],
        ["Stylist", N_WRITING],
        ["Citationist", N_READER],
        ["Assistant", N_ASSIST],
      ]
        .map(([name, accent], i) => {
          const x = 110 + i * 250;
          let s = border(x, 140, 220, 210, 12);
          s += rect(x + 20, 162, 34, 34, "#f0f7f7", 9);
          s += circle(x + 37, 179, 6, accent);
          s += pill(x + 150, 168, "Built-in", G500);
          s += text(x + 20, 226, name, 14, INK, 600);
          s += paragraph(x + 20, 244, 180, 3, 14, 7);
          s += text(x + 20, 322, "Configure", 11, G500, 600);
          return s;
        })
        .join(""),
  ),
]);

// 09 · Feature — Watch (while you sleep)
sections.push([
  "09-feature-watch",
  svg(W, 460, (() => {
    let s = pill(120, 70, "WORKS WHILE YOU SLEEP", SLATE, "#eaf1f4");
    s += skel(120, 108, 440, 20, G300, 10);
    s += paragraph(120, 148, 380, 3, 18, 9);
    s += text(120, 234, "Add watch", 11.5, TEAL, 600);
    // right: standing search + findings inbox
    const dx = 640;
    s += border(dx, 80, 680, 84, 12);
    s += circle(dx + 30, 122, 6, N_EXPLORER);
    s += skel(dx + 50, 116, 300, 10, G300);
    s += pill(dx + 380, 112, "Daily", G500);
    s += buttonSecondary(dx + 560, 103, "Run now", 96);
    s += text(dx, 200, "NEW FINDINGS", 10, G400, 700, "start", 'letter-spacing="2"');
    for (let i = 0; i < 3; i++) {
      const fy = 216 + i * 66;
      s += border(dx, fy, 680, 54, 10);
      s += pill(dx + 16, fy + 17, String(88 - i * 6), N_WRITING, "#e7f5ee");
      s += skel(dx + 66, fy + 14, 380, 9, G300);
      s += skel(dx + 66, fy + 32, 240, 7);
      s += circle(dx + 620, fy + 27, 9, "#e7f5ee");
      s += circle(dx + 650, fy + 27, 9, G100);
    }
    return s;
  })()),
]);

// 10 · Feature — semantic + figure search
sections.push([
  "10-feature-search",
  svg(W, 440, (() => {
    let s = pill(120, 70, "FIND WHAT KEYWORDS MISS", N_PROCESSOR, "#f1eafe");
    s += skel(120, 108, 430, 20, G300, 10);
    s += paragraph(120, 148, 380, 3, 18, 9);
    const dx = 640;
    // semantic search panel
    s += border(dx, 80, 680, 150, 12);
    s += border(dx + 20, 100, 560, 40, 8, G200, G50);
    s += circle(dx + 40, 120, 5, G400);
    s += skel(dx + 56, 116, 300, 9, G300);
    s += rect(dx + 600, 100, 60, 40, INK, 8);
    s += text(dx + 630, 124, "Search", 11, PAPER, 600, "middle");
    for (let i = 0; i < 2; i++) {
      const ry = 156 + i * 34;
      s += pill(dx + 20, ry, `${94 - i * 9}%`, N_EXPLORER, "#e9f0fa");
      s += skel(dx + 78, ry + 5, 420 - i * 60, 9, G300);
    }
    // figure results grid
    s += text(dx, 262, "FIGURE SEARCH", 10, G400, 700, "start", 'letter-spacing="2"');
    for (let i = 0; i < 5; i++) {
      const fx = dx + i * 140;
      s += border(fx, 276, 120, 96, 8, G200, G100);
      s += `<path d="M ${fx + 24} ${340} l 22 -26 l 18 16 l 14 -12 l 20 22" stroke="${G400}" stroke-width="2" fill="none" stroke-linejoin="round"/>`;
      s += circle(fx + 34, 300, 6, G300);
      s += pill(fx + 74, 282, `${91 - i * 7}%`, N_MEDIA, "#e6f4f8");
    }
    return s;
  })()),
]);

// 11 · Feature — your voice (Lily)
sections.push([
  "11-feature-voice",
  svg(W, 380, (() => {
    let s = pill(120, 70, "WRITES LIKE YOU", N_WRITING, "#e7f5ee");
    s += skel(120, 108, 380, 20, G300, 10);
    s += paragraph(120, 148, 380, 3, 18, 9);
    const dx = 640;
    s += border(dx, 80, 680, 220, 12);
    s += text(dx + 24, 112, "Writing voice", 14, INK, 600);
    s += pill(dx + 580, 96, "Trained", N_WRITING, "#e7f5ee");
    for (let i = 0; i < 2; i++) {
      const ry = 132 + i * 46;
      s += border(dx + 24, ry, 632, 36, 8, G200, G50);
      s += circle(dx + 42, ry + 18, 4, G400);
      s += skel(dx + 56, ry + 13, 260, 8, G300);
      s += skel(dx + 540, ry + 13, 90, 8);
    }
    s += buttonPrimary(dx + 24, 236, "Train my voice", 140);
    s += text(dx + 184, 259, "Tab to accept suggestions while you write", 11, G500, 500);
    return s;
  })()),
]);

// 12 · Results / metrics band
sections.push([
  "12-results",
  svg(
    W,
    260,
    [0, 1, 2, 3]
      .map((i) => {
        const x = 150 + i * 300;
        return (
          skel(x, 80, 110, 34, TEAL, 8) +
          skel(x, 132, 180, 10, G300) +
          skel(x, 152, 140, 8)
        );
      })
      .join("") + line(0, 1, W, 1) + line(0, 259, W, 259),
    G50,
  ),
]);

// 13 · Comparison — canvas vs document tunnel
sections.push([
  "13-comparison",
  svg(W, 480, (() => {
    let s = text(W / 2, 64, "WHY A CANVAS", 10, TEAL, 700, "middle", 'letter-spacing="2"');
    s += skel(560, 86, 320, 18, G300, 9);
    // left: document tunnel (them)
    s += border(160, 140, 500, 280, 12, G200, G50);
    s += text(184, 172, "Document tools", 13, G500, 600);
    for (let i = 0; i < 9; i++) s += skel(184, 192 + i * 24, 452 - (i % 3) * 40, 8);
    s += `<line x1="185" y1="150" x2="635" y2="410" stroke="${G300}" stroke-width="1"/>`;
    // right: our board (us)
    s += border(780, 140, 500, 280, 12, TEAL, PAPER, 1.5);
    s += text(804, 172, "ProfJohns", 13, TEAL, 700);
    s += dotGrid(804, 188, 452, 208, 20);
    s += nodeCard(830, 240, 130, 60, N_EXPLORER, "Sources", (bx, by, bw) => paragraph(bx, by, bw, 2, 12, 6));
    s += nodeCard(1010, 300, 130, 60, N_WRITING, "Draft", (bx, by, bw) => paragraph(bx, by, bw, 2, 12, 6));
    s += edge(960, 270, 1010, 330);
    return s;
  })()),
]);

// 14 · Testimonials
sections.push([
  "14-testimonials",
  svg(
    W,
    360,
    [0, 1, 2]
      .map((i) => {
        const x = 140 + i * 400;
        let s = border(x, 80, 360, 220, 12);
        s += text(x + 24, 116, "“", 34, G300, 700);
        s += paragraph(x + 24, 140, 312, 3, 18, 9);
        s += circle(x + 40, 252, 16, G200);
        s += skel(x + 66, 242, 120, 9, G300);
        s += skel(x + 66, 258, 90, 7);
        return s;
      })
      .join(""),
    G50,
  ),
]);

// 15 · Pricing
sections.push([
  "15-pricing",
  svg(
    W,
    560,
    text(W / 2, 70, "PRICING", 10, TEAL, 700, "middle", 'letter-spacing="2"') +
      skel(590, 92, 260, 18, G300, 9) +
      [0, 1, 2]
        .map((i) => {
          const x = 200 + i * 380;
          const hero = i === 1;
          let s = border(x, 150, 340, 350, 14, hero ? INK : G200, PAPER, hero ? 2 : 1);
          if (hero) s += pill(x + 122, 136, "MOST POPULAR", PAPER, INK);
          s += skel(x + 28, 186, 100, 12, G300);
          s += skel(x + 28, 216, 90, 26, hero ? TEAL : G300, 8);
          s += skel(x + 126, 230, 50, 8);
          for (let f = 0; f < 4; f++) {
            s += circle(x + 36, 286 + f * 30, 5, hero ? TEAL : G300);
            s += skel(x + 52, 281 + f * 30, 200 - (f % 2) * 30, 8);
          }
          s += hero
            ? buttonPrimary(x + 28, 420, "Start researching", 284)
            : buttonSecondary(x + 28, 420, "Get started", 284);
          return s;
        })
        .join(""),
  ),
]);

// 16 · FAQ
sections.push([
  "16-faq",
  svg(
    W,
    440,
    text(W / 2, 70, "FAQ", 10, TEAL, 700, "middle", 'letter-spacing="2"') +
      [0, 1, 2, 3]
        .map((i) => {
          const y = 110 + i * 76;
          let s = border(320, y, 800, 60, 10);
          s += skel(348, y + 26, 300 + (i % 2) * 120, 10, G300);
          s += `<path d="M ${1080} ${y + 26} l 12 0 m -6 -6 l 0 12" stroke="${G400}" stroke-width="1.6"/>`;
          return s;
        })
        .join(""),
  ),
]);

// 17 · CTA band
sections.push([
  "17-cta",
  svg(
    W,
    300,
    rect(0, 0, W, 300, INK) +
      skel(470, 80, 500, 22, "#3a3a3a", 11) +
      skel(560, 120, 320, 11, "#2e2e2e") +
      rect(600, 170, 168, 42, TEAL, 8) +
      text(684, 196, "Start researching", 13.5, PAPER, 600, "middle") +
      `<rect x="788" y="170" width="130" height="42" rx="8" fill="none" stroke="#3a3a3a"/>` +
      text(853, 196, "See pricing", 13, PAPER, 500, "middle"),
  ),
]);

// 18 · Footer
sections.push([
  "18-footer",
  svg(
    W,
    280,
    line(0, 1, W, 1) +
      logoMark(80, 66) + text(102, 71, "ProfJohns", 14, TEAL, 700) +
      paragraph(80, 96, 220, 2, 16, 8) +
      [0, 1, 2, 3]
        .map((c) => {
          const x = 480 + c * 240;
          let s = skel(x, 60, 70, 9, G300);
          for (let r = 0; r < 4; r++) s += skel(x, 88 + r * 24, 100 + (r % 2) * 30, 7);
          return s;
        })
        .join("") +
      line(80, 220, W - 80, 220) +
      skel(80, 240, 180, 7) +
      skel(W - 260, 240, 180, 7),
    G50,
  ),
]);

// 19 · Atoms sheet — the kit's shared parts on one page
sections.push([
  "19-atoms",
  svg(W, 420, (() => {
    let s = text(60, 50, "KIT ATOMS", 10, G400, 700, "start", 'letter-spacing="2"');
    s += buttonPrimary(60, 80, "Start researching");
    s += buttonSecondary(240, 80, "See how it works");
    s += pill(430, 89, "OPEN ACCESS", N_WRITING, "#e7f5ee");
    s += pill(540, 89, "Built-in", G500);
    s += citeChip(640, 91) + citeChip(680, 91, "[12]");
    s += nodeCard(60, 180, 200, 90, N_EXPLORER, "Sources", (bx, by, bw) => paragraph(bx, by, bw, 3, 15, 7));
    s += nodeCard(320, 180, 200, 90, N_PROCESSOR, "Synthesize", (bx, by, bw) => paragraph(bx, by, bw, 3, 15, 7));
    s += nodeCard(580, 180, 200, 90, N_WRITING, "Draft", (bx, by, bw) => paragraph(bx, by, bw, 3, 15, 7));
    s += edge(260, 225, 320, 225);
    s += edge(520, 225, 580, 225);
    // skeleton scale
    s += skel(880, 180, 220, 26, G300, 13);
    s += skel(880, 220, 220, 14, G300, 7);
    s += skel(880, 248, 220, 9);
    s += paragraph(880, 272, 220, 3, 16, 8);
    s += text(60, 330, "Ink " + INK, 11, G500, 500);
    s += rect(60, 340, 40, 24, INK, 6);
    s += text(130, 330, "Teal " + TEAL, 11, G500, 500);
    s += rect(130, 340, 40, 24, TEAL, 6);
    s += text(200, 330, "Canvas " + CANVAS, 11, G500, 500);
    s += rect(200, 340, 40, 24, CANVAS, 6, `stroke="${G200}"`);
    return s;
  })()),
]);

// ---- Emit --------------------------------------------------------------------
for (const [name, body] of sections) {
  fs.writeFileSync(path.join(OUT, `${name}.svg`), body);
}

const gallery = `<!doctype html><html><head><meta charset="utf-8"><title>ProfJohns website kit</title>
<style>body{margin:0;background:#e9e9e9;font:12px Inter,system-ui,sans-serif;color:#737373}
h2{margin:28px 0 8px 24px;font-size:12px;letter-spacing:1px;text-transform:uppercase}
img{display:block;width:100%;max-width:1440px;margin:0 auto;box-shadow:0 1px 3px rgba(0,0,0,.12)}</style></head><body>
${sections.map(([n]) => `<h2>${n}</h2><img src="${n}.svg" alt="${n}"/>`).join("\n")}
</body></html>`;
fs.writeFileSync(path.join(OUT, "gallery.html"), gallery);

console.log(`wrote ${sections.length} sections + gallery.html to ${OUT}`);
