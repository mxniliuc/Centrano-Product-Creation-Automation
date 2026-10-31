#!/usr/bin/env node
// import.js
// Find a product on Centrano, scrape it, and create it in Shopify.
//
//   node import.js "tilt formula deck"
//   node import.js "https://www.centrano.com/advanced_search_result.php?keywords=tilt+formula+deck"
//   node import.js --dry-run "core action sports casca" "root air 110mm"

const fs = require("fs");
const path = require("path");
const { parseArgs } = require("util");
const puppeteer = require("puppeteer");

const centrano = require("./lib/centrano");
const { buildProduct } = require("./lib/product");
const { processImages } = require("./lib/images");
const { createShopifyClient } = require("./lib/shopify");

const HELP = `
Usage: node import.js [options] "<search term or Centrano link>" [...]

Each argument picks one product on Centrano, which is then created in Shopify:
  "tilt formula deck"     search Centrano; the words also name the product
                          ("tilt formula deck" -> "Deck Tilt Formula")
  "https://www.centrano.com/advanced_search_result.php?keywords=tilt+formula+deck"
                          a Centrano search link copied from the address bar;
                          the title comes from Centrano's product name
  "id:49405"              a Centrano product ID (printed as #49405 by this tool)

Put links in quotes, otherwise the shell mangles the ? and & in them.

Options:
  --dry-run        Scrape and save everything to output/, but don't touch Shopify
  --draft          Create products as drafts instead of active
  --show-browser   Show the Chrome window while scraping (handy for debugging)
  -h, --help       Show this help

Settings are read from .env (see .env.example).
`;

const ENV_FILE = path.join(__dirname, ".env");
if (fs.existsSync(ENV_FILE)) process.loadEnvFile(ENV_FILE);

function slugify(s) {
  return (s || "product").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase()
    .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 80) || "product";
}

function requireEnv(names) {
  const missing = names.filter(n => !process.env[n]);
  if (missing.length) {
    console.error(`Missing ${missing.join(", ")}. Copy .env.example to .env and fill it in.`);
    process.exit(1);
  }
}

async function saveDebugSnapshot(page, label) {
  try {
    const dir = path.join(__dirname, "debug");
    fs.mkdirSync(dir, { recursive: true });
    const base = path.join(dir, `${new Date().toISOString().replace(/[:.]/g, "-")}-${slugify(label)}`);
    fs.writeFileSync(`${base}.html`, await page.content());
    await page.screenshot({ path: `${base}.png`, fullPage: true });
    console.error(`   Saved page snapshot to ${path.relative(process.cwd(), base)}.{html,png}`);
  } catch {
    // best effort only
  }
}

function priceRange(variants) {
  const prices = variants.map(v => Number(v.price)).filter(n => !Number.isNaN(n) && n > 0);
  if (!prices.length) return "no price";
  const min = Math.min(...prices).toFixed(2), max = Math.max(...prices).toFixed(2);
  return min === max ? `${min} RON` : `${min}–${max} RON`;
}

async function importOne(page, target, { dryRun, draft, eurToRon, shopify }) {
  let productId = target.productId;
  const keywords = target.term || target.keywords || "";

  if (productId) {
    console.log(`\n🔗 Centrano product #${productId}`);
  } else {
    console.log(target.keywords ? `\n🔗 Centrano link: "${keywords}"` : `\n🔎 "${keywords}"`);
    const results = await centrano.search(page, keywords);
    if (!results.length) throw new Error("No products found on Centrano for this search");

    const pick = centrano.pickResult(results, keywords);
    console.log(`   ${results.length} result(s) on Centrano, using: ${pick.name} (#${pick.id})`);
    for (const other of results.filter(r => r !== pick).slice(0, 4)) console.log(`     · also found: ${other.name}`);
    productId = pick.id;
  }

  const scraped = await centrano.scrapeProduct(page, productId, keywords);
  if (target.productId) console.log(`   Centrano: ${scraped.rawTitle}`);
  // Typed search terms name the product; links and IDs use Centrano's product name
  const product = buildProduct(scraped, target.term || null, { eurToRon });

  console.log(`   Title:    ${product.title}`);
  console.log(`   Vendor:   ${product.vendor || "-"}    Type: ${product.productType || "-"}`);
  console.log(`   Options:  ${product.options.map(o => `${o.name} (${o.values.length})`).join(", ")}`);
  console.log(`   Variants: ${product.variants.length}, ${priceRange(product.variants)}`);
  for (const w of product.warnings) console.warn(`   ⚠️  ${w}`);

  const slug = slugify(product.title);
  const outDir = path.join(__dirname, "output", slug);
  console.log(`   🖼  Processing ${product.imageUrls.length} image(s)…`);
  const images = await processImages(product.imageUrls, outDir, slug);
  fs.writeFileSync(
    path.join(outDir, "product.json"),
    JSON.stringify({ ...product, processedImages: images.map(i => i.filename) }, null, 2)
  );

  if (dryRun) {
    console.log(`   📝 Dry run: saved product.json and ${images.length} image(s) to ${path.relative(process.cwd(), outDir)}/`);
    return;
  }

  // Never publish something at 0 RON by accident
  const missingPrice = product.variants.some(v => v.price == null);
  if (missingPrice && !draft) console.warn("   ⚠️  Some variants have no price, so the product is created as a draft.");
  const status = draft || missingPrice ? "DRAFT" : "ACTIVE";

  let mediaSources;
  if (images.length) {
    console.log(`   ⬆️  Uploading ${images.length} image(s) to Shopify…`);
    try {
      const staged = await shopify.stageImages(images);
      // Any image that failed to upload falls back to Centrano's original file
      mediaSources = staged.map((url, i) => url || images[i].sourceUrl);
    } catch (err) {
      console.warn(`   ⚠️  Couldn't upload processed images (${err.message}); using Centrano's original images instead.`);
      mediaSources = images.map(i => i.sourceUrl);
    }
  } else {
    mediaSources = product.imageUrls;
  }

  const created = await shopify.createProduct(product, { status, mediaSources });
  console.log(`   ✅ Created "${created.title}" as ${created.status.toLowerCase()} with ${created.variantsCount.count} variant(s)`);
  console.log(`      ${created.adminUrl}`);

  if (mediaSources.length) {
    const media = await shopify.waitForMedia(created.id);
    console.log(`   🖼  Images: ${media.ready} ready${media.pending ? `, ${media.pending} still processing` : ""}${media.failed.length ? `, ${media.failed.length} failed` : ""}`);
    for (const msg of media.failed) console.warn(`   ⚠️  Image failed: ${msg}`);
  }
}

async function main() {
  const { values: flags, positionals: terms } = parseArgs({
    allowPositionals: true,
    options: {
      "dry-run": { type: "boolean", default: false },
      draft: { type: "boolean", default: false },
      "show-browser": { type: "boolean", default: false },
      help: { type: "boolean", short: "h", default: false },
    },
  });
  if (flags.help || !terms.length) {
    console.log(HELP);
    process.exit(flags.help ? 0 : 1);
  }

  // Check every argument before starting the browser
  const targets = [];
  let badArgs = 0;
  for (const arg of terms) {
    try {
      targets.push(centrano.parseTarget(arg));
    } catch (err) {
      badArgs++;
      console.error(`❌ ${err.message}`);
    }
  }
  if (badArgs) process.exit(1);

  const dryRun = flags["dry-run"];
  // Shopify auth: a Dev Dashboard app's client ID + secret, or a fixed Admin API token
  const shopifyAuth = process.env.SHOPIFY_ACCESS_TOKEN ? ["SHOPIFY_ACCESS_TOKEN"] : ["SHOPIFY_CLIENT_ID", "SHOPIFY_CLIENT_SECRET"];
  requireEnv(["CENTRANO_EMAIL", "CENTRANO_PASSWORD", ...(dryRun ? [] : ["SHOPIFY_STORE", ...shopifyAuth])]);

  const eurToRon = Number(process.env.EUR_TO_RON || 4.97);
  let shopify = null;
  if (!dryRun) {
    shopify = createShopifyClient({
      store: process.env.SHOPIFY_STORE,
      accessToken: process.env.SHOPIFY_ACCESS_TOKEN,
      clientId: process.env.SHOPIFY_CLIENT_ID,
      clientSecret: process.env.SHOPIFY_CLIENT_SECRET,
      apiVersion: process.env.SHOPIFY_API_VERSION || "2026-07",
    });
    // Fail before scraping anything if Shopify isn't reachable or the app can't create products
    const { shopName } = await shopify.checkAccess();
    console.log(`🛒 Shopify: connected to ${shopName}`);
  }

  const browser = await puppeteer.launch({
    headless: !flags["show-browser"],
    executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined,
    // Chrome refuses to sandbox as root (e.g. in Docker)
    args: process.getuid?.() === 0 ? ["--no-sandbox", "--disable-setuid-sandbox"] : [],
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1366, height: 900 });
  page.setDefaultTimeout(60000);

  let failures = 0;
  try {
    console.log("🔐 Logging in to Centrano…");
    try {
      await centrano.login(page, process.env.CENTRANO_EMAIL, process.env.CENTRANO_PASSWORD);
    } catch (err) {
      await saveDebugSnapshot(page, "login");
      throw err;
    }

    for (const target of targets) {
      try {
        await importOne(page, target, { dryRun, draft: flags.draft, eurToRon, shopify });
      } catch (err) {
        failures++;
        console.error(`   ❌ ${err.message}`);
        await saveDebugSnapshot(page, target.term || target.keywords || target.productId);
      }
    }
  } finally {
    await browser.close();
  }

  if (terms.length > 1) console.log(`\nDone: ${terms.length - failures} of ${terms.length} imported.`);
  process.exitCode = failures ? 1 : 0;
}

main().catch(err => {
  console.error(`❌ ${err.message}`);
  process.exit(1);
});
