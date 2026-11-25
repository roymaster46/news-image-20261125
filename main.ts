// news-image-20261125 — entry program.
//
// Writes the front page image for Wednesday 25 November 2026 to
// $MAKEFUN_OUTPUT_DIR/entry.png. The image is bundled in this repository
// as entry.png; this program verifies it and copies it, byte for byte.
// Node 22, standard library only, no network, fully deterministic.
import { createHash } from "node:crypto";
import { copyFileSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const SRC = join(HERE, "entry.png");
const OUT_DIR = process.env.MAKEFUN_OUTPUT_DIR || join(HERE, "out");
const OUT = join(OUT_DIR, "entry.png");

const MAX_BYTES = 1048576; // 1 MiB
const PNG_SIG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

function fail(msg) {
  console.error(`news-image-20261125: ${msg}`);
  process.exit(1);
}

const buf = readFileSync(SRC);
if (buf.length > MAX_BYTES) fail(`entry.png is ${buf.length} bytes, over the 1 MiB limit`);
if (buf.length < 8 || !buf.subarray(0, 8).equals(PNG_SIG)) {
  fail("entry.png is not a PNG file");
}

// IHDR must be the first chunk: 1024x1024, 8-bit, colour type 2 (truecolour RGB).
const ihdrLen = buf.readUInt32BE(8);
const ihdrType = buf.toString("latin1", 12, 16);
if (ihdrLen !== 13 || ihdrType !== "IHDR") fail("first chunk is not a 13-byte IHDR");
const width = buf.readUInt32BE(16);
const height = buf.readUInt32BE(20);
const bitDepth = buf[24];
const colourType = buf[25];
if (width !== 1024 || height !== 1024) fail(`image is ${width}x${height}, must be 1024x1024`);
if (bitDepth !== 8 || colourType !== 2) {
  fail(`image must be 8-bit RGB, got bit depth ${bitDepth}, colour type ${colourType}`);
}

// CRC-32 (PNG polynomial) over a chunk's type + data, compared with the
// stored CRC that follows the data. Walks every chunk from IHDR to IEND
// so a corrupt or truncated file is rejected instead of copied.
const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();
function crc32(bytes) {
  let c = 0xffffffff;
  for (const b of bytes) c = CRC_TABLE[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

let off = 8;
let sawIEND = false;
while (off + 12 <= buf.length) {
  const len = buf.readUInt32BE(off);
  const type = buf.toString("latin1", off + 4, off + 8);
  if (off + 12 + len > buf.length) fail(`chunk ${type} is truncated`);
  const stored = buf.readUInt32BE(off + 8 + len);
  const actual = crc32(buf.subarray(off + 4, off + 8 + len));
  if (stored !== actual) fail(`chunk ${type} has a bad CRC`);
  off += 12 + len;
  if (type === "IEND") {
    sawIEND = true;
    break;
  }
}
if (!sawIEND) fail("entry.png has no IEND trailer");
if (off !== buf.length) fail("trailing bytes after the IEND chunk");

mkdirSync(OUT_DIR, { recursive: true });
copyFileSync(SRC, OUT);

// Verify the copy byte for byte.
const copy = readFileSync(OUT);
const sha = (b) => createHash("sha256").update(b).digest("hex");
if (sha(copy) !== sha(buf)) fail("output differs from entry.png");
if (statSync(OUT).size !== buf.length) fail("output size differs from entry.png");

console.log(`wrote ${OUT} (${buf.length} bytes, sha256 ${sha(buf).slice(0, 16)}…)`);
