#!/usr/bin/env node
// stories/render.js
// Render Instagram story images (1080x1920) from the layouts in stories/stories.js.
//
//   node stories/render.js            # all stories
//   node stories/render.js tilt-nikita core-sl3   # only these slugs

const fs = require("fs");
const path = require("path");
const puppeteer = require("puppeteer");
const sharp = require("sharp");

const ROOT = path.join(__dirname, "..");
const BUILD = path.join(__dirname, ".build");
const OUT = path.join(__dirname, "out");
const W = 1080, H = 1920;

const esc = s => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

// Cut the white margins off a product photo so x/y/width place the product itself
async function trimmed(src) {
  const abs = path.resolve(ROOT, src);
  const out = path.join(BUILD, `${path.basename(abs, path.extname(abs))}-trim.png`);
  if (!fs.existsSync(out)) await sharp(abs).trim({ background: "#ffffff", threshold: 20 }).png().toFile(out);
  return out;
}

// Red starburst with a thin white zigzag inside, like the shop's existing stories
function starburst(points, outer, inner, cx, cy) {
  const pts = [];
  for (let i = 0; i < points * 2; i++) {
    const r = i % 2 === 0 ? outer : inner;
    const a = (Math.PI * i) / points - Math.PI / 2;
    pts.push(`${(cx + r * Math.cos(a)).toFixed(1)},${(cy + r * Math.sin(a)).toFixed(1)}`);
  }
  return pts.join(" ");
}

function badge({ price, from, x = 805, y = 860, size = 450, rotate = -12 }) {
  const [whole, cents = "00"] = String(price).split(/[.,]/);
  const r = size / 2;
  return `
  <div class="badge" style="left:${x - r}px; top:${y - r}px; width:${size}px; height:${size}px; transform:rotate(${rotate}deg)">
    <svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
      <polygon points="${starburst(22, r, r * 0.86, r, r)}" fill="#e0121b"/>
      <polygon points="${starburst(22, r * 0.86, r * 0.75, r, r)}" fill="none" stroke="#fff" stroke-width="3" stroke-linejoin="miter"/>
    </svg>
    <div class="price">
      <div class="fit" data-max="${Math.round(size * 0.76)}">
        ${from ? `<div class="from">${esc(from)}</div>` : ""}
        <div class="row">
          <span class="whole">${esc(whole)}</span>
          <span class="side"><span class="cents">${esc(cents)}</span><span class="lei">LEI</span></span>
        </div>
      </div>
    </div>
  </div>`;
}

// A product photo centred on (x, y), `width` px wide, rotated by `rotate` degrees
function image(img, file) {
  const flip = img.flip ? " scaleX(-1)" : "";
  return `<img class="product" src="file://${file}" style="left:${img.x}px; top:${img.y}px; width:${img.width}px;
    transform:translate(-50%,-50%) rotate(${img.rotate || 0}deg)${flip}; z-index:${img.z || 1}">`;
}

// A black pill with white text (e.g. "PRE-ORDER"), anchored on its left edge at (x, y)
function tag(t) {
  return `<div class="tag" style="left:${t.x ?? 60}px; top:${t.y ?? 730}px; font-size:${t.size || 50}px;
    transform:translate(0,-50%) rotate(${t.rotate ?? -4}deg)">${esc(t.text)}</div>`;
}

// "TAP TO SHOP" + an arrow pointing down at where the link sticker will be placed.
// The text has a white backing so it stays readable where the sticker overlaps a product.
function pointer(spot, text) {
  const h = Math.round(spot.w * 0.2);
  const top = spot.y - h / 2;
  return `
  <div class="pointer" style="left:${spot.x}px; top:${top - 62}px">${esc(text)}</div>
  <svg class="dim" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
    <line x1="${spot.x}" y1="${top - 38}" x2="${spot.x}" y2="${top - 18}" stroke="#000" stroke-width="6"/>
    <polygon points="${spot.x - 14},${top - 22} ${spot.x + 14},${top - 22} ${spot.x},${top - 4}" fill="#000"/>
  </svg>`;
}

// Mock Instagram link sticker, only for previews (Instagram adds the real one)
function mockSticker(spot, url) {
  const h = Math.round(spot.w * 0.2);
  const host = new URL(url).hostname.replace(/^www\./, "").toUpperCase();
  return `<div class="mock" style="left:${spot.x - spot.w / 2}px; top:${spot.y - h / 2}px; width:${spot.w}px; height:${h}px; font-size:${Math.round(h * 0.34)}px">🔗 ${esc(host)}</div>`;
}

// Text written along a product, e.g. a colour name, centred on (x, y)
function label(l) {
  const anchor = l.align === "left" ? "translate(0,-50%)" : "translate(-50%,-50%)";
  return `<div class="label" style="left:${l.x}px; top:${l.y}px; font-size:${l.size || 64}px; color:${l.color || "#000"};
    transform:${anchor} rotate(${l.rotate || 0}deg); transform-origin:${l.align === "left" ? "left center" : "center"}">${esc(l.text)}</div>`;
}

// A double-headed measurement arrow from (x1,y1) to (x2,y2) with its text alongside
function dim(d) {
  const color = d.color || "#000";
  const dx = d.x2 - d.x1, dy = d.y2 - d.y1;
  const len = Math.hypot(dx, dy);
  let angle = (Math.atan2(dy, dx) * 180) / Math.PI;
  const mx = (d.x1 + d.x2) / 2, my = (d.y1 + d.y2) / 2;
  // Keep the text upright, and put it on the requested side of the line
  if (angle > 90) angle -= 180;
  if (angle < -90) angle += 180;
  const offset = d.textOffset ?? -34;
  const nx = (-Math.sin((angle * Math.PI) / 180)) * -offset, ny = Math.cos((angle * Math.PI) / 180) * offset;
  // textX/textY/textAngle override where the text goes (e.g. level text next to an upright arrow)
  const tx = d.textX ?? mx + nx, ty = d.textY ?? my + ny, ta = d.textAngle ?? angle;
  const head = 26;
  const ux = dx / len, uy = dy / len;
  const arrow = (px, py, sx, sy) =>
    `<polygon points="${px},${py} ${px - sx * head - sy * head * 0.55},${py - sy * head + sx * head * 0.55} ${px - sx * head + sy * head * 0.55},${py - sy * head - sx * head * 0.55}" fill="${color}"/>`;
  return `
  <svg class="dim" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
    <line x1="${d.x1 + ux * head * 0.6}" y1="${d.y1 + uy * head * 0.6}" x2="${d.x2 - ux * head * 0.6}" y2="${d.y2 - uy * head * 0.6}" stroke="${color}" stroke-width="7"/>
    ${arrow(d.x2, d.y2, ux, uy)}${arrow(d.x1, d.y1, -ux, -uy)}
  </svg>
  <div class="dimtext" style="left:${tx}px; top:${ty}px; color:${color}; font-size:${d.size || 42}px;
    transform:translate(-50%,-50%) rotate(${ta}deg)">${esc(d.text)}</div>`;
}

async function html(story, { preview = false } = {}) {
  const imgs = [];
  for (const img of story.images || []) imgs.push(image(img, await trimmed(img.src)));
  return `<!doctype html>
<html><head><meta charset="utf-8">
<link href="https://fonts.googleapis.com/css2?family=Lato:wght@300;400;700;900&display=block" rel="stylesheet">
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  html, body { width: ${W}px; height: ${H}px; overflow: hidden; background: #fff; }
  body { position: relative; font-family: "Lato", sans-serif; -webkit-font-smoothing: antialiased; }
  .head { position: absolute; left: 0; right: 0; text-align: center; z-index: 5; }
  .brand { top: ${story.brandTop ?? 288}px; font-weight: 900; font-size: ${story.brandSize ?? 232}px; line-height: 1; letter-spacing: 0.3em; padding-left: 0.3em; }
  .title { top: ${story.titleTop ?? 518}px; font-weight: 300; font-size: 56px; line-height: 1; letter-spacing: 0.55em; padding-left: 0.55em; white-space: nowrap; }
  .sub { top: ${story.subTop ?? 594}px; font-weight: 400; font-size: 34px; line-height: 1; letter-spacing: 0.5em; padding-left: 0.5em; white-space: nowrap; }
  .product { position: absolute; mix-blend-mode: multiply; }
  .label { position: absolute; font-weight: 900; letter-spacing: 0.14em; white-space: nowrap; z-index: 3; }
  .dim { position: absolute; left: 0; top: 0; z-index: 3; }
  .dimtext { position: absolute; font-weight: 700; white-space: nowrap; z-index: 3; }
  .badge { position: absolute; z-index: 6; }
  .pointer { position: absolute; z-index: 7; transform: translateX(-50%); background: #fff; padding: 4px 14px 2px calc(14px + 0.14em);
             border-radius: 10px; font-weight: 900; font-size: 34px; letter-spacing: 0.14em; white-space: nowrap; line-height: 1.1; }
  .mock { position: absolute; z-index: 8; background: #fff; border-radius: 14px; box-shadow: 0 2px 10px rgba(0,0,0,.25);
          display: flex; align-items: center; justify-content: center; font-family: -apple-system, Helvetica, sans-serif;
          font-weight: 700; color: #3a7bf0; letter-spacing: 0.02em; }
  .tag { position: absolute; z-index: 6; background: #000; color: #fff; font-weight: 900; letter-spacing: 0.12em;
         padding: 14px 30px 14px calc(30px + 0.12em); border-radius: 12px; white-space: nowrap; transform-origin: left center; }
  .badge svg { position: absolute; left: 0; top: 0; }
  .price { position: absolute; inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; color: #fff; font-weight: 900; }
  .price .fit { display: flex; flex-direction: column; align-items: center; transform-origin: center; }
  .price .from { font-size: 42px; letter-spacing: 0.14em; padding-left: 0.14em; line-height: 1; margin-bottom: 8px; }
  .price .row { display: flex; align-items: flex-start; }
  .price .whole { font-size: 168px; line-height: 0.74; letter-spacing: -0.05em; }
  .price .side { display: flex; flex-direction: column; align-items: flex-start; margin-left: 6px; }
  .price .cents { font-size: 74px; line-height: 0.74; }
  .price .lei { font-size: 64px; line-height: 0.74; margin-top: 12px; margin-left: -2px; }
</style></head>
<body>
  <div class="head brand"><span>${esc(story.brand)}</span></div>
  <div class="head title"><span>${esc(story.title)}</span></div>
  ${story.subtitle ? `<div class="head sub"><span>${esc(story.subtitle)}</span></div>` : ""}
  ${imgs.join("\n")}
  ${(story.labels || []).map(label).join("\n")}
  ${(story.dims || []).map(dim).join("\n")}
  ${badge(story.badge)}
  ${story.tag ? tag(typeof story.tag === "string" ? { text: story.tag } : story.tag) : ""}
  ${story.linkSpot ? pointer(story.linkSpot, story.pointerText || "TAP TO SHOP") : ""}
  ${preview && story.linkSpot && story.link ? mockSticker(story.linkSpot, story.link) : ""}
  <script>
    // Long product names: tighten the letter spacing until the text fits the width
    for (const el of document.querySelectorAll(".brand, .title, .sub")) {
      const text = el.querySelector("span");
      let ls = parseFloat(getComputedStyle(el).letterSpacing) / parseFloat(getComputedStyle(el).fontSize);
      while (text.getBoundingClientRect().width > ${W - 120} && ls > 0.12) {
        ls -= 0.02;
        el.style.letterSpacing = ls + "em";
        el.style.paddingLeft = ls + "em";
      }
      // Still too wide (long brand names): make the text smaller
      let size = parseFloat(getComputedStyle(el).fontSize);
      while (text.getBoundingClientRect().width > ${W - 120} && size > 20) {
        size -= 2;
        el.style.fontSize = size + "px";
      }
    }
    // Price: shrink the number block until it fits inside the starburst
    for (const block of document.querySelectorAll(".price .fit")) {
      const max = parseFloat(block.dataset.max);
      const w = block.getBoundingClientRect().width;
      if (w > max) block.style.transform = "scale(" + (max / w) + ")";
    }
  </script>
</body></html>`;
}

async function main() {
  const only = process.argv.slice(2);
  delete require.cache[require.resolve("./stories")];
  const stories = require("./stories").filter(s => !only.length || only.includes(s.slug));
  if (!stories.length) throw new Error(`No stories match: ${only.join(", ")}`);
  fs.mkdirSync(BUILD, { recursive: true });
  fs.mkdirSync(OUT, { recursive: true });

  const browser = await puppeteer.launch({ headless: true });
  try {
    const page = await browser.newPage();
    await page.setViewport({ width: W, height: H, deviceScaleFactor: 1 });
    for (const story of stories) {
      const file = path.join(BUILD, `${story.slug}.html`);
      fs.writeFileSync(file, await html(story));
      await page.goto(`file://${file}`, { waitUntil: "networkidle0" });
      await page.evaluate(() => document.fonts.ready);
      const out = path.join(OUT, `${story.slug}.png`);
      await page.screenshot({ path: out, clip: { x: 0, y: 0, width: W, height: H } });
      console.log(`🖼  ${path.relative(process.cwd(), out)}`);

      if (story.linkSpot && story.link) {
        fs.mkdirSync(path.join(OUT, "preview"), { recursive: true });
        const pfile = path.join(BUILD, `${story.slug}-preview.html`);
        fs.writeFileSync(pfile, await html(story, { preview: true }));
        await page.goto(`file://${pfile}`, { waitUntil: "networkidle0" });
        await page.evaluate(() => document.fonts.ready);
        await page.screenshot({ path: path.join(OUT, "preview", `${story.slug}.png`), clip: { x: 0, y: 0, width: W, height: H } });
      }
    }
  } finally {
    await browser.close();
  }

  // Which product page each story's link sticker should point to
  const all = require("./stories");
  const lines = all.filter(s => s.link).map(s => `${s.slug}.png  ->  ${s.link}`);
  fs.writeFileSync(path.join(OUT, "links.txt"), lines.join("\n") + "\n");
}

main().catch(err => {
  console.error(`❌ ${err.message}`);
  process.exit(1);
});
