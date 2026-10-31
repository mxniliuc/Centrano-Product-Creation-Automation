// lib/product.js
// Pure product logic: vendor/type detection, title building, pricing and
// Shopify options/variants. No browser or network access in here.

/* ---------------- Vendor & Type detection ---------------- */

const VENDORS = [
  "Revolution Supply Co","Radio Bike Co","Cadillac Wheels","Retrospec","Reversal",
  "Whitespace","GoZone Skimboards","DB Skimboards","Family","Colony","Dominator", "Drone", "Dial 911",
  "Habitat Skateboards","Meow Skateboards","Ocean Pacific","Root Industries",
  "Triple Eight","Essentials Skateboarding","Grit","Salt","Sisu","TLC","Apex",
  "Academy","Alien Workshop","Blueprint BMXFIX","BSD","Cadillac","Core","Crisp",
  "Division","Doomed","Drone Scooters","Eclat","Eight Ball","Fiction BMX",
  "Figz Collection","Flexsurfing","Flypaper","Fuse","Graw Jump Ramps","Habitat",
  "HangUp","Heart Supply","Hella Grip","Hohing","Indo","JD Bug","Jessup","KFD",
  "Kitefix","Longway","Lucky","Madrid","Mafia","Native","North Scooters","North",
  "Panda","Pivot","Prime8","Primus","Proto","RAD Skateboards","Rampage","River",
  "Roces","Rocker","Root","Skatemate","Speed Demons","Stolen","Striker","Supreme",
  "Tall Order","Tempish","Tilt","Triple Skate Hook","Trynyty","Venom","Venor Skates",
  "Verb","Wethepeople","Wildcat","Zoo York","Odi"
].sort((a, b) => b.length - a.length);

const PRODUCT_TYPES = [
  "Adaptor","Bar End", "BPM","Casca","Ceara","Clamp","Complete","Deck","Deck End",
  "Distantieri","Diverse", "Frana","Furca","Genunchiere","Ghidon","Glezniere","Griptape",
  "Headset","Imbracaminte","Imbus","Inbus","Kendama","Mansoane","Peg","Roti", "Roata", "Roți",
  "Rulmenti","Sporting Goods","Stand","Sticker","Suruburi","Talpici"
];

// Canonical product type -> list of patterns that should map to it
const PRODUCT_TYPE_ALIASES = {
  Mansoane: [ /\bmans?oane\b/i, /\bgrips?\b/i ],
  "Bar End": [ /\bbar\s*end(s)?\b/i, /\bbar-?ends?\b/i, /\bbarends?\b/i ],
  Clamp: [ /\bclamps?\b/i, /\bclema\b/i, /\bscs\b/i ],
  Adaptor: [ /\badaptors?\b/i, /\badapters?\b/i, /\bshim(s)?\b/i, /\bc[-\s]?ring\b/i, /\bsleeves?\b/i ],
  Distantieri: [ /\bspacer(s)?\b/i, /\bdistantier(i)?\b/i ],
  "Deck End": [ /\bdeck\s*end(s)?\b/i, /\bplugs?\b/i ],
  Ceara: [ /\bceara\b/i, /\bwax\b/i ],
  Stand: [ /\bstand\b/i ],
  "Top Cap": [ /\btop\s*cap\b/i, /\bstar[-\s]?nut\b/i, /\bstarnut\b/i ],
  Suruburi: [ /\bbolt(s)?\b/i, /\bsurub(uri)?\b/i, /\bnut(s)?\b/i, /\bpiulit[aă]\b/i, /\bax\b/i, /\bosie(i)?\b/i ],
  Rulmenti: [ /\bbearing(s)?\b/i, /\brulment(i)?\b/i ],
  Imbus: [ /\btool(s)?\b/i, /\bimbus\b/i, /\binbus\b/i ],
};

function stripDiacritics(s) {
  return (s || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

function norm(s) {
  return stripDiacritics(s).toLowerCase();
}

function textIncludesWord(text, word) {
  // word-boundary-ish check on normalized text
  const t = " " + norm(text).replace(/[^a-z0-9]+/g, " ") + " ";
  const w = " " + norm(word) + " ";
  return t.includes(w);
}

function detectVendor(fullText) {
  for (const v of VENDORS) if (textIncludesWord(fullText, v)) return v;
  return null;
}

function detectProductType(fullText) {
  const ntext = norm(fullText);

  // Hard priority: Clamp beats everything else
  if (PRODUCT_TYPE_ALIASES.Clamp.some(re => re.test(ntext))) return "Clamp";

  // 1) Aliases/synonyms first (so keywords like "Shim", "Top Cap", etc. win)
  for (const [canonical, patterns] of Object.entries(PRODUCT_TYPE_ALIASES)) {
    if (patterns.some(re => re.test(ntext))) return canonical;
  }

  // 2) Fall back to exact canonical names
  for (const t of PRODUCT_TYPES) {
    if (textIncludesWord(ntext, t)) return t;
  }

  return null;
}

function isSCS(title) {
  return /\bscs\b/i.test(title);
}

/* ---------------- Title helpers ---------------- */

function toTitleCase(str) {
  return (str || "").replace(/\S+/g, w => w[0].toUpperCase() + w.slice(1).toLowerCase());
}

// Remove duplicated words, keeping the first occurrence.
// "Trotineta Tilt Tilt Contact Pro Pro" -> "Trotineta Tilt Contact Pro"
function dedupeTitleWords(title) {
  if (!title) return title;
  const seen = new Set();
  const out = [];
  for (const tok of title.split(/\s+/)) {
    const key = stripDiacritics(tok).toLowerCase().replace(/[^a-z0-9]+/gi, "");
    if (!key) { out.push(tok); continue; }   // keep punctuation-ish tokens as-is
    if (!seen.has(key)) { seen.add(key); out.push(tok); }
  }
  return out.join(" ").replace(/\s{2,}/g, " ").trim();
}

// Build title from parts, dedupe whole parts, then dedupe individual words.
// Title Case would turn "TLC" into "Tlc" and "CL1" into "Cl1", so words keep the
// vendor's casing, and short all-caps / model-code words keep Centrano's casing.
function buildTitle(productType, vendor, searchTerm, sourceTitle = "") {
  const parts = [productType, vendor, searchTerm].map(s => (s || "").toString().trim()).filter(Boolean);
  const out = [], seenParts = new Set();
  for (const p of parts) {
    const k = stripDiacritics(p).toLowerCase();
    if (!seenParts.has(k)) { seenParts.add(k); out.push(p); }
  }

  const keepCase = new Map();
  for (const w of (sourceTitle || "").split(/\s+/)) {
    if (w.length <= 4 && /[A-Z]/.test(w) && w === w.toUpperCase()) keepCase.set(norm(w), w);
  }
  for (const w of (vendor || "").split(/\s+/)) keepCase.set(norm(w), w);

  const titled = toTitleCase(out.join(" ")).replace(/\S+/g, w => keepCase.get(norm(w)) || w);
  return dedupeTitleWords(titled);
}

// The model part of Centrano's product name, used in the title when there is no
// search term (product links). Drops the generic "Trotinetă Freestyle" suffix and
// "Pachet 2 buc" (the shop's wheel titles leave it out); buildTitle's word dedupe
// then removes the vendor and type words.
// "Tilt Formula Deck Trotinetă Freestyle" -> "Tilt Formula Deck" -> title "Deck Tilt Formula"
function modelFromTitle(title) {
  return cleanTitle(title)
    .replace(/(^|\s)trotinet[ăae]\s+freestyle(?=\s|$)/gi, " ")
    .replace(/(^|\s)pachet\s+\d+\s+buc(?=\s|$)/gi, " ")
    .replace(/\s+trotinet[ăae]\s*$/i, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}

function cleanTitle(s) {
  return (s || "")
    .replace(/\s+/g, " ")
    .replace(/\bzoom[_-]?in\b/gi, "")
    .replace(/\s*\(Culoare:[^)]+?\)\s*$/i, "")
    .trim();
}

/* ---------------- Pricing ---------------- */

// EUR -> RON, rounded UP to the next 5 RON bucket, always ending in .99
// e.g. 18.99 EUR * 4.97 = 94.38 RON -> 94.99
function toRON99(eur, eurToRon) {
  if (eur == null) return null;
  const ron = Number(eur) * eurToRon;
  const step = 5;
  return (Math.ceil(ron / step) * step - 0.01).toFixed(2);
}

/* ---------------- Options + variants ---------------- */

// Turn the scraped colour groups into Shopify options + variants.
// Each Centrano colour group ("Culoare: Negru") holds variant rows that are either
// labelled ("Mărime: S-M", "Diametru: 110mm") -> Size, or just repeat the colour name.
// Each variant is { options: { Colour: "Negru", Size: "S-M" }, price: "94.99" | null, sku, barcode }
function buildVariants(scraped, eurToRon) {
  const { groups = [], highestEuro = null } = scraped;
  const variants = [];
  const seen = new Set();

  for (const group of groups) {
    for (const v of group.variants) {
      const options = {};
      // Single-variant products sometimes just repeat the product name on the row
      const value = !v.optionLabel && norm(v.optionValue) === norm(scraped.rawTitle) ? null : v.optionValue;
      let colour = group.colour;
      if (!colour && !v.optionLabel && value) colour = value;  // unlabelled row, no colour heading
      if (colour) options.Colour = colour;
      if (v.optionLabel || (value && value !== colour)) options.Size = value;

      const key = JSON.stringify(options);
      if (seen.has(key)) continue;
      seen.add(key);

      const eur = v.retailEur != null ? v.retailEur : highestEuro;
      variants.push({ options, price: toRON99(eur, eurToRon), sku: v.sku || null, barcode: v.barcode || null });
    }
  }

  // Single-variant product: Shopify represents it as option "Title" = "Default Title"
  if (!variants.length || (variants.length === 1 && !Object.keys(variants[0].options).length)) {
    const only = variants[0] || {};
    variants.length = 0;
    variants.push({ ...only, options: { Title: "Default Title" }, price: only.price ?? toRON99(highestEuro, eurToRon) });
  }

  // Every variant needs a value for every option
  const optionNames = ["Colour", "Size", "Title"].filter(name => variants.some(v => v.options[name]));
  for (const v of variants) {
    if (optionNames.includes("Colour") && !v.options.Colour) v.options.Colour = "Default";
    if (optionNames.includes("Size") && !v.options.Size) v.options.Size = "One Size";
  }
  const options = optionNames.map(name => ({
    name,
    values: [...new Set(variants.map(v => v.options[name]).filter(Boolean))],
  }));

  return { options, variants };
}

/* ---------------- Whole product ---------------- */

// Combine everything scraped from Centrano into the product we send to Shopify.
// searchTerm is the model name for the title; without one (product links) it is
// taken from Centrano's product name.
function buildProduct(scraped, searchTerm, { eurToRon = 4.97 } = {}) {
  const productTitle = cleanTitle(scraped.rawTitle);
  // Centrano now shows the brand on its own; still map it onto the shop's vendor list
  const matchedVendor = detectVendor(scraped.brand) || detectVendor(productTitle);
  const vendor = matchedVendor || scraped.brand || null;
  // The product name is the most reliable signal; the description is a fallback
  let productType = detectProductType(productTitle) || detectProductType(scraped.descriptionText) || "";

  // Complete scooter: specs list both handlebar height and deck length
  const specs = norm(scraped.specsHtml);
  const isCompleteScooter = specs.includes(norm("Înălțime Ghidon")) && specs.includes(norm("Lungime Deck"));
  let titleType = productType;
  if (isCompleteScooter) { productType = "Complete"; titleType = "Trotineta"; }
  // Clamp with "SCS" in the name shows "SCS" in the title instead of "Clamp"
  if (productType === "Clamp" && isSCS(productTitle)) titleType = "SCS";

  const { options, variants } = buildVariants(scraped, eurToRon);

  const warnings = [];
  if (!matchedVendor) warnings.push(`Brand "${scraped.brand || "?"}" is not in the vendor list; using it as-is.`);
  if (!productType) warnings.push("No product type matched the product type list.");
  if (variants.some(v => v.price == null)) warnings.push("At least one variant has no price.");
  if (!scraped.imageUrls?.length) warnings.push("No images found.");

  return {
    title: buildTitle(titleType, vendor, searchTerm || modelFromTitle(productTitle), productTitle),
    sourceTitle: productTitle,
    centranoProductId: scraped.productId,
    vendor,
    tags: vendor ? [vendor] : [],
    productType,
    descriptionHtml: [scraped.descriptionHtml, scraped.specsHtml].filter(Boolean).join("\n"),
    options,
    variants,
    imageUrls: scraped.imageUrls || [],
    warnings,
  };
}

module.exports = {
  VENDORS,
  PRODUCT_TYPES,
  detectVendor,
  detectProductType,
  buildTitle,
  modelFromTitle,
  cleanTitle,
  toRON99,
  buildVariants,
  buildProduct,
};
