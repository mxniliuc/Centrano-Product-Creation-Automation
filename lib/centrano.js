// lib/centrano.js
// Everything that talks to centrano.com through the browser:
// log in, search, and read one product's data out of its product popup.

const BASE_URL = "https://www.centrano.com";

/* ---------------- Login ---------------- */

async function login(page, email, password) {
  // The /ro/ login page also sets the session language to Romanian,
  // which the parser below relies on ("Culoare", "Mărime", ...).
  await page.goto(`${BASE_URL}/ro/login.php`, { waitUntil: "networkidle2" });

  // The page has two login forms (a hidden popup and the page form); use the page form.
  await page.type("#lg_page_email", email);
  await page.type("#lg_page_password", password);
  await Promise.all([
    page.waitForNavigation({ waitUntil: "networkidle2" }),
    page.$eval("#lg_page_password", el => el.form.requestSubmit()),
  ]);

  const loggedIn = await page.$('a[href*="logoff.php"]');
  if (!loggedIn) throw new Error("Centrano login failed. Check CENTRANO_EMAIL and CENTRANO_PASSWORD in .env");
}

/* ---------------- What to import ---------------- */

// Centrano has no product pages (products open in a popup), so a "product link" is
// either a search link copied from the address bar (?keywords=...) or a link with
// ?products_id=... (the format Centrano itself uses for its "back" links).
// Returns { keywords } | { productId } | { term } for a plain search term.
function parseTarget(arg) {
  const input = (arg || "").trim();

  const id = input.match(/^(?:#|id:)\s*(\d+)$/i);
  if (id) return { productId: id[1] };

  if (!/^(https?:\/\/|www\.)|centrano\.com/i.test(input)) return { term: input };

  let url;
  try {
    url = new URL(/^https?:\/\//i.test(input) ? input : `https://${input}`);
  } catch {
    throw new Error(`"${input}" doesn't look like a valid link`);
  }
  if (!/(^|\.)centrano\.com$/i.test(url.hostname)) {
    throw new Error(`Only Centrano links are supported, not ${url.hostname}`);
  }

  const productId = url.searchParams.get("products_id");
  if (productId && /^\d+$/.test(productId)) return { productId };
  const keywords = (url.searchParams.get("keywords") || "").trim();
  if (keywords) return { keywords };

  throw new Error(
    "This Centrano link doesn't point to a product. Search for the product on Centrano and copy the link from the address bar."
  );
}

/* ---------------- Search ---------------- */

function normWords(s) {
  return (s || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);
}

// Returns every product tile on the search results page: [{ id, name, brand }]
async function search(page, term) {
  const url = `${BASE_URL}/advanced_search_result.php?keywords=${encodeURIComponent(term)}`;
  await page.goto(url, { waitUntil: "networkidle2" });
  if (await page.$("#lg_page_email")) throw new Error("Not logged in to Centrano (redirected to the login page)");

  // Results are loaded with AJAX after the page itself
  await page.waitForSelector("article.pl-item, .pl-empty", { timeout: 30000 });

  return page.$$eval("article.pl-item", tiles => tiles.map(el => ({
    id: ((el.getAttribute("onclick") || "").match(/open_product_box\((\d+)/) || [])[1],
    name: (el.querySelector(".pl-name")?.textContent || "").trim(),
    brand: (el.querySelector(".pl-brand")?.textContent || "").trim(),
  })).filter(t => t.id));
}

// Prefer the first result whose name contains every word of the search term,
// otherwise fall back to the first result (what the old scraper always did).
function pickResult(results, term) {
  const wanted = normWords(term);
  return results.find(r => {
    const have = new Set(normWords(`${r.brand} ${r.name}`));
    return wanted.every(w => have.has(w));
  }) || results[0] || null;
}

/* ---------------- Product ---------------- */

// Runs INSIDE the browser page (Puppeteer serialises it), so it must not use
// anything from this module. Loads the same data the product popup shows
// (via /ajax_productinfo.php) and parses it.
async function parseProductInfo({ id, keywords }) {
  // Send the same parameters as the site's own popup; some products return HTTP 500 without them
  const params = new URLSearchParams({ products_id: id, action: "product_info", cPath: "", page: "", manufacturers_id: "", keywords: keywords || "" });
  const res = await fetch(`/ajax_productinfo.php?${params}`, { credentials: "include" });
  if (!res.ok) throw new Error(`ajax_productinfo.php returned HTTP ${res.status}`);
  const json = await res.json();

  const text = s => (s || "").replace(/\s+/g, " ").trim();
  const parse = html => new DOMParser().parseFromString(`<div id="root">${html || ""}</div>`, "text/html").getElementById("root");
  const absolute = u => (u.startsWith("//") ? `https:${u}` : u);

  // "124,98 €" / "1.249,95 €" -> [124.98] / [1249.95]
  const euros = s => Array.from((s || "").matchAll(/(\d{1,3}(?:\.\d{3})*|\d+)(?:,(\d+))?\s*€/g))
    .map(m => Number(`${m[1].replace(/\./g, "")}.${m[2] || 0}`))
    .filter(n => !Number.isNaN(n));

  function cleanHtml(root) {
    root.querySelectorAll("script, style").forEach(n => n.remove());
    root.querySelectorAll("*").forEach(el => {
      for (const attr of Array.from(el.attributes)) {
        if (/^on/i.test(attr.name) || attr.name === "class" || attr.name === "style") el.removeAttribute(attr.name);
      }
    });
    root.querySelectorAll("img").forEach(img => {
      img.setAttribute("src", absolute(img.getAttribute("src") || ""));
      img.setAttribute("style", "max-width:100%;height:auto");
    });
    // Drop the layout-only wrapper divs Centrano puts around the content
    root.querySelectorAll("div").forEach(div => div.replaceWith(...div.childNodes));
    return root.innerHTML.trim() || null;
  }

  const listing = parse(json.listing);
  const brandNode = listing.querySelector(".pp-head-brand");

  const groups = Array.from(listing.querySelectorAll("section.pp-group")).map(group => {
    const heading = text(group.querySelector(".pp-group-title")?.textContent);
    const colour = (heading.match(/^(?:Culoare|Colour|Color)\s*:\s*(.+)$/i) || [])[1] || null;

    // open_zoom_box('//images.centrano.com/1800/a.webp,//images.centrano.com/1800/b.webp,')
    const zoom = group.querySelector('[onclick*="open_zoom_box"]')?.getAttribute("onclick") || "";
    const images = (zoom.match(/\/\/[^,'")\s]+?\.(?:webp|jpe?g|png|gif)/gi) || []).map(absolute);

    const variants = Array.from(group.querySelectorAll(".pp-variant")).map(v => {
      const name = text(v.querySelector(".pp-variant-name")?.textContent);
      const labelled = name.match(/^([^:]+):\s*(.+)$/);  // "Mărime: S-M", "Diametru: 110mm"
      const meta = text(v.querySelector(".pp-variant-meta")?.textContent);
      // Regular recommended retail price. On promos Centrano shows "<s>37,95 €</s> 29,95 €";
      // the max keeps the regular price, like the old "highest € on the row" rule.
      const retail = euros(v.querySelector(".pp-srp")?.textContent);
      const cost = euros(v.querySelector(".pp-cost")?.textContent);
      return {
        name,
        optionLabel: labelled ? labelled[1].trim() : null,
        optionValue: labelled ? labelled[2].trim() : name,
        retailEur: retail.length ? Math.max(...retail) : null,
        costEur: cost.length ? Math.max(...cost) : null,
        sku: v.getAttribute("data-stock_code") || null,
        barcode: (meta.match(/\bEAN\s+(\d{8,14})\b/) || [])[1] || null,
      };
    });

    return { colour, images, variants };
  });

  const description = parse(json.description);
  return {
    brand: text(brandNode?.firstChild?.textContent),
    rawTitle: text(listing.querySelector(".pp-title")?.textContent),
    groups,
    highestEuro: Math.max(0, ...euros(listing.textContent)) || null,
    descriptionText: text(description.textContent),
    descriptionHtml: cleanHtml(description),
    specsHtml: cleanHtml(parse(json.specs)),
  };
}

async function scrapeProduct(page, productId, keywords) {
  const data = await page.evaluate(parseProductInfo, { id: productId, keywords });

  if (!data.rawTitle) {
    throw new Error(`Product #${productId} wasn't found on Centrano (or the popup layout has changed)`);
  }

  return {
    ...data,
    productId,
    imageUrls: [...new Set(data.groups.flatMap(g => g.images))],
  };
}

module.exports = { BASE_URL, login, parseTarget, search, pickResult, scrapeProduct, parseProductInfo };
