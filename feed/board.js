#!/usr/bin/env node
// feed/board.js
// Draw the feed plan (feed/schedule.js) as one image: a row per rider -> product -> tagged cycle.
//
//   node feed/board.js   ->  feed/out/feed-schedule.png

const fs = require("fs");
const path = require("path");
const puppeteer = require("puppeteer");

const ROOT = path.join(__dirname, "..");
const OUT = path.join(__dirname, "out");
const BUILD = path.join(__dirname, ".build");
const esc = s => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

const KINDS = {
  team: { label: "TEAM RIDER", cls: "team" },
  product: { label: "PRODUCT", cls: "product" },
  tagged: { label: "RIDERS WHO TAGGED US", cls: "tagged" },
};

function tile(post) {
  if (post.kind === "product") {
    const dir = path.join(__dirname, "out", post.post);
    const cover = path.join(dir, "1.png");
    if (!fs.existsSync(cover)) throw new Error(`Render the ${post.post} carousel first (node feed/render.js)`);
    const slides = fs.readdirSync(dir).filter(f => f.endsWith(".png")).length;
    return `
      <div class="tile product">
        <img src="file://${cover}">
        ${slides > 1 ? `<div class="count">1/${slides}</div>` : ""}
      </div>`;
  }
  if (post.kind === "team") {
    return `
      <div class="tile team">
        <div class="play">▶</div>
        <div class="handle">@${esc(post.tags[0])}</div>
        <div class="what">${esc(post.content)}</div>
      </div>`;
  }
  const n = post.tags.length || 5;
  const handles = post.tags.length ? post.tags.map(h => `<li>@${esc(h)}</li>`).join("") : `<li>${esc(post.placeholder)}</li>`;
  return `
    <div class="tile tagged">
      <div class="head">${n} riders who tagged us</div>
      <ul>${handles}</ul>
      <div class="what">Carousel of their clips</div>
    </div>`;
}

async function main() {
  const plan = require("./schedule");
  const cycles = [];
  plan.posts.forEach((p, i) => {
    if (i % 3 === 0) cycles.push([]);
    cycles[cycles.length - 1].push(p);
  });

  const rows = cycles.map((posts, n) => {
    const cards = posts.map(p => {
      const kind = KINDS[p.kind];
      if (!kind) throw new Error(`schedule.js: unknown kind "${p.kind}"`);
      const d = new Date(`${p.date}T12:00:00`);
      const weekday = d.toLocaleDateString("en-GB", { weekday: "short" });
      const date = d.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
      const title = p.kind === "product" ? p.title : p.kind === "team" ? (p.name || `@${p.tags[0]}`) : `${p.tags.length || 5} riders`;
      return `
        <div class="card">
          <div class="when"><b>${esc(weekday)} ${esc(date)}</b> · ${esc(p.time || plan.time)}</div>
          <div class="chip ${kind.cls}">${kind.label}</div>
          ${tile(p)}
          <div class="title">${esc(title)}</div>
          <div class="note">${esc(p.note)}</div>
          <div class="caption">No caption · tags ${p.tags.length ? p.tags.map(t => `<b>@${esc(t)}</b>`).join(" ") : "the riders picked on the day"}</div>
        </div>`;
    }).join("");
    return `
      <div class="cycle">
        <div class="num">${n + 1}</div>
        <div class="cards">${cards}</div>
      </div>`;
  }).join("");

  const skipped = Object.entries(plan.skipped)
    .map(([who, why]) => `<li><b>${esc(who)}</b>: ${esc(why)}</li>`).join("");
  const first = new Date(`${plan.posts[0].date}T12:00:00`);
  const last = new Date(`${plan.posts[plan.posts.length - 1].date}T12:00:00`);
  const range = `${first.toLocaleDateString("en-GB", { day: "numeric", month: "short" })} to ${last.toLocaleDateString("en-GB", { day: "numeric", month: "short" })}`;

  const html = `<!doctype html><html><head><meta charset="utf-8">
<link href="https://fonts.googleapis.com/css2?family=Lato:wght@400;700;900&display=block" rel="stylesheet">
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: "Lato", sans-serif; background: #f4f4f4; padding: 48px; width: 1400px; color: #111; }
  h1 { font-weight: 900; font-size: 44px; letter-spacing: 0.04em; }
  .sub { font-size: 22px; color: #555; margin: 8px 0 36px; }
  .cycle { display: flex; gap: 24px; background: #fff; border-radius: 18px; padding: 24px 28px; margin-bottom: 22px; box-shadow: 0 1px 4px rgba(0,0,0,.08); }
  .num { width: 44px; flex: none; font-weight: 900; font-size: 40px; color: #ddd; }
  .cards { display: flex; gap: 28px; }
  .card { width: 384px; }
  .when { font-size: 22px; margin-bottom: 8px; }
  .when b { font-weight: 900; }
  .chip { display: inline-block; font-weight: 900; font-size: 13px; letter-spacing: .1em; padding: 5px 10px; border-radius: 6px; margin-bottom: 10px; color: #fff; }
  .chip.team { background: #e0121b; }
  .chip.product { background: #000; }
  .chip.tagged { background: #6b6b6b; }
  .tile { width: 384px; height: 480px; border-radius: 10px; overflow: hidden; position: relative; border: 1px solid #ddd; }
  .tile.product { background: #fff; }
  .tile.product img { width: 100%; height: 100%; display: block; }
  .tile .count { position: absolute; top: 12px; right: 12px; background: rgba(0,0,0,.7); color: #fff; font-weight: 700; font-size: 14px; padding: 4px 9px; border-radius: 12px; }
  .tile.team { background: linear-gradient(160deg, #3a3a3a, #0d0d0d); color: #fff; display: flex; flex-direction: column; justify-content: center; align-items: center; text-align: center; padding: 24px; }
  .tile.team .play { font-size: 64px; opacity: .85; margin-bottom: 18px; }
  .tile.team .handle { font-weight: 900; font-size: 30px; word-break: break-all; }
  .tile .what { font-size: 16px; opacity: .7; margin-top: 10px; }
  .tile.tagged { background: #1a1a1a; color: #fff; padding: 34px 30px; display: flex; flex-direction: column; }
  .tile.tagged .head { font-weight: 900; font-size: 28px; line-height: 1.15; text-transform: uppercase; margin-bottom: 22px; }
  .tile.tagged ul { list-style: none; flex: 1; }
  .tile.tagged li { font-weight: 700; font-size: 22px; padding: 9px 0; border-bottom: 1px solid #333; }
  .title { font-weight: 900; font-size: 19px; margin-top: 12px; line-height: 1.25; }
  .note { font-size: 15px; color: #555; margin-top: 6px; line-height: 1.35; }
  .caption { font-size: 14px; color: #333; background: #f6f6f6; border-radius: 8px; padding: 10px 12px; margin-top: 10px; line-height: 1.4; }
  .skipped { background: #fff; border-radius: 18px; padding: 24px 28px; box-shadow: 0 1px 4px rgba(0,0,0,.08); }
  .skipped h2 { font-weight: 900; font-size: 22px; margin-bottom: 10px; }
  .skipped li { font-size: 17px; color: #444; margin: 6px 0 0 22px; }
</style></head><body>
  <h1>INSTAGRAM FEED · SCHEDULE</h1>
  <div class="sub">${plan.posts.length} posts · 1 a day at ${esc(plan.time)} · ${esc(range)} · team rider → product → riders who tagged us</div>
  ${rows}
  <div class="skipped"><h2>Left out this round</h2><ul>${skipped}</ul></div>
</body></html>`;

  fs.mkdirSync(BUILD, { recursive: true });
  fs.mkdirSync(OUT, { recursive: true });
  const file = path.join(BUILD, "feed-schedule.html");
  fs.writeFileSync(file, html);

  const browser = await puppeteer.launch({ headless: true });
  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1496, height: 800, deviceScaleFactor: 1 });
    await page.goto(`file://${file}`, { waitUntil: "networkidle0" });
    await page.evaluate(() => document.fonts.ready);
    const out = path.join(OUT, "feed-schedule.png");
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
