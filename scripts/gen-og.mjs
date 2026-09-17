import { writeFileSync } from "node:fs";

// One-off: generate a 1200x630 placeholder og-cover.png with zero deps.
// Hand-rolled uncompressed PNG: storm-teal gradient background is approximated
// with per-row fill colors; overlay is kept minimal (no text — parsers cache
// images, text needs real font rendering). The user should replace this with
// a designed cover before going viral-facing; this one is valid & on-brand.

const W = 1200, H = 630;

// Storm-teal vertical gradient (matches the site's Aurora palette).
function lerp(a, b, t) { return Math.round(a + (b - a) * t); }
const stops = [
  [4, 18, 26],   // #04121b top
  [10, 31, 44],  // #0a1f2c mid
  [6, 24, 34],   // #061822 lower
  [3, 13, 21],   // #030d15 bottom
];
function rowColor(y) {
  const t = y / (H - 1);
  const seg = Math.min(stops.length - 2, Math.floor(t * (stops.length - 1)));
  const local = t * (stops.length - 1) - seg;
  const [r1, g1, b1] = stops[seg];
  const [r2, g2, b2] = stops[seg + 1];
  return [lerp(r1, r2, local), lerp(g1, g2, local), lerp(b1, b2, local)];
}

// Subtle radial glow toward top-center (teal, like the site hero glow).
function glow(x, y) {
  const cx = W / 2, cy = H * 0.28;
  const d = Math.sqrt(((x - cx) / (W * 0.55)) ** 2 + ((y - cy) / (H * 0.6)) ** 2);
  const intensity = Math.max(0, 1 - d) * 0.18;
  return intensity;
}

// Build raw RGB rows.
const raw = Buffer.alloc(H * (1 + W * 3));
let off = 0;
for (let y = 0; y < H; y++) {
  raw[off++] = 0; // filter type 0 (none)
  for (let x = 0; x < W; x++) {
    let [r, g, b] = rowColor(y);
    const gl = glow(x, y);
    r = lerp(r, 125, gl); g = lerp(g, 211, gl); b = lerp(b, 200, gl);
    raw[off++] = r; raw[off++] = g; raw[off++] = b;
  }
}

// PNG encoding (no compression — stored deflate blocks).
function crc32(buf) {
  let table = crc32.table;
  if (!table) {
    table = crc32.table = new Int32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      table[n] = c;
    }
  }
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = table[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}
const ihdr = Buffer.alloc(13);
ihdr.writeUInt32BE(W, 0); ihdr.writeUInt32BE(H, 4);
ihdr[8] = 8; ihdr[9] = 2; // 8-bit, truecolor RGB

// Real deflate via node zlib (keeps the file small for fast link unfurls).
const { deflateSync } = await import("node:zlib");
const idat = deflateSync(raw, { level: 9 });

const png = Buffer.concat([
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  chunk("IHDR", ihdr),
  chunk("IDAT", idat),
  chunk("IEND", Buffer.alloc(0)),
]);

writeFileSync("public/og-cover.png", png);
console.log(`wrote public/og-cover.png (${(png.length / 1024).toFixed(0)} KB, ${W}x${H})`);
