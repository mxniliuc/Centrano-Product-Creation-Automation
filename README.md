# Centrano → Shopify Product Import

A command-line tool that looks up a product on the supplier's site ([Centrano](https://www.centrano.com)), scrapes everything needed for a listing, and creates the product in a Shopify store.

It used to be an n8n workflow calling a Puppeteer server through ngrok. Now it's a single Node script, so there's no n8n, server, ngrok or Docker to run.

```bash
node import.js "tilt formula deck"
```

```
🔐 Logging in to Centrano…

🔎 "tilt formula deck"
   14 result(s) on Centrano, using: Tilt Formula Deck Trotinetă Freestyle (#49405)
   Title:    Deck Tilt Formula
   Vendor:   Tilt    Type: Deck
   Options:  Colour (1), Size (3)
   Variants: 3, 1244.99 RON
   🖼  Processing 3 image(s)…
   ⬆️  Uploading 3 image(s) to Shopify…
   ✅ Created "Deck Tilt Formula" as active with 3 variant(s)
      https://admin.shopify.com/store/pride-scooter/products/…
```

## Setup

You need **Node.js 22.12 or newer**.

```bash
npm install            # also downloads the Chrome build Puppeteer uses
cp .env.example .env   # then fill it in
```

`.env`:

| Variable | |
|---|---|
| `CENTRANO_EMAIL`, `CENTRANO_PASSWORD` | Your Centrano dealer login |
| `SHOPIFY_STORE` | e.g. `pride-scooter.myshopify.com` |
| `SHOPIFY_ACCESS_TOKEN` | Admin API token (`shpat_…`) with the `write_products` scope. The token from the n8n setup works. |
| `SHOPIFY_API_VERSION` | Optional, default `2026-07` |
| `EUR_TO_RON` | Optional, default `4.97` |
| `PUPPETEER_EXECUTABLE_PATH` | Optional, to use an installed Chrome instead of Puppeteer's |

## Usage

```bash
# One product
node import.js "tilt formula deck"

# Several at once (one login, one browser)
node import.js "core action sports casca" "root gt clamp" "lucky lunar 110mm"

# Try it without touching Shopify: saves product.json + images to output/
node import.js --dry-run "core cl1"

# Create as draft instead of active
node import.js --draft "root type r"

# Watch the browser while it works
node import.js --show-browser --dry-run "tilt formula deck"
```

Each search term does two jobs. It picks the product on Centrano (the first result whose name contains every word of the term, otherwise the first result) and it becomes the model name in the Shopify title.

## What it does

1. **Logs in** to Centrano with Puppeteer (headless Chrome).
2. **Searches** for the term and picks the matching result.
3. **Reads the product** from the same data Centrano's product popup shows: name, brand, colour groups, variant rows, prices, stock codes, EANs, images, description and specs.
4. **Builds the Shopify product**:
   - **Title**: `<type> <vendor> <search term>`, Title Case, duplicate words removed. Vendor names and short all-caps model codes keep their casing, e.g. `Deck Tilt Formula`, `Trotineta Core CL1`, `Sticker TLC`.
   - **Vendor / tag**: Centrano's brand, matched against the vendor list in `lib/product.js`.
   - **Product type**: matched from the product name against the type list and aliases (e.g. *grips* → `Mansoane`, *clamp/SCS* → `Clamp`). Complete scooters (specs list both *Înălțime ghidon* and *Lungime deck*) become `Complete` and are titled `Trotineta …`.
   - **Options / variants**: `Colour` from each colour group, `Size` from labelled rows (`Mărime`, `Diametru`, …). Each variant gets its own price, plus Centrano's stock code as SKU and the EAN as barcode. Inventory is tracked, "continue selling when out of stock" is on, and tax is off.
   - **Price**: Centrano's recommended retail price (€) × `EUR_TO_RON`, rounded **up** to the next 5 RON and ending in `.99` (e.g. 249.95 € → 1244.99 RON). On supplier promos, the regular retail price is used.
   - **Description**: Centrano's description followed by the specs table.
5. **Processes images**: every image is downloaded and fit into 2048×2048 on a white background as a JPEG.
6. **Creates the product** in Shopify with all options, variants and images in one call (GraphQL `productSet`). Images are uploaded straight to Shopify, so nothing has to be publicly hosted. If an upload fails, Centrano's original image URL is used instead.

If any variant ends up without a price, the product is created as a **draft** so nothing goes live at 0 RON.

## Files it writes

- `output/<product>/`: `product.json` (everything that was sent or would be sent to Shopify) and the processed images. Written on every run, dry or not.
- `debug/`: an HTML + screenshot snapshot of the page whenever something fails, which shows exactly what Centrano displayed.

## Tests

```bash
npm test
```

## Project layout

```
import.js          CLI: arguments, .env, orchestration and output
lib/centrano.js    login, search and product parsing (runs in the browser)
lib/product.js     vendor/type detection, title, pricing, options and variants
lib/images.js      download + resize to 2048×2048
lib/shopify.js     Shopify Admin GraphQL: image uploads and productSet
```

## Troubleshooting

- **"Centrano login failed"**: check the credentials in `.env`. The snapshot in `debug/` shows what the login page displayed.
- **"No products found"**: the search term doesn't match anything on Centrano. Try fewer or different words.
- **Product type or vendor is wrong/missing**: add the brand to `VENDORS` or a keyword to `PRODUCT_TYPE_ALIASES` in `lib/product.js`.
- **Shopify `Access denied`**: the token needs the `write_products` scope.
- **Centrano changed its site again**: all selectors live in `lib/centrano.js`. Run with `--show-browser --dry-run` and look at the snapshot in `debug/`.
