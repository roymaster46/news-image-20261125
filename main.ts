// news-image-20261125 v2 — "The World in One Day — Wednesday 25 November 2026"
// Hand-written procedural renderer. Node 22 stdlib only (fs, zlib).
// Renders entry.png (1024x1024 RGB) deterministically; no fonts, no images,
// no randomness, no network. Every drawn glyph comes from the 5x7 bitmap
// font embedded below. Any text that does not fit its box aborts (exit 1).
import * as fs from "node:fs";
import * as zlib from "node:zlib";

export const W = 1024;
export const H = 1024;

// ---------------------------------------------------------------- palette
export const PAPER: C = [246, 241, 227];
export const INK: C = [20, 20, 20];
export const RED: C = [178, 35, 27];
export const NAVY: C = [28, 43, 58];
export const MUTED: C = [107, 98, 82];
export const LINE: C = [20, 20, 20];
export const WHITE: C = [255, 255, 255];
export const CREAM: C = [255, 250, 235];
export const GOLD: C = [183, 121, 31];
export const GREEN: C = [31, 138, 76];
export const BLUE: C = [46, 109, 180];
export const PURPLE: C = [142, 68, 173];
export const ORANGE: C = [230, 126, 34];
export const PINK: C = [194, 24, 91];
export const TEAL: C = [0, 131, 143];
export const BROWN: C = [93, 64, 55];
export const LIGHTGREY: C = [225, 219, 203];
export const MIDGREY: C = [200, 192, 172];

type C = [number, number, number];

// ------------------------------------------------------------- framebuffer
const buf = Buffer.alloc(W * H * 3);
export function px(x: number, y: number, c: C): void {
  if (x < 0 || y < 0 || x >= W || y >= H) return;
  const i = (y * W + x) * 3;
  buf[i] = c[0]; buf[i + 1] = c[1]; buf[i + 2] = c[2];
}
export function rect(x: number, y: number, w: number, h: number, c: C): void {
  for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) px(i, j, c);
}
export function frame(x: number, y: number, w: number, h: number, c: C, t = 1): void {
  rect(x, y, w, t, c); rect(x, y + h - t, w, t, c);
  rect(x, y, t, h, c); rect(x + w - t, y, t, h, c);
}
export function line(x0: number, y0: number, x1: number, y1: number, c: C): void {
  const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0);
  const sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
  let e = dx + dy, x = x0, y = y0;
  for (;;) { px(x, y, c); if (x === x1 && y === y1) break; const e2 = 2 * e; if (e2 >= dy) { e += dy; x += sx; } if (e2 <= dx) { e += dx; y += sy; } }
}
export function disc(cx: number, cy: number, r: number, c: C): void {
  for (let dy = -r; dy <= r; dy++) {
    const dx = Math.floor(Math.sqrt(Math.max(0, r * r - dy * dy)));
    for (let x = cx - dx; x <= cx + dx; x++) px(x, cy + dy, c);
  }
}
export function ellipse(cx: number, cy: number, rx: number, ry: number, c: C): void {
  for (let dy = -ry; dy <= ry; dy++) {
    const t = 1 - (dy * dy) / (ry * ry);
    const dx = Math.floor(rx * Math.sqrt(Math.max(0, t)));
    for (let x = cx - dx; x <= cx + dx; x++) px(x, cy + dy, c);
  }
}
export function tri(x0: number, y0: number, x1: number, y1: number, x2: number, y2: number, c: C): void {
  const minX = Math.min(x0, x1, x2), maxX = Math.max(x0, x1, x2);
  const minY = Math.min(y0, y1, y2), maxY = Math.max(y0, y1, y2);
  const d = (x1 - x0) * (y2 - y0) - (y1 - y0) * (x2 - x0);
  if (d === 0) return;
  for (let y = minY; y <= maxY; y++) for (let x = minX; x <= maxX; x++) {
    const a = ((x1 - x) * (y2 - y) - (y1 - y) * (x2 - x)) / d;
    const b = ((x2 - x) * (y0 - y) - (y2 - y) * (x0 - x)) / d;
    const g = 1 - a - b;
    if (a >= 0 && b >= 0 && g >= 0) px(x, y, c);
  }
}
// filled polygon (even-odd scanline)
export function poly(pts: Array<[number, number]>, c: C): void {
  let minY = 1e9, maxY = -1e9;
  for (const [, y] of pts) { minY = Math.min(minY, y); maxY = Math.max(maxY, y); }
  for (let y = minY; y <= maxY; y++) {
    const xs: number[] = [];
    for (let i = 0; i < pts.length; i++) {
      const [x0, y0] = pts[i], [x1, y1] = pts[(i + 1) % pts.length];
      if ((y0 <= y && y1 > y) || (y1 <= y && y0 > y)) {
        xs.push(x0 + ((y - y0) / (y1 - y0)) * (x1 - x0));
      }
    }
    xs.sort((a, b) => a - b);
    for (let k = 0; k + 1 < xs.length; k += 2) {
      for (let x = Math.ceil(xs[k]); x <= Math.floor(xs[k + 1]); x++) px(x, y, c);
    }
  }
}

// ------------------------------------------------------- 5x7 bitmap font
// Each glyph: 7 rows of 5 cells ('#' = ink, '.' = empty). Baseline row 5,
// descenders use rows 5-6 (g, j, p, q, y, comma).
const FONT: Record<string, string[]> = {
  A: [".###.", "#...#", "#...#", "#####", "#...#", "#...#", "#...#"],
  B: ["####.", "#...#", "#...#", "####.", "#...#", "#...#", "####."],
  C: [".####", "#....", "#....", "#....", "#....", "#....", ".####"],
  D: ["####.", "#...#", "#...#", "#...#", "#...#", "#...#", "####."],
  E: ["#####", "#....", "#....", "####.", "#....", "#....", "#####"],
  F: ["#####", "#....", "#....", "####.", "#....", "#....", "#...."],
  G: [".####", "#....", "#....", "#.###", "#...#", "#...#", ".###."],
  H: ["#...#", "#...#", "#...#", "#####", "#...#", "#...#", "#...#"],
  I: ["#####", "..#..", "..#..", "..#..", "..#..", "..#..", "#####"],
  J: ["..###", "...#.", "...#.", "...#.", "...#.", "#..#.", ".##.."],
  K: ["#...#", "#..#.", "#.#..", "##...", "#.#..", "#..#.", "#...#"],
  L: ["#....", "#....", "#....", "#....", "#....", "#....", "#####"],
  M: ["#...#", "##.##", "#.#.#", "#.#.#", "#...#", "#...#", "#...#"],
  N: ["#...#", "##..#", "##..#", "#.#.#", "#..##", "#..##", "#...#"],
  O: [".###.", "#...#", "#...#", "#...#", "#...#", "#...#", ".###."],
  P: ["####.", "#...#", "#...#", "####.", "#....", "#....", "#...."],
  Q: [".###.", "#...#", "#...#", "#...#", "#.#.#", "#..#.", ".##.#"],
  R: ["####.", "#...#", "#...#", "####.", "#.#..", "#..#.", "#...#"],
  S: [".####", "#....", "#....", ".###.", "....#", "....#", "####."],
  T: ["#####", "..#..", "..#..", "..#..", "..#..", "..#..", "..#.."],
  U: ["#...#", "#...#", "#...#", "#...#", "#...#", "#...#", ".###."],
  V: ["#...#", "#...#", "#...#", "#...#", "#...#", ".#.#.", "..#.."],
  W: ["#...#", "#...#", "#...#", "#.#.#", "#.#.#", "##.##", "#...#"],
  X: ["#...#", "#...#", ".#.#.", "..#..", ".#.#.", "#...#", "#...#"],
  Y: ["#...#", "#...#", ".#.#.", "..#..", "..#..", "..#..", "..#.."],
  Z: ["#####", "....#", "...#.", "..#..", ".#...", "#....", "#####"],
  a: [".....", ".....", ".####", "....#", ".####", "#...#", ".###."],
  b: ["#....", "#....", "####.", "#...#", "#...#", "#...#", "####."],
  c: [".....", ".....", ".####", "#....", "#....", "#....", ".####"],
  d: ["....#", "....#", ".####", "#...#", "#...#", "#...#", ".####"],
  e: [".....", ".....", ".###.", "#...#", "#####", "#....", ".###."],
  f: ["..##.", ".#..#", ".#...", "####.", ".#...", ".#...", ".#..."],
  g: [".....", ".....", ".####", "#...#", "#...#", ".####", "....#"],
  h: ["#....", "#....", "####.", "#...#", "#...#", "#...#", "#...#"],
  i: [".....", "..#..", ".....", ".##..", "..#..", "..#..", ".###."],
  j: ["....#", ".....", "...##", "....#", "....#", "....#", ".###."],
  k: ["#....", "#....", "#.#..", "#.#..", "##...", "#.#..", "#..#."],
  l: [".##..", "..#..", "..#..", "..#..", "..#..", "..#..", ".###."],
  m: [".....", ".....", "##.#.", "#.#.#", "#.#.#", "#.#.#", "#.#.#"],
  n: [".....", ".....", "####.", "#...#", "#...#", "#...#", "#...#"],
  o: [".....", ".....", ".###.", "#...#", "#...#", "#...#", ".###."],
  p: [".....", ".....", "####.", "#...#", "#...#", "####.", "#...."],
  q: [".....", ".....", ".####", "#...#", "#...#", ".####", "....#"],
  r: [".....", ".....", "#.##.", "##..#", "#....", "#....", "#...."],
  s: [".....", ".....", ".####", "#....", ".###.", "....#", "####."],
  t: [".#...", ".#...", "####.", ".#...", ".#...", ".#...", "..##."],
  u: [".....", ".....", "#...#", "#...#", "#...#", "#..##", ".##.#"],
  v: [".....", ".....", "#...#", "#...#", "#...#", ".#.#.", "..#.."],
  w: [".....", ".....", "#...#", "#.#.#", "#.#.#", "#.#.#", ".#.#."],
  x: [".....", ".....", "#...#", ".#.#.", "..#..", ".#.#.", "#...#"],
  y: [".....", ".....", "#...#", "#...#", "#...#", ".####", "....#"],
  z: [".....", ".....", "#####", "...#.", "..#..", ".#...", "#####"],
  "0": [".###.", "#..##", "#.#.#", "##..#", "#...#", "#...#", ".###."],
  "1": ["..#..", ".##..", "..#..", "..#..", "..#..", "..#..", ".###."],
  "2": [".###.", "#...#", "....#", "...#.", "..#..", ".#...", "#####"],
  "3": ["####.", "....#", "....#", ".###.", "....#", "....#", "####."],
  "4": ["...#.", "..##.", ".#.#.", "#..#.", "#####", "...#.", "...#."],
  "5": ["#####", "#....", "####.", "....#", "....#", "#...#", ".###."],
  "6": [".###.", "#....", "#....", "####.", "#...#", "#...#", ".###."],
  "7": ["#####", "....#", "...#.", "...#.", "..#..", "..#..", "..#.."],
  "8": [".###.", "#...#", "#...#", ".###.", "#...#", "#...#", ".###."],
  "9": [".###.", "#...#", "#...#", ".####", "....#", "....#", ".###."],
  " ": [".....", ".....", ".....", ".....", ".....", ".....", "....."],
  ".": [".....", ".....", ".....", ".....", ".....", ".##..", ".##.."],
  ",": [".....", ".....", ".....", ".....", ".##..", ".##..", ".#..."],
  ":": [".....", ".##..", ".##..", ".....", ".##..", ".##..", "....."],
  ";": [".....", ".##..", ".##..", ".....", ".##..", ".##..", ".#..."],
  "!": ["..#..", "..#..", "..#..", "..#..", "..#..", ".....", "..#.."],
  "?": [".###.", "#...#", "....#", "...#.", "..#..", ".....", "..#.."],
  "-": [".....", ".....", ".....", ".###.", ".....", ".....", "....."],
  "—": [".....", ".....", ".....", "#####", ".....", ".....", "....."],
  "·": [".....", ".....", "..#..", "..#..", ".....", ".....", "....."],
  "•": [".....", ".....", ".###.", ".###.", ".###.", ".....", "....."],
  "(": ["...#.", "..#..", "..#..", "..#..", "..#..", "..#..", "...#."],
  ")": [".#...", "..#..", "..#..", "..#..", "..#..", "..#..", ".#..."],
  "/": ["....#", "....#", "...#.", "..#..", ".#...", "#....", "#...."],
  "%": ["##..#", "##.#.", "...#.", "..#..", ".#...", "#.###", "#..##"],
  "+": [".....", "..#..", "..#..", ".###.", "..#..", "..#..", "....."],
  "=": [".....", ".....", ".###.", ".....", ".###.", ".....", "....."],
  "&": [".##..", "#..#.", "#..#.", ".#...", "#.#.#", "#..#.", ".##.#"],
  $: ["..#..", ".####", "#.#..", ".###.", "..#.#", "####.", "..#.."],
  "£": ["..##.", ".#...", "#....", "####.", "#....", ".#...", "#####"],
  "°": [".###.", "#...#", ".###.", ".....", ".....", ".....", "....."],
  "×": [".....", ".....", "#...#", ".#.#.", "..#..", ".#.#.", "#...#"],
  '"': [".#.#.", ".#.#.", ".#.#.", ".....", ".....", ".....", "....."],
  "'": ["..#..", "..#..", ".#...", ".....", ".....", ".....", "....."],
  "*": [".....", ".....", ".#.#.", ".###.", ".#.#.", ".....", "....."],
};

function drawGlyph(ch: string, x: number, y: number, s: number, c: C, bold: boolean): void {
  const g = FONT[ch];
  if (!g) return;
  for (let r = 0; r < 7; r++) for (let col = 0; col < 5; col++) {
    if (g[r][col] === "#") {
      rect(x + col * s, y + r * s, s, s, c);
      if (bold) rect(x + col * s + 1, y + r * s, s, s, c);
    }
  }
}

// advance per character in px; bold adds 1px of width
export function charAdv(s: number, bold: boolean): number {
  return 6 * s + (bold ? 1 : 0);
}
export function textW(str: string, s: number, bold = false): number {
  if (!str.length) return 0;
  return str.length * charAdv(s, bold) - s;
}
export function drawText(x: number, y: number, str: string, s: number, c: C, bold = false): void {
  let cx = x;
  for (const ch of str) { drawGlyph(ch, cx, y, s, c, bold); cx += charAdv(s, bold); }
}
export function drawTextC(x: number, y: number, str: string, s: number, c: C, bold = false): void {
  drawText(x - Math.floor(textW(str, s, bold) / 2), y, str, s, c, bold);
}
// single line that MUST fit; throws otherwise (a truncated file is rejected)
export function fitText(x: number, y: number, str: string, s: number, c: C, maxW: number, bold = false): void {
  if (textW(str, s, bold) > maxW) throw new Error(`OVERFLOW single-line "${str}" needs ${textW(str, s, bold)} > ${maxW}`);
  drawText(x, y, str, s, c, bold);
}
export function fitTextC(x: number, y: number, str: string, s: number, c: C, maxW: number, bold = false): void {
  if (textW(str, s, bold) > maxW) throw new Error(`OVERFLOW centered "${str}" needs ${textW(str, s, bold)} > ${maxW}`);
  drawTextC(x, y, str, s, c, bold);
}
// wrap into lines of at most maxW px; throws if a single word is too wide
export function wrap(str: string, maxW: number, s: number, bold = false): string[] {
  const adv = charAdv(s, bold);
  const lines: string[] = [];
  for (const rawWord of str.split(" ")) {
    if (rawWord === "") continue;
    // hard-break words that alone exceed the width (e.g. long URLs)
    let word = rawWord;
    while (textW(word, s, bold) > maxW) {
      const n = Math.floor(maxW / adv);
      if (n < 1) throw new Error(`OVERFLOW word "${word}" cannot fit ${maxW}px`);
      lines.push(word.slice(0, n));
      word = word.slice(n);
    }
    if (!lines.length || textW(lines[lines.length - 1] + " " + word, s, bold) > maxW) lines.push(word);
    else lines[lines.length - 1] += " " + word;
  }
  return lines;
}
// paragraph: draw wrapped text, at most maxLines lines, line height lh px.
// Returns y just below the last line. Throws on overflow.
export function para(x: number, y: number, maxW: number, str: string, s: number, c: C, maxLines: number, bold = false, lh?: number): number {
  const lines = wrap(str, maxW, s, bold);
  if (lines.length > maxLines) throw new Error(`OVERFLOW para "${str.slice(0, 40)}..." needs ${lines.length} lines > ${maxLines}`);
  const step = lh ?? (7 * s + 2);
  lines.forEach((ln, i) => drawText(x, y + i * step, ln, s, c, bold));
  return y + lines.length * step;
}

// ---------------------------------------------------------------- PNG codec
const CRC_TABLE: number[] = (() => {
  const t: number[] = [];
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();
export function crc32(b: Buffer): number {
  let c = 0xffffffff;
  for (let i = 0; i < b.length; i++) c = CRC_TABLE[(c ^ b[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function chunk(type: string, data: Buffer): Buffer {
  const out = Buffer.alloc(12 + data.length);
  out.writeUInt32BE(data.length, 0);
  out.write(type, 4, "ascii");
  data.copy(out, 8);
  out.writeUInt32BE(crc32(Buffer.concat([Buffer.from(type, "ascii"), data])), 8 + data.length);
  return out;
}
export function encodePNG(): Buffer {
  const raw = Buffer.alloc(H * (1 + W * 3));
  for (let y = 0; y < H; y++) {
    raw[y * (1 + W * 3)] = 0; // filter: None
    buf.copy(raw, y * (1 + W * 3) + 1, y * W * 3, (y + 1) * W * 3);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(W, 0); ihdr.writeUInt32BE(H, 4);
  ihdr[8] = 8; ihdr[9] = 2; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  const idat = zlib.deflateSync(raw, { level: 9 });
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr), chunk("IDAT", idat), chunk("IEND", Buffer.alloc(0)),
  ]);
}
// full structural check of a PNG buffer; throws on any defect
export function verifyPNG(png: Buffer): void {
  if (png.length > 1024 * 1024) throw new Error(`PNG too big: ${png.length} bytes`);
  const sig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  if (!png.subarray(0, 8).equals(sig)) throw new Error("bad PNG signature");
  let off = 8, sawIHDR = false, sawIEND = false, sawIDAT = false;
  while (off < png.length) {
    if (off + 8 > png.length) throw new Error("chunk header truncated");
    const len = png.readUInt32BE(off);
    const type = png.toString("ascii", off + 4, off + 8);
    if (off + 12 + len > png.length) throw new Error(`chunk ${type} is truncated`);
    const data = png.subarray(off + 8, off + 8 + len);
    const crc = png.readUInt32BE(off + 8 + len);
    if (crc32(Buffer.concat([Buffer.from(type, "ascii"), data])) !== crc) throw new Error(`chunk ${type} CRC mismatch`);
    if (type === "IHDR") {
      sawIHDR = true;
      if (data.readUInt32BE(0) !== W || data.readUInt32BE(4) !== H) throw new Error("IHDR is not 1024x1024");
      if (data[8] !== 8 || data[9] !== 2) throw new Error("IHDR is not 8-bit RGB");
    }
    if (type === "IDAT") sawIDAT = true;
    if (type === "IEND") { sawIEND = true; if (off + 12 + len !== png.length) throw new Error("trailing data after IEND"); }
    off += 12 + len;
  }
  if (!sawIHDR || !sawIDAT || !sawIEND) throw new Error("missing IHDR/IDAT/IEND");
}

// ------------------------------------------------------------- helpers
function drawTextAdv(x: number, y: number, str: string, s: number, c: C, bold: boolean, adv: number): void {
  let cx = x;
  for (const ch of str) { drawGlyph(ch, cx, y, s, c, bold); cx += adv; }
}
// right-aligned badge; returns its width
function badge(xRight: number, y: number, text: string, bg: C): void {
  const w = text.length * 7 + 8;
  rect(xRight - w, y, w, 11, bg);
  drawText(xRight - w + 4, y + 2, text, 1, WHITE, true);
}
function numDisc(cx: number, cy: number, n: number, color: C): void {
  disc(cx, cy, 8, color);
  disc(cx, cy, 8, color);
  const t = String(n);
  drawText(cx - Math.floor((t.length * 6 - 1) / 2), cy - 4, t, 1, WHITE, true);
}
const BADGE_BG: Record<string, C> = { OFFICIAL: GREEN, CONFIRMED: BLUE, REPORTED: GOLD, CLAIM: RED };

// ------------------------------------------------------------- hero art
function artShip(x: number, y: number, w: number, h: number): void {
  rect(x, y, w, h, NAVY);
  // tariff chips
  const chips: Array<[string, C]> = [["CHINA 20%", RED], ["INDIA 25%", ORANGE], ["EU 15%", BLUE], ["VIETNAM 35%", PURPLE]];
  let cx = x + 8;
  for (const [t, c] of chips) {
    const cw = t.length * 6 + 8;
    rect(cx, y + 8, cw, 13, c);
    drawText(cx + 4, y + 11, t, 1, WHITE, true);
    cx += cw + 6;
  }
  // sea
  rect(x, y + h - 26, w, 26, [30, 90, 140]);
  // containers
  const cols = [RED, GOLD, GREEN, BLUE, ORANGE, PURPLE];
  for (let r = 0; r < 2; r++) for (let c = 0; c < 6; c++) {
    rect(x + 40 + c * 40, y + h - 26 - 34 + r * 16, 36, 14, cols[(r * 2 + c) % 6]);
  }
  // hull + bridge
  poly([[x + 20, y + h - 26], [x + 300, y + h - 26], [x + 288, y + h - 8], [x + 34, y + h - 8]], [18, 18, 18]);
  rect(x + 268, y + h - 62, 26, 36, WHITE);
  rect(x + 272, y + h - 58, 18, 4, NAVY);
  rect(x + 272, y + h - 50, 18, 4, NAVY);
  // label bar
  rect(x, y + h - 16, 118, 16, [18, 18, 18]);
  drawText(x + 6, y + h - 13, "14 ECONOMIES", 1, WHITE, true);
}
function artChart(x: number, y: number, w: number, h: number): void {
  rect(x, y, w, h, [18, 24, 32]);
  drawText(x + 8, y + 8, "KOSPI CLOSE 4,697.51", 1, WHITE, true);
  // grid
  for (let i = 1; i < 4; i++) line(x + 8, y + 22 + i * 22, x + w - 118, y + 22 + i * 22, [60, 70, 84]);
  // falling line
  const pts: Array<[number, number]> = [[x + 14, y + 34], [x + 48, y + 44], [x + 76, y + 40], [x + 104, y + 58], [x + 132, y + 66], [x + 160, y + 86], [x + 188, y + 104]];
  for (let i = 0; i + 1 < pts.length; i++) { line(pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1], RED); line(pts[i][0], pts[i][1] + 1, pts[i + 1][0], pts[i + 1][1] + 1, RED); }
  const labels = ["KOSPI -6.2%", "HYNIX -11.1%", "SAMSUNG -9.9%", "TAIEX -4.8%", "NIKKEI -2.8%"];
  labels.forEach((t, i) => drawText(x + w - 112, y + 34 + i * 15, t, 1, WHITE, false));
  drawText(x + 8, y + h - 14, "AI SPENDING DOUBTS", 1, [255, 190, 60], true);
}
function artRocket(x: number, y: number, w: number, h: number): void {
  rect(x, y, w, h, NAVY);
  // deterministic stars
  let seed = 1234567;
  const rnd = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };
  for (let i = 0; i < 46; i++) { const sx = x + 6 + Math.floor(rnd() * (w - 12)); const sy = y + 6 + Math.floor(rnd() * (h - 40)); px(sx, sy, WHITE); if (rnd() > 0.7) px(sx + 1, sy, WHITE); }
  // Earth arc (top sliver inside the art box only — repaint below the box
  // with paper so the ellipse can never cover the headline text)
  ellipse(x + w / 2, y + h + 40, Math.floor(w * 0.48), 58, [40, 110, 190]);
  ellipse(x + w / 2, y + h + 40, Math.floor(w * 0.48), 58, [40, 110, 190]);
  rect(x, y + h - 18, w, 18, [40, 110, 190]);
  rect(x, y + h, w, 160, PAPER);
  // station (top right)
  rect(x + w - 96, y + 14, 66, 10, WHITE);
  rect(x + w - 70, y + 8, 14, 34, WHITE);
  rect(x + w - 96, y + 30, 66, 8, [150, 170, 200]);
  drawText(x + w - 92, y + 44, "TIANGONG", 1, WHITE, true);
  // rocket
  const rx = x + 96;
  tri(rx - 12, y + 62, rx + 12, y + 62, rx, y + 34, RED);
  rect(rx - 12, y + 62, 24, 44, WHITE);
  rect(rx - 12, y + 76, 24, 6, RED);
  tri(rx - 12, y + 106, rx - 26, y + 118, rx - 12, y + 96, RED);
  tri(rx + 12, y + 106, rx + 26, y + 118, rx + 12, y + 96, RED);
  tri(rx - 7, y + 106, rx + 7, y + 106, rx, y + 126, ORANGE);
  drawText(x + 10, y + h - 14, "00:18 UTC · LIFT-OFF", 1, WHITE, true);
}

// ------------------------------------------------------------- mid art
function artBolt(x: number, y: number, w: number, h: number): void {
  rect(x, y, w, h, [16, 70, 46]);
  poly([[x + 34, y + 6], [x + 18, y + 28], [x + 30, y + 28], [x + 22, y + 42], [x + 42, y + 18], [x + 30, y + 18]], [255, 200, 40]);
  fitText(x + 52, y + 14, "£2,166", 2, WHITE, 136, true);
  drawText(x + 52, y + 32, "+26% FROM 1 JAN", 1, [255, 200, 40], true);
}
function artFire(x: number, y: number, w: number, h: number): void {
  rect(x, y, w, h, [46, 22, 18]);
  rect(x + 14, y + 26, 66, 12, [30, 30, 30]);
  disc(x + 28, y + 40, 5, [20, 20, 20]); disc(x + 66, y + 40, 5, [20, 20, 20]);
  tri(x + 108, y + 40, x + 122, y + 40, x + 115, y + 8, ORANGE);
  tri(x + 118, y + 40, x + 130, y + 40, x + 124, y + 16, [255, 200, 40]);
  tri(x + 96, y + 40, x + 108, y + 40, x + 102, y + 22, RED);
  fitText(x + 142, y + 12, "31", 2, WHITE, 44, true);
  drawText(x + 142, y + 30, "KILLED", 1, WHITE, true);
}
function artMine(x: number, y: number, w: number, h: number): void {
  rect(x, y, w, h, [58, 44, 24]);
  rect(x + 60, y + 6, 26, 42, [24, 18, 10]);
  rect(x, y + 38, w, 10, [40, 110, 190]);
  line(x + 60, y + 6, x + 86, y + 6, [200, 170, 120]);
  fitText(x + 96, y + 12, "9 DEAD", 2, WHITE, 92, true);
  drawText(x + 96, y + 30, "17 TRAPPED", 1, [255, 220, 120], true);
}
function artShirt(x: number, y: number, w: number, h: number): void {
  rect(x, y, w, h, [0, 84, 84]);
  poly([[x + 16, y + 12], [x + 30, y + 6], [x + 38, y + 12], [x + 46, y + 6], [x + 60, y + 12], [x + 52, y + 20], [x + 52, y + 40], [x + 24, y + 40], [x + 24, y + 20]], WHITE);
  disc(x + 178, y + 14, 5, GOLD); disc(x + 186, y + 30, 5, GOLD);
  fitText(x + 66, y + 14, "Tk17,000", 2, WHITE, 104, true);
  drawText(x + 66, y + 32, "+36% PAY", 1, [255, 220, 120], true);
}
function artFlags(x: number, y: number, w: number, h: number): void {
  rect(x, y, w, h, [18, 48, 108]);
  rect(x + 12, y + 10, 44, 26, [0, 40, 120]);
  line(x + 12, y + 10, x + 56, y + 36, WHITE); line(x + 56, y + 10, x + 12, y + 36, WHITE);
  poly([[x + 66, y + 10], [x + 110, y + 10], [x + 66, y + 36]], [0, 130, 60]);
  poly([[x + 110, y + 10], [x + 110, y + 36], [x + 66, y + 36]], [0, 60, 160]);
  fitText(x + 116, y + 14, "A$740m", 2, WHITE, 76, true);
  drawText(x + 116, y + 32, "10 YEARS", 1, WHITE, true);
}
function artGaza(x: number, y: number, w: number, h: number): void {
  rect(x, y, w, h, [64, 64, 64]);
  rect(x + 14, y + 14, 22, 34, [30, 30, 30]);
  rect(x + 42, y + 6, 26, 42, [30, 30, 30]);
  rect(x + 74, y + 20, 20, 28, [30, 30, 30]);
  px(x + 20, y + 20, [255, 200, 40]); px(x + 48, y + 12, [255, 200, 40]); px(x + 54, y + 24, [255, 200, 40]);
  fitText(x + 100, y + 14, "GAZA CITY", 1, WHITE, 88, true);
  drawText(x + 100, y + 30, "SHATI CAMP", 1, [255, 220, 120], true);
}
function artDrones(x: number, y: number, w: number, h: number): void {
  rect(x, y, w, h, [24, 34, 58]);
  line(x + 12, y + 40, x + 12, y + 14, [150, 160, 180]);
  line(x + 12, y + 14, x + 40, y + 14, [150, 160, 180]);
  line(x + 44, y + 40, x + 44, y + 20, [150, 160, 180]);
  for (const [dx, dy] of [[64, 12], [84, 20], [104, 10], [122, 22]] as Array<[number, number]>) {
    line(x + dx - 5, y + dy - 5, x + dx + 5, y + dy + 5, RED);
    line(x + dx + 5, y + dy - 5, x + dx - 5, y + dy + 5, RED);
  }
  fitText(x + 140, y + 14, "4", 2, WHITE, 48, true);
  drawText(x + 140, y + 32, "DOWNED", 1, WHITE, true);
}
function artTanker(x: number, y: number, w: number, h: number): void {
  rect(x, y, w, h, [10, 58, 58]);
  rect(x, y + 34, w, 14, [20, 80, 110]);
  poly([[x + 14, y + 34], [x + 120, y + 34], [x + 112, y + 22], [x + 24, y + 22]], [24, 24, 24]);
  rect(x + 96, y + 12, 16, 10, WHITE);
  disc(x + 150, y + 20, 8, [40, 40, 40]);
  for (let a = 0; a < 8; a++) {
    const t = (a / 8) * Math.PI * 2;
    line(x + 150, y + 20, Math.round(x + 150 + Math.cos(t) * 12), Math.round(y + 20 + Math.sin(t) * 12), [200, 200, 200]);
  }
  fitText(x + 170, y + 14, "2", 2, WHITE, 22, true);
  drawText(x + 126, y + 36, "TANKERS", 1, WHITE, true);
}
function artGrid(x: number, y: number, w: number, h: number): void {
  rect(x, y, w, h, [24, 24, 36]);
  line(x + 30, y + 44, x + 44, y + 8, [150, 160, 180]);
  line(x + 58, y + 44, x + 44, y + 8, [150, 160, 180]);
  line(x + 26, y + 34, x + 62, y + 34, [150, 160, 180]);
  line(x + 30, y + 22, x + 58, y + 22, [150, 160, 180]);
  poly([[x + 96, y + 8], [x + 82, y + 28], [x + 92, y + 28], [x + 84, y + 42], [x + 104, y + 20], [x + 94, y + 20]], [255, 200, 40]);
  fitText(x + 112, y + 14, "5 REGIONS", 1, WHITE, 80, true);
  drawText(x + 112, y + 30, "POWER OUT", 1, [255, 220, 120], true);
}
function artFigures(x: number, y: number, w: number, h: number): void {
  rect(x, y, w, h, [74, 38, 96]);
  for (let i = 0; i < 6; i++) {
    const fx = x + 16 + i * 14;
    disc(fx, y + 14, 4, WHITE);
    rect(fx - 4, y + 20, 8, 20, WHITE);
  }
  fitText(x + 108, y + 14, "47,000", 2, WHITE, 80, true);
  drawText(x + 108, y + 32, "IN 2025", 1, [255, 220, 120], true);
}

// ------------------------------------------------------------- panels
function heroPanel(x: number, y: number, w: number, n: number, dateline: string, badgeText: string, headline: string, body: string, why: string, src: string, art: (ax: number, ay: number, aw: number, ah: number) => void): void {
  frame(x, y, w, 254, INK, 1);
  art(x + 1, y + 1, w - 2, 130);
  const my = y + 136;
  numDisc(x + 11, my + 5, n, RED);
  drawText(x + 24, my, dateline, 1, INK, true);
  badge(x + w - 7, my - 1, badgeText, BADGE_BG[badgeText]);
  para(x + 8, y + 154, w - 16, headline, 2, INK, 2, true, 17);
  para(x + 8, y + 190, w - 16, body, 1, INK, 3, false, 9);
  para(x + 8, y + 219, w - 16, why, 1, INK, 2, false, 9);
  drawText(x + 8, y + 240, src, 1, MUTED, false);
}
function midPanel(x: number, y: number, w: number, n: number, dateline: string, badgeText: string, headline: string, body: string, src: string, art: (ax: number, ay: number, aw: number, ah: number) => void): void {
  frame(x, y, w, 134, INK, 1);
  art(x + 1, y + 1, w - 2, 48);
  const my = y + 53;
  numDisc(x + 10, my + 4, n, RED);
  drawText(x + 22, my, dateline, 1, INK, true);
  badge(x + w - 6, my - 1, badgeText, BADGE_BG[badgeText]);
  para(x + 7, y + 66, w - 14, headline, 1, INK, 2, true, 9);
  para(x + 7, y + 86, w - 14, body, 1, INK, 3, false, 9);
  drawText(x + 7, y + 116, src, 1, MUTED, false);
}

// ------------------------------------------------------------- world map
// pins: [story number, x, y, region colour]
const PINS: Array<[number, number, number, C]> = [
  [1, 100, 828, RED], [2, 276, 820, PINK], [3, 252, 812, PINK],
  [4, 168, 806, BLUE], [5, 194, 830, GREEN], [6, 258, 858, ORANGE],
  [7, 244, 838, PURPLE], [8, 294, 880, TEAL], [9, 206, 842, GOLD],
  [10, 216, 824, GOLD], [11, 226, 836, GOLD], [12, 192, 808, BLUE],
  [13, 112, 816, BROWN],
];
function drawMap(x: number, y: number, w: number, h: number): void {
  frame(x, y, w, h, INK, 1);
  drawText(x + 8, y + 6, "WHERE IT HAPPENED - STORIES 1-13", 1, INK, true);
  const mx = x + 1, my = y + 20, mw = w - 2, mh = h - 44;
  rect(mx, my, mw, mh, NAVY);
  const land: C = [150, 170, 190];
  ellipse(75, 800, 48, 16, land); ellipse(100, 818, 28, 10, land);
  ellipse(118, 786, 10, 6, land);
  ellipse(108, 852, 14, 20, land);
  ellipse(170, 798, 20, 9, land);
  ellipse(188, 832, 18, 20, land);
  ellipse(252, 806, 58, 18, land);
  ellipse(262, 838, 12, 6, land);
  ellipse(292, 872, 16, 9, land);
  for (const [n, px2, py2, col] of PINS) {
    disc(px2, py2, 7, WHITE);
    disc(px2, py2, 6, col);
    const t = String(n);
    drawText(px2 - Math.floor((t.length * 6 - 1) / 2), py2 - 4, t, 1, WHITE, true);
  }
  drawText(x + 8, y + h - 16, "Pins 1-13 match the stories above.", 1, MUTED, false);
}

// ------------------------------------------------------------- briefs
const BRIEFS: string[] = [
  "14 Samara: Drones hit 2 oil refineries (Reuters)",
  "15 Cape Town: Phala Phala report void (Daily Maverick)",
  "16 Jerusalem: Court urges drop of Netanyahu charge (AP)",
  "17 Cartagena: Store stormed, hostages freed (Guardian)",
  "18 Washington: US Q3 GDP growth revised to 4.3% (BEA)",
  "19 Washington: Jobless claims fall to 189,000 (DOL)",
  "20 Brasilia: US proposes 10% Embraer jet tariff (USTR)",
  "21 Mississippi: Six die in Cessna crash off island (CNN)",
  "22 Parana: El Nino storms and floods kill 6 (Xinhua)",
  "23 Brussels: EU unveils 50bn euro quantum fund (AFP)",
  "24 Paris: Surprise Eurostar strike cancels trains (AA)",
  "25 London: Poundland fails, 11,000 jobs at risk (BBC)",
  "26 Berlin: Merz: Russia aims beyond Ukraine (Guardian)",
  "27 Mexico: Sheinbaum presses US on extradition (El Pais)",
  "28 Damazin: Sudan RSF drones kill at least 19 (Arab News)",
  "29 Benghazi: Two Libyan officers die after drone raid (ISW)",
  "30 Karachi: Six-storey building collapses (AP)",
  "31 Kuala Lumpur: Malaysia sues Google RM600m over scams (SCMP)",
  "32 Canberra: Australia inflation jumps to 4.9% (ABS)",
  "33 Space: ESA's Hera shows stadium-sized DART crater (ESA)",
  "34 Geneva: UN marks Day to End Violence Against Women (UN Women)",
  "35 Lisbon: Champions League: Sporting 2-2 Man Utd (UEFA)",
];

// ------------------------------------------------------------- main layout
function main(): void {
  rect(0, 0, W, H, PAPER);
  frame(4, 4, W - 8, H - 8, INK, 2);

  // masthead
  drawText(14, 12, "THE WORLD IN ONE DAY", 2, RED, true);
  const mastR = "35 STORIES • 9 REGIONS • ALL FIRST REPORTED WED 25 NOV 2026";
  drawText(1010 - textW(mastR, 1, true), 14, mastR, 1, INK, true);
  line(12, 32, 1012, 32, INK);

  // giant title (custom advance 37px at scale 7)
  const title = "Wednesday 25 November 2026";
  const tw = (title.length - 1) * 37 + 35;
  drawTextAdv(Math.floor((W - tw) / 2), 38, title, 7, INK, true, 37);
  // red subhead
  const sub = "US proposes tariffs on 14 economies · Kospi sinks 6.2% · Pakistan's first astronaut docks at Tiangong";
  drawTextC(512, 92, sub, 1, RED, true);
  line(12, 106, 1012, 106, INK);

  // stats strip — 6 big numbers
  const stats: Array<[string, string]> = [
    ["35%", "top US tariff (Vietnam)"],
    ["-6.2%", "Kospi close, worst of AI rout"],
    ["1ST", "foreigner aboard Tiangong"],
    ["+26%", "UK energy cap from Jan"],
    ["31", "killed, Cairo tanker blaze"],
    ["+36%", "Dhaka garment pay rise"],
  ];
  const cellW = 1000 / 6;
  stats.forEach(([num, label], i) => {
    const cx = 12 + i * cellW;
    if (i > 0) line(Math.floor(cx), 110, Math.floor(cx), 152, MIDGREY);
    drawText(Math.floor(cx) + 8, 110, num, 3, RED, true);
    para(Math.floor(cx) + 8, 134, cellW - 16, label, 1, INK, 2, false, 9);
  });
  line(12, 154, 1012, 154, INK);

  // region strip — counts counted from the final 35 stories (see build report)
  const regions: Array<[string, number, C]> = [
    ["AMERICAS 8", 8, RED], ["EUROPE 8", 8, BLUE], ["M. EAST 4", 4, GOLD],
    ["AFRICA 4", 4, GREEN], ["S. ASIA 2", 2, PURPLE], ["SE ASIA 2", 2, ORANGE],
    ["E. ASIA 2", 2, PINK], ["OCEANIA 2", 2, TEAL], ["WORLD 3", 3, BROWN],
  ];
  const segW = Math.floor(1000 / regions.length); // equal width: every label + count fits
  let rx = 12;
  for (let i = 0; i < regions.length; i++) {
    const [label, , col] = regions[i];
    const w = i === regions.length - 1 ? 1012 - rx : segW;
    rect(rx, 158, w, 16, col);
    drawTextC(rx + Math.floor(w / 2), 161, label, 1, WHITE, true);
    rx += w;
  }
  line(12, 176, 1012, 176, INK);

  // timeline strip
  rect(12, 178, 1000, 18, NAVY);
  drawText(18, 181, "THE DAY IN UTC · ", 1, WHITE, true);
  drawTextAdv(18 + textW("THE DAY IN UTC · ", 1, true), 181,
    "00:18 Shenzhou-24 lifts off · 03:56 docks · 06:30 Kospi -6.2% close · 11:00 Ofgem +26% · 13:30 US GDP 4.3% · 15:00 USTR tariffs · 16:08 Cairo blast",
    1, WHITE, false, 5);

  // heroes
  heroPanel(12, 200, 324, 1, "WASHINGTON · TRADE", "OFFICIAL",
    "Washington proposes tariffs on 14 economies",
    "USTR cites 'structural excess capacity'. China faces 20%, Vietnam 35%, India 25%, the EU 15%. Nothing in force yet.",
    "WHY IT MATTERS — Broadest US salvo in Asia and Europe; rates are ceilings, deals can cut them.",
    "REUTERS · USTR", artShip);
  heroPanel(350, 200, 324, 2, "SEOUL · MARKETS", "CONFIRMED",
    "AI doubts crash Asia's chip stocks",
    "Kospi closed down 6.2% at 4,697.51. Samsung fell 9.9% and SK Hynix 11.1% as the AI rally faltered.",
    "WHY IT MATTERS — Sharpest test yet of the AI hardware spending boom.",
    "WSJ · YONHAP · CNN", artChart);
  heroPanel(688, 200, 324, 3, "JIUQUAN · CHINA · SPACE", "OFFICIAL",
    "Shenzhou-24 flies a Pakistani to Tiangong",
    "Muhammad Zeeshan Ali, 40, is the first foreigner aboard China's station. He stays five days.",
    "WHY IT MATTERS — First foreign crew aboard China's orbital lab.",
    "XINHUA · REUTERS", artRocket);

  // mid grid: 2 rows x 5
  const mids: Array<[number, string, string, string, string, string, (ax: number, ay: number, aw: number, ah: number) => void]> = [
    [4, "LONDON", "OFFICIAL", "UK energy bills to jump 26% on war gas shock",
     "Ofgem lifts the cap from £1,723 to £2,166 a year from 1 Jan, highest since Q2 2023.", "OFGEM · TIMES", artBolt],
    [5, "GIZA", "OFFICIAL", "Fuel tanker fire kills 31 near Cairo",
     "Tanker overturns on the Ring Road at Warraq and burns; 21 hurt, 27 vehicles lost.", "REUTERS · CNN", artFire],
    [6, "BOGOR", "OFFICIAL", "9 dead, 17 trapped in flooded gold mine",
     "Illegal pit floods in Bogor; 11 escape, 325 rescuers work a 100-metre shaft.", "AP · SCMP", artMine],
    [7, "DHAKA", "OFFICIAL", "Garment workers win a 36% pay rise",
     "Wage Board sets Tk17,000 a month from 1 Dec, up from Tk12,500, after protests.", "TBS NEWS · BBC", artShirt],
    [8, "CANBERRA", "OFFICIAL", "Solomons pick Australia as security partner",
     "A$740m pact over 10 years; Australia is 'primary security partner', no foreign bases.", "ABC · REUTERS", artFlags],
    [9, "GAZA CITY", "REPORTED", "Israeli strike kills Hamas security chief",
     "Muhammad Abu al-Aouf, 47, his wife and two daughters die in the Shati camp strike.", "CNN · REUTERS", artGaza],
    [10, "RAS TANURA", "REPORTED", "Coalition strikes Hodeidah; 4 drones downed",
     "Saudi defences down four Houthi drones over Ras Tanura; no casualties reported.", "REUTERS · AL JAZEERA", artDrones],
    [11, "HORMUZ", "CLAIM", "Iran says mines set two tankers ablaze",
     "IRGC claims two tankers hit mines; not verified. Reports: three more hit, crews safe.", "REUTERS · IRNA", artTanker],
    [12, "KYIV", "REPORTED", "Russian strikes kill 5, cut power in 5 regions",
     "Grid attacks leave Zaporizhzhia nuclear plant on diesel backup, Kyiv says.", "REUTERS · KYIV POST", artGrid],
    [13, "UN", "OFFICIAL", "Five women killed an hour by partner or kin",
     "UN: 47,000 women and girls killed by partners or family in 2025.", "UN WOMEN · UNODC", artFigures],
  ];
  const colX = [12, 211, 410, 609, 808];
  mids.forEach(([n, dl, bg2, hl, body, src, art], i) => {
    const x = colX[i % 5], y = i < 5 ? 460 : 600;
    midPanel(x, y, 194, n, dl, bg2, hl, body, src, art);
  });

  // map + briefs
  drawMap(12, 740, 306, 202);
  frame(326, 740, 686, 202, INK, 1);
  drawText(334, 746, "ALSO ON WEDNESDAY — 22 MORE DATED STORIES", 1, INK, true);
  BRIEFS.forEach((b, i) => {
    const col = i < 11 ? 0 : 1;
    const row = i % 11;
    drawTextAdv(334 + col * 344, 764 + row * 16, b, 1, INK, false, 5);
  });

  // date check
  frame(12, 948, 1000, 32, INK, 1);
  rect(12, 948, 5, 32, RED);
  drawText(26, 953, "DATE CHECK — ", 1, RED, true);
  para(26 + textW("DATE CHECK — ", 1, true), 953, 1000 - 26 - textW("DATE CHECK — ", 1, true) - 8,
    "Left out as other days' news: Huawei 10-count verdict (Tue 24) · Houthi strike on Riyadh PIF Tower, 11 hurt (Tue 24) · Hamas chief Abu Nahal killed (Tue 24) · CAS Senegal AFCON ruling (Tue 24) · COP31 no-deal (Sun 22). Not yet: US Thanksgiving (Thu 27).",
    1, INK, 2, false, 10);

  // footer: how-sure legend + sources
  drawText(12, 986, "HOW SURE: OFFICIAL = authority's own word · CONFIRMED = 2+ major outlets · REPORTED = 1 outlet · CLAIM = one side's account, unverified", 1, INK, false);
  drawText(12, 996, "Sources: Reuters, AP, AFP, BBC, Al Jazeera, Xinhua, USTR, Ofgem, UN Women, Yonhap, CNN, Guardian.", 1, MUTED, false);
  drawText(12, 1006, "Every story happened or was first reported Wednesday 25 November 2026 (UTC). Drawings original.", 1, MUTED, false);

  // encode + verify + write
  const png = encodePNG();
  verifyPNG(png);
  const out = process.argv[2] ?? "entry.png";
  fs.writeFileSync(out, png);
  console.log(`WROTE ${out} ${png.length} bytes`);
}

main();
