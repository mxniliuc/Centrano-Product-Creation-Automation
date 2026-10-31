#!/usr/bin/env node
// stories/board.js
// Draw the posting schedule (stories/schedule.js) as one image with story thumbnails.
//
//   node stories/board.js   ->  stories/out/schedule.png

const fs = require("fs");
const path = require("path");
const puppeteer = require("puppeteer");

const OUT = path.join(__dirname, "out");
const BUILD = path.join(__dirname, ".build");
const esc = s => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

async function main() {
  const schedule = require("./schedule");
  const stories = Object.fromEntries(require("./stories").map(s => [s.slug, s]));
  const TW = 180, TH = 320;

  const rows = schedule.days.map(day => {
    const d = new Date(`${day.date}T12:00:00`);
    const weekday = d.toLocaleDateString("en-GB", { weekday: "long" });
    const date = d.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
    const cards = day.posts.map(p => {
      const s = stories[p.slug];
      if (!s) throw new Error(`schedule.js: unknown story "${p.slug}"`);
      // Prefer the preview (with a mock link sticker) so the board shows where each link goes
      const preview = path.join(OUT, "preview", `${p.slug}.png`);
      const file = fs.existsSync(preview) ? preview : path.join(OUT, `${p.slug}.png`);
      if (!fs.existsSync(file)) throw new Error(`Render ${p.slug} first (node stories/render.js)`);
      return `
        <div class="card">
          <div class="time">${esc(p.time)}</div>
          <img src="file://${file}" width="${TW}" height="${TH}">
          <div class="name">${esc(`${s.brand} ${s.title}`)}</div>
          ${s.tag ? `<div class="tag">${esc(s.tag)}</div>` : ""}
        </div>`;
    }).join("");
    return `
      <div class="day">
        <div class="when">
          <div class="weekday">${esc(weekday)}</div>
          <div class="date">${esc(date)}</div>
          <div class="theme">${esc(day.theme)}</div>
          <div class="count">${day.posts.length} stories</div>
        </div>
        <div class="cards">${cards}</div>
      </div>`;
  }).join("");

  const total = schedule.days.reduce((n, d) => n + d.posts.length, 0);
  const html = `<!doctype html><html><head><meta charset="utf-8">
<link href="https://fonts.googleapis.com/css2?family=Lato:wght@400;700;900&display=block" rel="stylesheet">
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: "Lato", sans-serif; background: #f4f4f4; padding: 48px; width: 1400px; color: #111; }
  h1 { font-weight: 900; font-size: 44px; letter-spacing: 0.04em; }
  .sub { font-size: 22px; color: #555; margin: 8px 0 36px; }
  .day { display: flex; gap: 28px; background: #fff; border-radius: 18px; padding: 24px 28px; margin-bottom: 22px; box-shadow: 0 1px 4px rgba(0,0,0,.08); }
  .when { width: 230px; flex: none; padding-top: 6px; }
  .weekday { font-weight: 900; font-size: 34px; }
  .date { font-weight: 700; font-size: 26px; color: #e0121b; margin-top: 2px; }
  .theme { font-size: 19px; color: #333; margin-top: 14px; line-height: 1.35; }
  .count { font-size: 16px; color: #888; margin-top: 10px; }
  .cards { display: flex; gap: 18px; }
  .card { width: ${TW}px; position: relative; }
  .card img { display: block; border-radius: 10px; border: 1px solid #ddd; }
  .time { font-weight: 900; font-size: 24px; margin-bottom: 8px; }
  .name { font-size: 15px; font-weight: 700; margin-top: 8px; line-height: 1.25; }
  .tag { position: absolute; top: 44px; right: 8px; background: #000; color: #fff; font-weight: 900; font-size: 12px; letter-spacing: .08em; padding: 4px 8px; border-radius: 6px; }
</style></head><body>
  <h1>INSTAGRAM STORIES · SCHEDULE</h1>
  <div class="sub">${total} stories · ${schedule.days.length} days · between 18:00 and 20:00 Romania time · each with a link to its product page</div>
  ${rows}
</body></html>`;

  fs.mkdirSync(BUILD, { recursive: true });
  const file = path.join(BUILD, "schedule.html");
  fs.writeFileSync(file, html);

  const browser = await puppeteer.launch({ headless: true });
  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1496, height: 800, deviceScaleFactor: 1 });
    await page.goto(`file://${file}`, { waitUntil: "networkidle0" });
    await page.evaluate(() => document.fonts.ready);
    const out = path.join(OUT, "schedule.png");
    await page.screenshot({ path: out, fullPage: true });
    console.log(`🗓  ${path.relative(process.cwd(), out)}`);
  } finally {
    await browser.close();
  }
}

main().catch(err => {
  console.error(`❌ ${err.message}`);
  process.exit(1);
});
