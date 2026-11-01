#!/usr/bin/env node
// feed/render.js
// Render the product carousels for feed posts (1080x1350, 4:5) from feed/posts.js.
//
//   node feed/render.js               # every post
//   node feed/render.js tilt-decks    # only these posts
//
// Writes feed/out/<post>/<n>.png (+ .jpg for uploading), plus feed/out/<post>.png: all slides side by side for review.

const fs = require("fs");
const path = require("path");
const puppeteer = require("puppeteer");
const sharp = require("sharp");
const { cutout } = require("./cutout");

const ROOT = path.join(__dirname, "..");
const BUILD = path.join(__dirname, ".build");
const OUT = path.join(__dirname, "out");
const W = 1080, H = 1350;
const RED = "#e0121b";

const esc = s => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

// Product photo without its background, optionally cropped to a horizontal band ([top, bottom] as fractions)
async function productFile(img) {
  const file = await cutout(path.resolve(ROOT, img.src));
  if (!img.crop) return file;
  const [t, b] = img.crop;
  const out = file.replace(/\.png$/, `-${t}-${b}.png`);
  if (!fs.existsSync(out)) {
    const { width, height } = await sharp(file).metadata();
    const band = await sharp(file).extract({ left: 0, top: Math.round(height * t), width, height: Math.round(height * (b - t)) }).png().toBuffer();
    await sharp(band).trim({ background: { r: 0, g: 0, b: 0, alpha: 0 }, threshold: 1 }).png().toFile(out);
  }
  return out;
}

// Grey concrete: soft mottling + fine grain + small dark pits, all from SVG noise
const concrete = seed => `
  <svg class="bg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
    <filter id="c" x="0" y="0" width="100%" height="100%" color-interpolation-filters="sRGB">
      <feTurbulence type="fractalNoise" baseFrequency="0.009" numOctaves="3" seed="${seed}" result="mottle"/>
      <feTurbulence type="fractalNoise" baseFrequency="0.07" numOctaves="3" seed="${seed + 3}" result="aggregate"/>
      <feTurbulence type="fractalNoise" baseFrequency="1.3" numOctaves="1" seed="${seed + 1}" result="grain"/>
      <feComposite in="mottle" in2="aggregate" operator="arithmetic" k2="0.24" k3="0.3" k4="0.08" result="mix1"/>
      <feComposite in="mix1" in2="grain" operator="arithmetic" k2="1" k3="0.5" k4="-0.06" result="mix"/>
      <feColorMatrix in="mix" type="saturate" values="0" result="grey"/>
      <feComponentTransfer in="grey" result="base">
        <feFuncA type="linear" slope="0" intercept="1"/>
      </feComponentTransfer>
      <feTurbulence type="fractalNoise" baseFrequency="0.3" numOctaves="1" seed="${seed + 2}" result="speck"/>
      <feColorMatrix in="speck" type="matrix" values="0 0 0 0 0.1  0 0 0 0 0.1  0 0 0 0 0.1  1 0 0 0 0" result="speckA"/>
      <feComponentTransfer in="speckA" result="pits">
        <feFuncA type="discrete" tableValues="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0.55 0.8 0.8 0.8 0.8"/>
      </feComponentTransfer>
      <feComposite in="pits" in2="base" operator="over"/>
    </filter>
    <rect width="100%" height="100%" filter="url(#c)"/>
  </svg>
  <div class="shade"></div>`;

// Where a point given as fractions of a product photo (u across, v down) lands on the slide
function onSlide(p, [u, v]) {
  const lx = (u - 0.5) * p.width, ly = (v - 0.5) * p.height;
  const a = ((p.rotate || 0) * Math.PI) / 180;
  return [p.x + lx * Math.cos(a) - ly * Math.sin(a), p.y + lx * Math.sin(a) + ly * Math.cos(a)];
}

// Dims can be given relative to a photo ({ img, from: [u, v], to: [u, v], offset }) so they follow its edges
function resolveDim(d, placed) {
  if (d.img === undefined) return d;
  const p = placed[d.img];
  let [x1, y1] = onSlide(p, d.from);
  let [x2, y2] = onSlide(p, d.to);
  const len = Math.hypot(x2 - x1, y2 - y1);
  const off = d.offset || 0;
  const nx = (-(y2 - y1) / len) * off, ny = ((x2 - x1) / len) * off;
  return { ...d, x1: x1 + nx, y1: y1 + ny, x2: x2 + nx, y2: y2 + ny };
}

function image(img, file) {
  const flip = img.flip ? " scaleX(-1)" : "";
  return `<img class="product" src="file://${file}" style="left:${img.x}px; top:${img.y}px; width:${img.width}px;
    transform:translate(-50%,-50%) rotate(${img.rotate || 0}deg)${flip}; z-index:${img.z || 2}">`;
}

// A measurement line with a soft glow (like a studio spec sheet) and its text
function dim(d, style) {
  const color = d.color || RED;
  const text = d.textColor || (style === "studio" ? "#111" : "#fff");
  const dx = d.x2 - d.x1, dy = d.y2 - d.y1;
  let angle = (Math.atan2(dy, dx) * 180) / Math.PI;
  if (angle > 90) angle -= 180;
  if (angle < -90) angle += 180;
  const offset = d.textOffset ?? -34;
  const rad = (angle * Math.PI) / 180;
  const tx = d.textX ?? (d.x1 + d.x2) / 2 + Math.sin(rad) * -offset;
  const ty = d.textY ?? (d.y1 + d.y2) / 2 + Math.cos(rad) * offset;
  const ta = d.textAngle ?? angle;
  // little end ticks across the line
  const len = Math.hypot(dx, dy), nx = -dy / len * 14, ny = dx / len * 14;
  const ticks = [[d.x1, d.y1], [d.x2, d.y2]].map(([x, y]) =>
    `<line x1="${x - nx}" y1="${y - ny}" x2="${x + nx}" y2="${y + ny}" stroke="${color}" stroke-width="4"/>`).join("");
  return `
  <svg class="dim" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
    <filter id="glow"><feGaussianBlur stdDeviation="5"/></filter>
    <line x1="${d.x1}" y1="${d.y1}" x2="${d.x2}" y2="${d.y2}" stroke="${color}" stroke-width="10" opacity=".55" filter="url(#glow)"/>
    <line x1="${d.x1}" y1="${d.y1}" x2="${d.x2}" y2="${d.y2}" stroke="${color}" stroke-width="4"/>
    ${ticks}
  </svg>
  <div class="dimtext" style="left:${tx}px; top:${ty}px; color:${text}; font-size:${d.size || 40}px;
    transform:translate(-50%,-50%) rotate(${ta}deg)">${esc(d.text)}</div>`;
}

function label(l, style) {
  const color = l.color || (style === "studio" ? "#111" : "#fff");
  const anchor = l.align === "left" ? "translate(0,-50%)" : "translate(-50%,-50%)";
  return `<div class="label" style="left:${l.x}px; top:${l.y}px; font-size:${l.size || 44}px; color:${color};
    transform:${anchor} rotate(${l.rotate || 0}deg); transform-origin:${l.align === "left" ? "left center" : "center"}">${esc(l.text)}</div>`;
}

async function html(slide, n) {
  const style = slide.style;
  const accent = slide.accent || RED;
  const imgs = [], placed = [];
  for (const img of slide.images || []) {
    const file = await productFile(img);
    const { width, height } = await sharp(file).metadata();
    placed.push({ ...img, height: (img.width * height) / width });
    imgs.push(image(img, file));
  }

  const background = {
    concrete: concrete(slide.seed ?? n * 7 + 3),
    studio: `<div class="watermark">${esc(slide.watermark ?? slide.brand)}</div>`,
    color: `<div class="outline">${Array(5).fill(esc(slide.watermark ?? slide.title)).join("<br>")}</div>`,
  }[style];
  if (!background) throw new Error(`Unknown style "${style}"`);

  const titleColor = slide.titleColor || { concrete: accent, studio: "#111", color: "#fff" }[style];
  const ink = style === "studio" ? "#111" : "#fff";

  return `<!doctype html>
<html><head><meta charset="utf-8">
<link href="https://fonts.googleapis.com/css2?family=Lato:wght@400;700;900&family=Saira+Stencil+One&display=block" rel="stylesheet">
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  html, body { width: ${W}px; height: ${H}px; overflow: hidden; }
  body { position: relative; font-family: "Lato", sans-serif; -webkit-font-smoothing: antialiased; color: ${ink};
         background: ${style === "color" ? `radial-gradient(circle at 50% 60%, ${slide.bg2 || accent} 0%, ${slide.bg || accent} 75%)` : style === "studio" ? "radial-gradient(circle at 50% 55%, #fff 0%, #ececec 100%)" : "#777"}; }
  .bg { position: absolute; inset: 0; }
  .shade { position: absolute; inset: 0; background:
           linear-gradient(to bottom, rgba(0,0,0,.62) 0%, rgba(0,0,0,.18) 34%, rgba(0,0,0,0) 55%, rgba(0,0,0,.25) 100%),
           radial-gradient(ellipse at 50% 60%, rgba(0,0,0,0) 45%, rgba(0,0,0,.45) 100%); }
  .watermark { position: absolute; left: 50%; top: 58%; transform: translate(-50%,-50%) rotate(-16deg);
               font-family: "Saira Stencil One"; font-size: ${slide.watermarkSize || 520}px; line-height: 1; white-space: nowrap;
               color: rgba(0,0,0,.06); filter: blur(5px); }
  .outline { position: absolute; left: 50%; top: 60%; transform: translate(-50%,-50%) rotate(-8deg); text-align: center;
             font-family: "Saira Stencil One"; font-size: 230px; line-height: .95; white-space: nowrap;
             color: transparent; -webkit-text-stroke: 3px rgba(255,255,255,.16); }
  .head { position: absolute; left: 0; right: 0; text-align: center; z-index: 5; white-space: nowrap; }
  .brand { top: 58px; font-family: "Saira Stencil One"; font-size: 64px; line-height: 1; letter-spacing: .06em;
           ${style === "concrete" ? "color: transparent; -webkit-text-stroke: 2.5px #fff;" : style === "studio" ? `color: ${accent};` : "color: #fff;"} }
  .title { top: ${slide.titleTop ?? 140}px; font-family: "Saira Stencil One"; font-size: ${slide.titleSize || 170}px; line-height: 1; color: ${titleColor};
           ${style === "concrete" ? "text-shadow: 0 6px 30px rgba(0,0,0,.35);" : ""} }
  .kicker { top: ${slide.kickerTop ?? (slide.titleTop ?? 140) + (slide.titleSize || 170) + 22}px; font-weight: 900; font-size: 36px; line-height: 1;
            letter-spacing: .55em; padding-left: .55em; }
  .product { position: absolute; filter: ${{ concrete: "drop-shadow(16px 26px 18px rgba(0,0,0,.55))", studio: "drop-shadow(0 20px 22px rgba(0,0,0,.2))", color: "drop-shadow(0 26px 30px rgba(0,0,0,.4))" }[style]}; }
  .dim { position: absolute; left: 0; top: 0; z-index: 4; }
  .dimtext { position: absolute; font-weight: 900; white-space: nowrap; z-index: 4; letter-spacing: .02em; }
  .label { position: absolute; font-weight: 900; letter-spacing: .14em; white-space: nowrap; z-index: 4; }
  .tag { position: absolute; z-index: 6; font-weight: 900; font-size: 34px; letter-spacing: .14em; padding: 12px 24px 12px calc(24px + .14em);
         border-radius: 10px; white-space: nowrap; transform-origin: left center;
         background: ${style === "studio" ? "#111" : "#fff"}; color: ${style === "studio" ? "#fff" : "#111"}; }
  .foot { position: absolute; left: 0; right: 0; bottom: 34px; text-align: center; z-index: 5; font-weight: 900; font-size: 22px;
          letter-spacing: .45em; padding-left: .45em; opacity: .85; }
</style></head>
<body>
  ${background}
  ${slide.brand ? `<div class="head brand"><span>${esc(slide.brand)}</span></div>` : ""}
  <div class="head title"><span>${esc(slide.title)}</span></div>
  ${slide.kicker ? `<div class="head kicker"><span>${esc(slide.kicker)}</span></div>` : ""}
  ${imgs.join("\n")}
  ${(slide.dims || []).map(d => dim(resolveDim(d, placed), style)).join("\n")}
  ${(slide.labels || []).map(l => label(l, style)).join("\n")}
  ${slide.tag ? `<div class="tag" style="left:${slide.tag.x ?? 56}px; top:${slide.tag.y ?? 1220}px; transform:rotate(${slide.tag.rotate ?? -4}deg)">${esc(slide.tag.text || slide.tag)}</div>` : ""}
  ${slide.foot === false ? "" : `<div class="foot">PRIDESCOOTERING.COM</div>`}
  <script>
    // Shrink headings that don't fit the width
    for (const el of document.querySelectorAll(".title, .kicker, .brand")) {
      const span = el.querySelector("span");
      let size = parseFloat(getComputedStyle(el).fontSize);
      while (span.getBoundingClientRect().width > ${W - 100} && size > 16) {
        size -= 2;
        el.style.fontSize = size + "px";
      }
    }
  </script>
</body></html>`;
}

async function main() {
  const only = process.argv.slice(2);
  const posts = require("./posts").filter(p => !only.length || only.includes(p.slug));
  if (!posts.length) throw new Error(`No posts match: ${only.join(", ")}`);
  fs.mkdirSync(BUILD, { recursive: true });

  const browser = await puppeteer.launch({ headless: true });
  try {
    const page = await browser.newPage();
    await page.setViewport({ width: W, height: H, deviceScaleFactor: 1 });
    for (const post of posts) {
      const dir = path.join(OUT, post.slug);
      fs.rmSync(dir, { recursive: true, force: true });
      fs.mkdirSync(dir, { recursive: true });
      const files = [];
      for (const [i, slide] of post.slides.entries()) {
        const file = path.join(BUILD, `${post.slug}-${i + 1}.html`);
        fs.writeFileSync(file, await html(slide, i));
        await page.goto(`file://${file}`, { waitUntil: "networkidle0" });
        await page.evaluate(() => document.fonts.ready);
        const out = path.join(dir, `${i + 1}.png`);
        await page.screenshot({ path: out, clip: { x: 0, y: 0, width: W, height: H } });
        // JPEG copy for uploading (much smaller than the PNG)
        await sharp(out).jpeg({ quality: 92, mozjpeg: true }).toFile(out.replace(/\.png$/, ".jpg"));
        files.push(out);
      }
      // Contact sheet of the whole carousel
      const tw = 540, th = 675, gap = 20;
      await sharp({ create: { width: files.length * (tw + gap) + gap, height: th + gap * 2, channels: 3, background: "#f4f4f4" } })
        .composite(await Promise.all(files.map(async (f, i) => ({ input: await sharp(f).resize(tw, th).toBuffer(), left: gap + i * (tw + gap), top: gap }))))
        .png()
        .toFile(path.join(OUT, `${post.slug}.png`));
      console.log(`🖼  ${path.relative(process.cwd(), dir)}/ (${files.length} slides)`);
    }
  } finally {
    await browser.close();
  }
}

main().catch(err => {
  console.error(`❌ ${err.message}`);
  process.exit(1);
});
