// index.js
const express = require("express");
const puppeteer = require("puppeteer-core");
const cors = require("cors");

const app = express();
app.use(cors());
app.use(express.json());

const fetch = require("node-fetch");
const sharp = require("sharp");
const fs = require("fs");
const path = require("path");

// ---------- local file serving for processed images ----------
const PROCESSED_DIR = path.join(__dirname, "processed");
if (!fs.existsSync(PROCESSED_DIR)) fs.mkdirSync(PROCESSED_DIR, { recursive: true });
app.use("/processed", express.static(PROCESSED_DIR));

/* ---------------- Utilities ---------------- */

// Download image, resize to 2048x2048 with white background, save, return public URL
async function processImage(url, idx, baseUrl) {
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Failed to fetch image: ${url}`);
    const buffer = await res.buffer();

    const outFile = `processed_${idx}.jpg`;
    const outPath = path.join(PROCESSED_DIR, outFile);

    const processed = await sharp(buffer)
      .flatten({ background: { r: 255, g: 255, b: 255 } })
      .resize(2048, 2048, { fit: "contain", background: { r: 255, g: 255, b: 255 } })
      .jpeg({ quality: 95, chromaSubsampling: "4:4:4" })
      .toBuffer();

    fs.writeFileSync(outPath, processed);
    return `${baseUrl}/processed/${outFile}`;
  } catch (err) {
    console.error("❌ Image processing failed:", err);
    return null;
  }
}

// ---------- Vendor & Type detection ----------
const VENDORS = [
  "Revolution Supply Co","Radio Bike Co","Cadillac Wheels","Retrospec","Reversal",
  "Whitespace","GoZone Skimboards","DB Skimboards","Family","Colony","Dominator", "Drone", "Dial 911",
  "Habitat Skateboards","Meow Skateboards","Ocean Pacific","Root Industries",
  "Triple Eight","Essentials Skateboarding","Grit","Salt","Sisu","TLC","Apex",
  "Academy","Alien Workshop","Blueprint BMXFIX","BSD","Cadillac","Core","Crisp",
  "Dial 911","Division","Doomed","Drone Scooters","Eclat","Eight Ball","Fiction BMX",
  "Figz Collection","Flexsurfing","Flypaper","Fuse","Graw Jump Ramps","Habitat",
  "HangUp","Heart Supply","Hella Grip","Hohing","Indo","JD Bug","Jessup","KFD",
  "Kitefix","Longway","Lucky","Madrid","Mafia","Native","North Scooters","North",
  "Panda","Pivot","Prime8","Primus","Proto","RAD Skateboards","Rampage","River",
  "Roces","Rocker", "Root Industries", "Root","Skatemate","Speed Demons","Stolen","Striker","Supreme",
  "Tall Order","Tempish","Tilt","Triple Skate Hook","Trynyty","Venom","Venor Skates",
  "Verb","Wethepeople","Wildcat","Zoo York" , "Odi"
].sort((a,b)=>b.length-a.length);

const PRODUCT_TYPES = [
  "Adaptor","Bar End", "BPM","Casca","Ceara","Clamp","Complete","Deck","Deck End",
  "Distantieri","Diverse", "Frana","Furca","Genunchiere","Ghidon","Glezniere","Griptape",
  "Headset","Imbracaminte","Imbus","Inbus","Kendama","Mansoane","Peg","Roti", "Roata", "Roți",
  "Rulmenti","Sporting Goods","Stand","Sticker","Suruburi","Talpici"
];

// Canonical product type -> list of patterns that should map to it
const PRODUCT_TYPE_ALIASES = {
  Mansoane: [
    /\bmans?oane\b/i,      // Mansoane, Manșoane, etc. (diacritics removed by norm)
    /\bgrips?\b/i          // Grip / Grips
  ],
  "Bar End": [
    /\bbar\s*end(s)?\b/i,   // "Bar End" / "Bar Ends" / "Bar    Ends"
    /\bbar-?ends?\b/i,      // "Bar-Ends" / "Bar-end"
    /\bbarends?\b/i         // "barends" / "barend"
  ],
  Clamp: [
    /\bclamps?\b/i,        // "Clamp" / "Clamps"
    /\bclema\b/i,           // "Clemă" (diacritics removed -> clema)
    /\bscs\b/i              // "SCS"
  ],
  Adaptor: [
    /\badaptors?\b/i,
    /\badapters?\b/i,
    /\bshim(s)?\b/i,
    /\bc[-\s]?ring\b/i,
    /\bsleeves?\b/i
  ],

  // Distantieri (spacers)
  Distantieri: [
    /\bspacer(s)?\b/i,
    /\bdistantier(i)?\b/i
  ],

  // Deck End / Plugs
  "Deck End": [
    /\bdeck\s*end(s)?\b/i,
    /\bplugs?\b/i,
    /\bplug\b/i
  ],

  // Ceara / Wax
  Ceara: [
    /\bceara\b/i,
    /\bwax\b/i
  ],

  // Stand
  Stand: [
    /\bstand\b/i
  ],

  // Headset parts
  "Top Cap": [
    /\btop\s*cap\b/i,
    /\bstar[-\s]?nut\b/i,
    /\bstarnut\b/i
  ],

  // Suruburi (hardware: bolts/nuts/axles)
  Suruburi: [
    /\bbolt(s)?\b/i,
    /\bsurub(uri)?\b/i,
    /\bnut(s)?\b/i,
    /\bpiulit[aă]\b/i,
    /\bax\b/i,
    /\bosie(i)?\b/i
  ],

  // Rulmenti (bearings)
  Rulmenti: [
    /\bbearing(s)?\b/i,
    /\brulment(i)?\b/i
  ],

  // Imbus / Inbus (tools – generic “Tool(s)” mapped here)
  Imbus: [
    /\btool(s)?\b/i,
    /\bimbus\b/i,
    /\binbus\b/i
  ]
};


function norm(s) {
  return (s || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // remove diacritics (NOT spaces)
    .toLowerCase();
}

function textIncludesWord(text, word) {
  // word-boundary-ish check on normalized text
  const t = " " + norm(text).replace(/[^a-z0-9]+/g, " ") + " ";
  const w = " " + norm(word) + " ";
  return t.includes(w);
}

function detectVendor(fullText) { for (const v of VENDORS) if (textIncludesWord(fullText, v)) return v; return null; }
// Replace your detectProductType function with this one
function detectProductType(fullText) {
  const ntext = norm(fullText);

  // 🔒 Hard-priority: Clamp beats everything else
  const clampHit =
    /\bclamps?\b/i.test(ntext) ||
    /\bclema\b/i.test(ntext) ||
    /\bscs\b/i.test(ntext);
  if (clampHit) return "Clamp";

  // 1) Prefer aliases/synonyms FIRST (so keywords like "Shim", "Top Cap", etc. win)
  for (const [canonical, patterns] of Object.entries(PRODUCT_TYPE_ALIASES)) {
    if (patterns.some(re => re.test(ntext))) return canonical;
  }

  // 2) Fallback to exact canonical names present in PRODUCT_TYPES
  for (const t of PRODUCT_TYPES) {
    if (textIncludesWord(ntext, t)) return t;
  }

  return null;
}

function isSCS(title) {
  return /\bscs\b/i.test(title);
}




// title helpers
function toTitleCase(str){ return (str||"").replace(/\S+/g,w=>w[0].toUpperCase()+w.slice(1).toLowerCase()); }
// --- Title helpers (drop-in replacement) ---
function stripDiacritics(s) {
  return (s || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

// Remove duplicated words while preserving the original spacing/casing of the first occurrence.
// "Trotineta Tilt Tilt Contact Pro Pro" -> "Trotineta Tilt Contact Pro"
function dedupeTitleWords(title) {
  if (!title) return title;
  const tokens = title.split(/\s+/);
  const seen = new Set();
  const out = [];

  for (const tok of tokens) {
    // normalize each word for comparison (remove diacritics, lowercase, strip non-alphanumerics)
    const key = stripDiacritics(tok).toLowerCase().replace(/[^a-z0-9]+/gi, "");
    if (!key) {                 // keep punctuation-ish tokens as-is
      out.push(tok);
      continue;
    }
    if (!seen.has(key)) {
      seen.add(key);
      out.push(tok);
    }
  }
  return out.join(" ").replace(/\s{2,}/g, " ").trim();
}

function toTitleCase(str) {
  return (str || "").replace(/\S+/g, w => w[0].toUpperCase() + w.slice(1).toLowerCase());
}

// Build title from parts, dedupe whole parts, THEN dedupe individual words
function buildTitle(productType, vendor, searchTerm) {
  const parts = [productType, vendor, searchTerm]
    .map(s => (s || "").toString().trim())
    .filter(Boolean);

  // First, dedupe whole parts (so identical chunks aren't repeated)
  const out = [];
  const seenParts = new Set();
  for (const p of parts) {
    const k = stripDiacritics(p).toLowerCase();
    if (!seenParts.has(k)) {
      seenParts.add(k);
      out.push(p);
    }
  }

  // Title Case → then word-level dedupe (handles vendor words duplicated inside searchTerm, etc.)
  const titled = toTitleCase(out.join(" "));
  return dedupeTitleWords(titled);
}


/* ---------------- Route ---------------- */

app.post("/scrape-product-images", async (req, res) => {
  const { email, password, searchTerm } = req.body;
  if (!email || !password || !searchTerm) {
    return res.status(400).json({ error: "Missing required fields" });
  }

  const status = {};
  const browser = await puppeteer.launch({
    headless: "new",
    args: ["--no-sandbox","--disable-setuid-sandbox","--disable-gpu","--disable-dev-shm-usage"],
    executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || "/usr/bin/chromium-browser",
  });
  const page = await browser.newPage();

  try {
    /* 1) Login */
    await page.goto("https://www.centrano.com/ro/login.php", { waitUntil: "networkidle2" });
    await page.type('input[name="email_address"]', email);
    await page.type('input[name="password"]', password);
    await Promise.all([page.click('button.button'), page.waitForNavigation({ waitUntil: "networkidle2" })]);
    status.login = "ok";

    /* 2) Search */
    await page.waitForSelector('input.input-group-field');
    await page.evaluate(() => (document.querySelector('input.input-group-field').value = ""));
    await page.type('input.input-group-field', searchTerm);
    await Promise.all([page.click('button.input-group-label'), page.waitForNavigation({ waitUntil: "networkidle2" })]);
    status.search = "ok";

    /* 3) Open first product */
    const product = await page.$("div.column.column-block");
    if (!product) throw new Error("Product not found");
    await product.click();
    await page.waitForSelector("div.medium-24.large-5.columns");
    status.productClick = "ok";

    /* 4) Title + vendor/type detection */
    const titleVendorType = await page.evaluate(() => {
      const card = document.querySelector(".medium-24.large-5.columns");
      const norm = (s) => (s || "").replace(/\s+/g, " ").trim();
      let rawTitle = "";
      if (card) {
        const candidates = Array.from(card.querySelectorAll(".hide-for-large, [style*='text-align: center']"))
          .map(n => norm(n.textContent))
          .filter(t => t && !/^Culoare\s*:/i.test(t) && !/^\(/.test(t));
        rawTitle = candidates[0] || "";
      }
      if (!rawTitle) {
        const alt = document.querySelector(".hide-for-large");
        rawTitle = norm(alt ? alt.textContent : document.title);
      }
      const fullText = norm(document.body ? document.body.innerText : "");
      return { rawTitle, fullText };
    });

    function cleanTitle(s){
      return (s||"").replace(/\s+/g," ").replace(/\bzoom[_-]?in\b/gi,"").replace(/\s*\(Culoare:[^)]+?\)\s*$/i,"").trim();
    }
    const productTitle = cleanTitle(titleVendorType.rawTitle);
    const detectedVendor = detectVendor(titleVendorType.fullText) || detectVendor(productTitle) || null;
    let detectedType = detectProductType(titleVendorType.fullText) || detectProductType(productTitle) || "";
    const productTag = detectedVendor || "";

    /* 5) Best-quality thumbnail */
    const thumbnail = await page.evaluate(() => {
      const img = document.querySelector("div.medium-24.large-5.columns img");
      if (!img) return null;
      const rawUrl = img.src.startsWith("//") ? `https:${img.src}` : img.src;
      const fileName = rawUrl.substring(rawUrl.lastIndexOf("/"));
      const regex = new RegExp(`https?://[^/]+/(\\d+)${fileName.replace(/[.*+?^${}()|[\]\\]/g,"\\$&")}`);
      const candidates = Array.from(document.querySelectorAll("img"))
        .map(el => el.src.startsWith("//") ? `https:${el.src}` : el.src)
        .filter(u => regex.test(u));
      if (!candidates.length) return rawUrl;
      let best = candidates[0], bestNum = 0;
      for (const url of candidates) {
        const m = url.match(/\/(\d+)\//);
        if (m) { const n = parseInt(m[1],10); if (n > bestNum) { bestNum = n; best = url; } }
      }
      return best;
    });

    /* 6) Colours from main page */
    const colours = await page.evaluate(() => {
      const nodes = Array.from(document.querySelectorAll(".show-for-large"));
      const vals = [];
      for (const n of nodes) {
        const txt = (n.textContent || "").replace(/\s+/g, " ").trim();
        const m = txt.match(/Culoare:\s*([^)]+?)(?:$|\)|,)/i);
        if (m && m[1]) vals.push(m[1].trim());
      }
      return Array.from(new Set(vals.filter(Boolean)));
    });

    /* 7) Try to locate variant rows (don’t throw if missing) */
    await page.waitForSelector("#product_popup .variant_list .row", { timeout: 5000 }).catch(() => {});

    /* 8) Highest € on page as fallback price */
    const highestEuroOnPage = await page.evaluate(() => {
      const txt = document.body ? document.body.innerText : "";
      const euros = Array.from(txt.matchAll(/(\d{1,3}(?:[.,]\d{3})*|\d+)(?:[.,]\d+)?\s*€/g))
        .map(m => m[1].replace(/\./g,"").replace(",","."))
        .map(Number)
        .filter(n => !isNaN(n));
      return euros.length ? Math.max(...euros) : null;
    });

    /* 9) Parse variant rows (supports letter sizes, numeric sizes, picks max € on row) */
    const parsed = await page.evaluate(() => {
      const norm = s => (s || "")
        .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
        .replace(/\s+/g, " ")
        .trim();

      const roots = [
        document,
        document.querySelector("#product_popup"),
        document.querySelector("div.reveal-overlay"),
      ].filter(Boolean);

      const colourSet = new Set();
      const sizeSet   = new Set();
      const rowsOut   = [];

      const colourFromText = (t) => {
        // strictly "<Culoare|Colour|Color> : <value>"
        const m = t.match(/(?:Culoare|Colour|Color)\s*:\s*([^)]+?)(?=$|\)|,)/i);
        return m && m[1] ? m[1].trim() : null;
      };

      // Extract a size value (letters first, then numeric) from a chunk
      function extractSizeValue(chunkRaw) {
        const chunk = norm(chunkRaw);

        // 1) Try letter sizes (longest first)
        const letter = (chunk.match(/\b(XXXL|XXL|XL|XS|S|M|L)\b/i) || [])[1];
        if (letter) return letter.toUpperCase();

        // 2) Try something like "One Size" or "Universal"
        const oneSize = (chunk.match(/\b(one\s*size|marime\s*universala|universal(?:a)?)\b/i) || [])[1];
        if (oneSize) return "One Size";

        // 3) Prefer numeric WITH unit if present (mm/cm/inch/")
const unitMatch = chunk.match(/(\d+(?:[.,]\d+)?)\s*(mm|cm|inch|["”])/i);
if (unitMatch) {
  const num  = unitMatch[1].replace(",", ".");
  let unit = unitMatch[2].toLowerCase();
  if (unit === "”") unit = '"';
  return unit === '"' ? `${num}"` : `${num}${unit}`; // e.g. 110mm, 100mm, 4.5"
}

// 4) Fallback to bare numeric (no unit found)
const numOnly =
  (chunk.match(/(\d+(?:[.,]\d+)?)(?=\s*(?:mm|cm|["”]|$))/i) || [])[1] ||
  (chunk.match(/(\d+(?:[.,]\d+)?)/) || [])[1];
if (numOnly) return numOnly.replace(",", ".");

      }

      // Helper to pick all euro amounts in text
      const pickPrices = (txt) =>
        Array.from((txt || "").matchAll(/(\d{1,3}(?:[.,]\d{3})*|\d+)(?:[.,]\d+)?\s*€/g))
          .map(m => m[0].replace(/[^\d.,]/g, "").replace(/\./g, "").replace(",", "."))
          .map(Number)
          .filter(n => !Number.isNaN(n));

      for (const root of roots) {
        // mixed order: headers + rows
        const nodes = Array.from(
          root.querySelectorAll(".show-for-large, .variant_list .row, .variant-row, .variant_list_row, .row")
        );

        let currentColour = null;

        for (const el of nodes) {
          const t = norm(el.innerText || "");
          if (!t) continue;

          // 1) colour header updates context
          const headerColour = colourFromText(t);
          if (headerColour) {
            currentColour = headerColour;
            colourSet.add(currentColour);
            continue;
          }

          // 2) size row
          const sizeMatch = t.match(
            /(?:Marime|Mărime|Lungime|Inaltime|Înălțime|Diametru)\s*:\s*([\s\S]*?)(?=\s*(?:EAN|IN)\b|$)/i
          );
          if (!sizeMatch || !sizeMatch[1]) continue;

          const sizeChunk = sizeMatch[1].trim();
          const sizeVal = extractSizeValue(sizeChunk);
          if (!sizeVal) continue;

          sizeSet.add(sizeVal);

          // 3) price: prefer blue span, else max in row text
          let priceEur = null;
          const spans = Array.from(el.querySelectorAll("span"));
          const blueSpan = spans.find(s => /color\s*:\s*#?0066cc/i.test(s.getAttribute("style") || ""));

          if (blueSpan) {
            const euros = pickPrices(blueSpan.textContent);
            if (euros.length) priceEur = Math.max(...euros);
          }
          if (priceEur == null) {
            const euros = pickPrices(t);
            if (euros.length) priceEur = Math.max(...euros);
          }

          const rowColour = currentColour || colourFromText(t) || null;
          if (rowColour) colourSet.add(rowColour);

          rowsOut.push({
            color: rowColour,
            size:  sizeVal,   // <-- can be "S", "M", "L", "110", etc.
            priceEur
          });
        }

        if (rowsOut.length) break; // stop at first root that yields variants
      }

      return {
        rows: rowsOut,
        colours: Array.from(colourSet),
        sizes:   Array.from(sizeSet)
      };
    });

    console.log("🎨 Colours (clean):", parsed.colours);
    console.log("📏 Sizes (strings):", parsed.sizes);
    console.log("💶 Row prices (EUR):", parsed.rows.map(r => ({ c: r.color, s: r.size, eur: r.priceEur })));

    /* 10) Pricing rule (RON, per-variant: round up in 5-lei increments, end with .99) */
const EUR_TO_RON = 4.97;

function toRON99_99(eur) {
  if (eur == null) return null;                // keep null if no price was parsed
  const ron = Number(eur) * EUR_TO_RON;        // convert EUR → RON
  const step = 5;                              // 5 RON bucket size
  const bucketUp = Math.ceil(ron / step);      // round UP to nearest 5 RON
  const target = bucketUp * step - 0.01;       // subtract 0.01 → always ends with .99
  return target.toFixed(2);
}




    /* 11) Build Shopify options + variants */
    // If parsed.colours missed but we saw colours earlier, merge:
    const allColours = parsed.colours && parsed.colours.length ? parsed.colours
                      : (colours && colours.length ? colours : []);

    // If there are no sizes, try to derive a per-colour price map directly from the page
let colourPriceMap = {};
if (!parsed.sizes.length) {
  colourPriceMap = await page.evaluate(() => {
    const norm = s => (s || "")
      .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
      .replace(/\s+/g, " ")
      .trim();

    const pickPrices = (txt) =>
      Array.from((txt || "").matchAll(/(\d{1,3}(?:[.,]\d{3})*|\d+)(?:[.,]\d+)?\s*€/g))
        .map(m => m[0].replace(/[^\d.,]/g, "").replace(/\./g, "").replace(",", "."))
        .map(Number)
        .filter(n => !Number.isNaN(n));

    const roots = [
      document,
      document.querySelector("#product_popup"),
      document.querySelector("div.reveal-overlay"),
    ].filter(Boolean);

    const out = {};
    for (const root of roots) {
      const nodes = Array.from(
        root.querySelectorAll(".show-for-large, .variant_list .row, .variant-row, .variant_list_row, .row")
      );

      let currentColour = null;

      for (const el of nodes) {
        const t = norm(el.innerText || "");
        if (!t) continue;

        // Detect colour headers like "Culoare: Verde"
        const mColour = t.match(/(?:Culoare|Colour|Color)\s*:\s*([^)]+?)(?=$|\)|,)/i);
        if (mColour && mColour[1]) {
          currentColour = mColour[1].trim();
          if (!(currentColour in out)) out[currentColour] = null;
          continue;
        }

        // If we’re inside a colour section, harvest prices under it
        if (currentColour) {
          const euros = pickPrices(t);
          if (euros.length) {
            const maxEur = Math.max(...euros);
            out[currentColour] = out[currentColour] == null
              ? maxEur
              : Math.max(out[currentColour], maxEur);
          }
        }
      }

      // stop at first root that yields any prices
      if (Object.values(out).some(v => v != null)) break;
    }

    return out;
  });

  // Also merge in any prices we already parsed on rows (if any) as a safety net
  for (const r of parsed.rows || []) {
    if (r?.color && r?.priceEur != null) {
      colourPriceMap[r.color] = Math.max(colourPriceMap[r.color] ?? -Infinity, r.priceEur);
    }
  }
}


    let options, variants = [];
    if (parsed.sizes.length > 0) {
      options = [{ name: "Colour", values: allColours }, { name: "Size", values: parsed.sizes }];
      const seen = new Set();
      for (const r of parsed.rows) {
        if (!r.size) continue;
        const colorVal = r.color || (allColours[0] || "Default");
        const key = `${colorVal}|||${r.size}`;
        if (seen.has(key)) continue;
        seen.add(key);

        // choose price: row price or fallback highest on page
        const eur = r.priceEur != null ? r.priceEur : highestEuroOnPage;

        variants.push({
          option1: colorVal,
          option2: r.size,
          price: toRON99_99(eur),
          inventory_policy: "continue",
          taxable: false,
          inventory_management: "shopify"
        });
      }
    } else {
  // No sizes -> colour-only variants, but price per colour if possible
  const colourValues = allColours.length ? allColours : ["Default"];
  options = [{ name: "Colour", values: colourValues }];

  variants = colourValues.map(color => {
    const eur =
      (colourPriceMap && colourPriceMap[color] != null)
        ? colourPriceMap[color]
        : highestEuroOnPage; // fallback

    return {
      option1: color,
      price: toRON99_99(eur),
      inventory_policy: "continue",
      taxable: false,
      inventory_management: "shopify"
    };
  });
}


    console.log("🗂️ Options built:", options);
    console.log("🧩 Variants built:", variants);

    /* 12) Description + specs */
    const { description_html, specs_html } = await page.evaluate(() => {
      function cleanHtml(el){
        if (!el) return null;
        const clone = el.cloneNode(true);
        clone.querySelectorAll("script, style").forEach(n=>n.remove());
        clone.querySelectorAll("[onclick],[onmouseover],[onmouseout],[onchange]").forEach(n=>{
          n.removeAttribute("onclick"); n.removeAttribute("onmouseover"); n.removeAttribute("onmouseout"); n.removeAttribute("onchange");
        });
        clone.querySelectorAll("img").forEach(img=>{
          const src = img.getAttribute("src") || "";
          if (src.startsWith("//")) img.setAttribute("src", "https:" + src);
          img.style.maxWidth = "100%"; img.style.height = "auto";
        });
        return clone.innerHTML.trim();
      }
      const descEl = document.querySelector("#description_content");
      const specEl = document.querySelector("#spec_content");
      return { description_html: descEl ? cleanHtml(descEl) : null, specs_html: specEl ? cleanHtml(specEl) : null };
    });

    /* 13) Detect Complete scooter for title / product_type */
    function normLower(s){ return (s||"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase(); }
    const specsStr = normLower(specs_html);
    const isCompleteScooter = specsStr.includes(normLower("Înălțime Ghidon")) && specsStr.includes(normLower("Lungime Deck"));
    let titleTypeForDisplay = detectedType;

if (isCompleteScooter) {
  detectedType = "Complete";
  titleTypeForDisplay = "Trotineta";
}

// ✅ If it’s a Clamp, and "SCS" is in the product title, show "SCS" instead of Clamp in the title
if (detectedType === "Clamp" && isSCS(productTitle)) {
  titleTypeForDisplay = "SCS";
}

const finalTitle = buildTitle(titleTypeForDisplay, detectedVendor, searchTerm);


    /* 14) OPEN overlay only now to scrape images */
    await page.click("div.medium-24.large-5.columns");
    await page.waitForSelector("div.reveal-overlay div#zoom_popup", { visible: true });

    const onclickFunctions = await page.evaluate(() =>
      Array.from(document.querySelectorAll("div"))
        .map(div => ({
          selector: div.id ? `#${div.id}` : (div.className ? '.' + div.className.trim().replace(/\s+/g,'.') : div.tagName.toLowerCase()),
          attr: div.getAttribute('onclick'),
          prop: typeof div.onclick === 'function' ? div.onclick.toString() : null
        }))
        .filter(item => (item.attr && item.attr.includes("open_zoom_box")) || (item.prop && item.prop.includes("open_zoom_box")))
    );

    function extractUrlsFromOnclick(onclickStr = ''){
      const m = onclickStr.match(/\(([\s\S]*)\)/);
      const argBlob = m ? m[1] : '';
      const raw = (argBlob.match(/\/\/[^,'")\s]+?\.(?:webp|jpe?g|png|gif)/gi) || []);
      const set = new Set(raw.map(u => u.startsWith('//') ? `https:${u}` : u));
      return Array.from(set);
    }

    const imageUrls = await page.evaluate(() => {
      return Array.from(
        document.querySelectorAll("div.reveal-overlay div#zoom_popup .img-container.slick-slide div.wrapper img")
      ).map(img => img.src.startsWith("//") ? `https:${img.src}` : img.src);
    });

    // Close overlay
    await page.click("div.reveal-overlay");
    await page.waitForTimeout(800);

    // Combine images from onclick attributes
    const parsedSet = new Set(imageUrls);
    for (const func of onclickFunctions) {
      const src = func?.attr || func?.prop || '';
      extractUrlsFromOnclick(src).forEach(u => parsedSet.add(u));
    }
    let finalImageUrls = Array.from(parsedSet);

    // Build a public base URL for this request
    const baseUrl = `${req.protocol}://${req.get("host")}`;

    // Put best-quality thumbnail first
    if (thumbnail) {
      const fileName = thumbnail.substring(thumbnail.lastIndexOf("/"));
      const regex = new RegExp(`${fileName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`);
      const candidates = finalImageUrls.filter(u => regex.test(u));
      let bestThumb = thumbnail, bestNum = 0;
      for (const url of candidates) {
        const m = url.match(/\/(\d+)\//);
        if (m) { const n = parseInt(m[1],10); if (n > bestNum) { bestNum = n; bestThumb = url; } }
      }
      finalImageUrls = [bestThumb, ...finalImageUrls.filter(u => u !== bestThumb)];
    }

    // Process images
    const processedImages = [];
    for (let i = 0; i < finalImageUrls.length; i++) {
      const processed = await processImage(finalImageUrls[i], i, baseUrl);
      if (processed) processedImages.push(processed);
    }

    /* 15) Respond */
    await browser.close();
    return res.json({
      success: true,
      imageUrls: processedImages,
      colours: allColours,
      sizes: parsed.sizes,                 // <-- return robust size list (letters + numbers)
      count: finalImageUrls.length,
      options,
      variants,
      description_html,
      specs_html,
      title: finalTitle,
      vendor: detectedVendor || undefined,
      tag: productTag || undefined,
      product_type: detectedType || "",
      status
    });

  } catch (err) {
    console.error("❌ Error in /scrape-product-images:", err);
    await browser.close();
    return res.status(500).json({ success: false, error: err.message, status });
  }
});

/* ---------------- Boot ---------------- */

app.get("/", (_, res) => res.send("Centrano Scraper Running"));
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🟢 Server listening on port ${PORT}`));
