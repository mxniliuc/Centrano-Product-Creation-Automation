// lib/images.js
// Download product images and normalise them to 2048x2048 JPEGs on white.
const fs = require("fs");
const path = require("path");
const sharp = require("sharp");

async function processImage(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status} fetching ${url}`);
  const input = Buffer.from(await res.arrayBuffer());

  return sharp(input)
    .flatten({ background: { r: 255, g: 255, b: 255 } })
    .resize(2048, 2048, { fit: "contain", background: { r: 255, g: 255, b: 255 } })
    .jpeg({ quality: 95, chromaSubsampling: "4:4:4" })
    .toBuffer();
}

// Returns [{ sourceUrl, filename, path, buffer }] for every image that processed OK.
// Failed images are logged and skipped.
async function processImages(urls, outDir, baseName) {
  fs.mkdirSync(outDir, { recursive: true });
  const out = [];
  for (let i = 0; i < urls.length; i++) {
    try {
      const buffer = await processImage(urls[i]);
      const filename = `${baseName}-${i + 1}.jpg`;
      const filePath = path.join(outDir, filename);
      fs.writeFileSync(filePath, buffer);
      out.push({ sourceUrl: urls[i], filename, path: filePath, buffer });
    } catch (err) {
      console.warn(`   ⚠️  Skipping image ${urls[i]}: ${err.message}`);
    }
  }
  return out;
}

module.exports = { processImages };
