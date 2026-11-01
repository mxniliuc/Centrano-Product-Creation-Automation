// feed/cutout.js
// Cut a product photo out of its white studio background so it can sit on any backdrop.
// Flood-fills the white from the image border (so white parts inside the product stay),
// also clears large pure-white pockets the fill can't reach (wheel cores, deck cut-outs),
// then feathers the edge and trims to the product.

const fs = require("fs");
const path = require("path");
const sharp = require("sharp");

const CACHE = path.join(__dirname, ".build", "cutouts");

const isWhite = (d, i, min) => d[i] >= min && d[i + 1] >= min && d[i + 2] >= min;

async function cutout(src) {
  const out = path.join(CACHE, path.basename(src).replace(/\.\w+$/, ".png"));
  if (fs.existsSync(out) && fs.statSync(out).mtimeMs > fs.statSync(src).mtimeMs) return out;

  const { data, info } = await sharp(src).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width: w, height: h } = info;
  const n = w * h;
  const bg = new Uint8Array(n); // 1 = background

  // 1. flood fill near-white pixels connected to the border
  const stack = [];
  const seed = p => { if (!bg[p] && isWhite(data, p * 3, 238)) { bg[p] = 1; stack.push(p); } };
  for (let x = 0; x < w; x++) { seed(x); seed((h - 1) * w + x); }
  for (let y = 0; y < h; y++) { seed(y * w); seed(y * w + w - 1); }
  while (stack.length) {
    const p = stack.pop();
    const x = p % w, y = (p - x) / w;
    if (x > 0) seed(p - 1);
    if (x < w - 1) seed(p + 1);
    if (y > 0) seed(p - w);
    if (y < h - 1) seed(p + w);
  }

  // 2. enclosed pockets: pure white regions big enough to be background showing through
  const seen = new Uint8Array(n);
  const minPocket = Math.round(n * 0.0004);
  for (let s = 0; s < n; s++) {
    if (bg[s] || seen[s] || !isWhite(data, s * 3, 250)) continue;
    const region = [s];
    seen[s] = 1;
    for (let k = 0; k < region.length; k++) {
      const p = region[k];
      const x = p % w, y = (p - x) / w;
      for (const q of [x > 0 && p - 1, x < w - 1 && p + 1, y > 0 && p - w, y < h - 1 && p + w]) {
        if (q !== false && !seen[q] && !bg[q] && isWhite(data, q * 3, 250)) { seen[q] = 1; region.push(q); }
      }
    }
    if (region.length >= minPocket) for (const p of region) bg[p] = 1;
  }

  // 3. alpha: opaque product, transparent background, light edge pixels partly see-through
  const alpha = Buffer.alloc(n);
  for (let p = 0; p < n; p++) {
    if (bg[p]) continue;
    const x = p % w, y = (p - x) / w;
    const edge = (x > 0 && bg[p - 1]) || (x < w - 1 && bg[p + 1]) || (y > 0 && bg[p - w]) || (y < h - 1 && bg[p + w]);
    if (!edge) { alpha[p] = 255; continue; }
    const m = Math.min(data[p * 3], data[p * 3 + 1], data[p * 3 + 2]);
    alpha[p] = Math.max(0, Math.min(255, Math.round((255 - m) * 255 / 60)));
  }
  const soft = await sharp(alpha, { raw: { width: w, height: h, channels: 1 } })
    .blur(0.8).extractChannel(0).raw().toBuffer();

  // 4. crop to the product
  let left = w, top = h, right = 0, bottom = 0;
  for (let p = 0; p < n; p++) {
    if (soft[p] < 8) continue;
    const x = p % w, y = (p - x) / w;
    if (x < left) left = x;
    if (x > right) right = x;
    if (y < top) top = y;
    if (y > bottom) bottom = y;
  }

  const rgba = Buffer.alloc(n * 4);
  for (let p = 0; p < n; p++) {
    data.copy(rgba, p * 4, p * 3, p * 3 + 3);
    rgba[p * 4 + 3] = soft[p];
  }

  fs.mkdirSync(CACHE, { recursive: true });
  await sharp(rgba, { raw: { width: w, height: h, channels: 4 } })
    .extract({ left, top, width: right - left + 1, height: bottom - top + 1 })
    .png()
    .toFile(out);
  return out;
}

module.exports = { cutout };
