// Run with: npm test
// Fixtures mirror what lib/centrano.js parses out of Centrano's product popup.
const test = require("node:test");
const assert = require("node:assert/strict");

const { toRON99, detectProductType, buildTitle, buildVariants, buildProduct } = require("../lib/product");
const { pickResult } = require("../lib/centrano");
const { toProductSetInput } = require("../lib/shopify");

const variant = (name, retailEur, extra = {}) => {
  const labelled = name.match(/^([^:]+):\s*(.+)$/);
  return {
    name,
    optionLabel: labelled ? labelled[1] : null,
    optionValue: labelled ? labelled[2] : name,
    retailEur,
    costEur: retailEur / 2,
    sku: null,
    barcode: null,
    ...extra,
  };
};

const tiltDeck = {
  productId: "49405",
  brand: "Tilt",
  rawTitle: "Tilt Formula Deck Trotinetă Freestyle",
  groups: [{
    colour: "Negru",
    images: ["https://images.centrano.com/1800/a.webp", "https://images.centrano.com/1800/b.webp"],
    variants: [
      variant('Mărime: 6.0"', 249.95, { sku: "10-43-920", barcode: "739904936855" }),
      variant('Mărime: 6.5"', 249.95, { sku: "10-44-920", barcode: "739904936534" }),
    ],
  }],
  highestEuro: 249.95,
  descriptionText: "This is a high performance deck for freestyle scooters.",
  descriptionHtml: "<p>This is a high performance deck for freestyle scooters.</p>",
  specsHtml: "<table><tr><td><strong>Lungime deck</strong>:</td><td> 56cm</td></tr><tr><td><strong>Diametru osie</strong>:</td><td> 8mm</td></tr></table>",
  imageUrls: ["https://images.centrano.com/1800/a.webp", "https://images.centrano.com/1800/b.webp"],
};

test("EUR -> RON rounds up to the next 5 RON and ends in .99", () => {
  assert.equal(toRON99(249.95, 4.97), "1244.99");
  assert.equal(toRON99(12.95, 4.97), "64.99");
  assert.equal(toRON99(1.95, 4.97), "9.99");
  assert.equal(toRON99(null, 4.97), null);
});

test("product type comes from the Centrano title", () => {
  assert.equal(detectProductType("Tilt Formula Deck Trotinetă Freestyle"), "Deck");
  assert.equal(detectProductType("CORE Grips Trotinetă"), "Mansoane");
  assert.equal(detectProductType("CORE Action Sports Cască"), "Casca");
  assert.equal(detectProductType("Tilt Double Clamp Shim"), "Clamp");
  assert.equal(detectProductType("Root Air 110mm Roți Trotinetă Freestyle Pachet 2 buc"), "Roti");
});

test("titles: type first, no duplicate words, vendor and model codes keep their casing", () => {
  assert.equal(buildTitle("Deck", "Tilt", "tilt formula deck"), "Deck Tilt Formula");
  assert.equal(buildTitle("Sticker", "TLC", "tlc sticker"), "Sticker TLC");
  assert.equal(buildTitle("Trotineta", "Core", "core cl1", "CORE CL1 Trotinetă Freestyle"), "Trotineta Core CL1");
  assert.equal(buildTitle("Clamp", "Root Industries", "root gt clamp", "Root GT Clamp Trotinete Freestyle"), "Clamp Root Industries GT");
});

test("colour groups with sizes become Colour x Size variants", () => {
  const { options, variants } = buildVariants({
    groups: [
      { colour: "Negru", variants: [variant("Mărime: XS-S", 37.95), variant("Mărime: S-M", 37.95)] },
      { colour: "Roz", variants: [variant("Mărime: S-M", 29.95)] },
    ],
  }, 4.97);
  assert.deepEqual(options, [
    { name: "Colour", values: ["Negru", "Roz"] },
    { name: "Size", values: ["XS-S", "S-M"] },
  ]);
  assert.deepEqual(variants.map(v => [v.options.Colour, v.options.Size, v.price]), [
    ["Negru", "XS-S", "189.99"],
    ["Negru", "S-M", "189.99"],
    ["Roz", "S-M", "149.99"],
  ]);
});

test("rows that just repeat the colour name become colour-only variants", () => {
  const { options, variants } = buildVariants({
    groups: [
      { colour: "Hulk", variants: [variant("Hulk", 12.95)] },
      { colour: "Bark", variants: [variant("Bark", 13.95)] },
    ],
  }, 4.97);
  assert.deepEqual(options, [{ name: "Colour", values: ["Hulk", "Bark"] }]);
  assert.deepEqual(variants.map(v => v.price), ["64.99", "69.99"]);
});

test("a product with no options becomes a single Default Title variant", () => {
  const { options, variants } = buildVariants({ groups: [], highestEuro: 10 }, 4.97);
  assert.deepEqual(options, [{ name: "Title", values: ["Default Title"] }]);
  assert.equal(variants[0].price, "49.99");
});

test("every variant gets a value for every option", () => {
  const { variants } = buildVariants({
    groups: [
      { colour: "Negru", variants: [variant("Mărime: S", 10)] },
      { colour: "Alb", variants: [variant("Alb", 10)] },
    ],
  }, 4.97);
  assert.deepEqual(variants.map(v => v.options), [
    { Colour: "Negru", Size: "S" },
    { Colour: "Alb", Size: "One Size" },
  ]);
});

test("buildProduct puts it all together", () => {
  const p = buildProduct(tiltDeck, "tilt formula deck");
  assert.equal(p.title, "Deck Tilt Formula");
  assert.equal(p.vendor, "Tilt");
  assert.deepEqual(p.tags, ["Tilt"]);
  assert.equal(p.productType, "Deck");
  assert.equal(p.variants.length, 2);
  assert.equal(p.variants[0].sku, "10-43-920");
  assert.match(p.descriptionHtml, /high performance deck[\s\S]*Lungime deck/);
  assert.deepEqual(p.warnings, []);
});

test("complete scooters are detected from the specs", () => {
  const p = buildProduct({
    ...tiltDeck,
    brand: "Root Industries",
    rawTitle: "Root Type R Trotinetă Freestyle",
    specsHtml: "<td>Înălțime ghidon</td><td>Lungime deck</td>",
  }, "root type r");
  assert.equal(p.productType, "Complete");
  assert.equal(p.title, "Trotineta Root Industries Type R");
});

test("unknown brands are kept but flagged", () => {
  const p = buildProduct({ ...tiltDeck, brand: "i-Glide", rawTitle: "i-Glide Trotinetă Grips" }, "i-glide grips");
  assert.equal(p.vendor, "i-Glide");
  assert.match(p.warnings.join(" "), /not in the vendor list/);
});

test("search picks the result that contains every search word", () => {
  const results = [
    { id: "1", brand: "Tilt", name: "Tilt Formula Deck Trotinetă Freestyle" },
    { id: "2", brand: "Tilt", name: "Tilt Formula Griptape" },
  ];
  assert.equal(pickResult(results, "tilt formula griptape").id, "2");
  assert.equal(pickResult(results, "something else").id, "1");
  assert.equal(pickResult([], "x"), null);
});

test("Shopify input has matching options/variants, policy, SKU and barcode", () => {
  const p = buildProduct(tiltDeck, "tilt formula deck");
  const input = toProductSetInput(p, { status: "DRAFT", mediaSources: ["https://example.com/1.jpg"] });
  assert.equal(input.status, "DRAFT");
  assert.deepEqual(input.productOptions.map(o => o.name), ["Colour", "Size"]);
  assert.deepEqual(input.variants[0], {
    optionValues: [{ optionName: "Colour", name: "Negru" }, { optionName: "Size", name: '6.0"' }],
    price: "1244.99",
    barcode: "739904936855",
    inventoryPolicy: "CONTINUE",
    taxable: false,
    inventoryItem: { tracked: true, requiresShipping: true, sku: "10-43-920" },
  });
  assert.deepEqual(input.files, [{ originalSource: "https://example.com/1.jpg", contentType: "IMAGE", alt: "Deck Tilt Formula" }]);

  // Every variant option value must exist in the product options
  for (const v of input.variants) {
    for (const ov of v.optionValues) {
      const opt = input.productOptions.find(o => o.name === ov.optionName);
      assert.ok(opt.values.some(val => val.name === ov.name), `${ov.optionName}=${ov.name}`);
    }
  }
});

test("arguments: search terms, Centrano links and product IDs", () => {
  const { parseTarget } = require("../lib/centrano");
  assert.deepEqual(parseTarget("tilt formula deck"), { term: "tilt formula deck" });
  assert.deepEqual(parseTarget("https://www.centrano.com/advanced_search_result.php?keywords=tilt+formula+deck"), { keywords: "tilt formula deck" });
  assert.deepEqual(parseTarget("https://www.centrano.com/ro/advanced_search_result.php?keywords=north%20club%20g4&language=ro"), { keywords: "north club g4" });
  assert.deepEqual(parseTarget("www.centrano.com/advanced_search_result.php?keywords=root+gt"), { keywords: "root gt" });
  assert.deepEqual(parseTarget("https://www.centrano.com/?products_id=49405"), { productId: "49405" });
  assert.deepEqual(parseTarget("id:49405"), { productId: "49405" });
  assert.deepEqual(parseTarget("#49405"), { productId: "49405" });
  assert.throws(() => parseTarget("https://www.tiltscooters.com/formula-deck"), /Only Centrano links/);
  assert.throws(() => parseTarget("https://www.centrano.com/ro/m176.htm"), /doesn't point to a product/);
});

test("links: the title's model name comes from Centrano's product name", () => {
  const { modelFromTitle } = require("../lib/product");
  assert.equal(modelFromTitle("Tilt Formula Deck Trotinetă Freestyle"), "Tilt Formula Deck");
  assert.equal(modelFromTitle("CORE Grips Trotinetă"), "CORE Grips");
  assert.equal(modelFromTitle("Indo Bug Trotineta Trambulina"), "Indo Bug Trotineta Trambulina");

  assert.equal(buildProduct(tiltDeck, null).title, "Deck Tilt Formula");
  const helmet = { ...tiltDeck, brand: "Core", rawTitle: "CORE Action Sports Cască", specsHtml: "" };
  assert.equal(buildProduct(helmet, null).title, "Casca Core Action Sports");
  const complete = { ...tiltDeck, brand: "Core", rawTitle: "CORE CL1 Trotinetă Freestyle", specsHtml: "Înălțime ghidon Lungime deck" };
  assert.equal(buildProduct(complete, null).title, "Trotineta Core CL1");
});

test("Shopify client exchanges the client ID/secret for a token once and reuses it", async () => {
  const { createShopifyClient } = require("../lib/shopify");
  const calls = [];
  const realFetch = global.fetch;
  global.fetch = async (url, opts) => {
    calls.push({ url, opts });
    if (url.endsWith("/admin/oauth/access_token")) {
      return new Response(JSON.stringify({ access_token: "token-1", scope: "write_products", expires_in: 86399 }));
    }
    return new Response(JSON.stringify({ data: { shop: { name: "Pride" }, currentAppInstallation: { accessScopes: [{ handle: "write_products" }] } } }));
  };
  try {
    const shopify = createShopifyClient({ store: "pride-scooter.myshopify.com", clientId: "id", clientSecret: "secret", apiVersion: "2026-07" });
    assert.equal((await shopify.checkAccess()).shopName, "Pride");
    await shopify.checkAccess();

    const tokenCalls = calls.filter(c => c.url.endsWith("/admin/oauth/access_token"));
    assert.equal(tokenCalls.length, 1);
    assert.equal(tokenCalls[0].url, "https://pride-scooter.myshopify.com/admin/oauth/access_token");
    assert.equal(String(tokenCalls[0].opts.body), "grant_type=client_credentials&client_id=id&client_secret=secret");
    const apiCalls = calls.filter(c => c.url.endsWith("/graphql.json"));
    assert.equal(apiCalls.length, 2);
    assert.equal(apiCalls[0].opts.headers["X-Shopify-Access-Token"], "token-1");
  } finally {
    global.fetch = realFetch;
  }
});

test("Shopify token errors explain what to fix", async () => {
  const { createShopifyClient } = require("../lib/shopify");
  const realFetch = global.fetch;
  global.fetch = async () => new Response("<title>400 - Oauth error app_not_installed</title>", { status: 400 });
  try {
    const shopify = createShopifyClient({ store: "pride-scooter.myshopify.com", clientId: "id", clientSecret: "secret", apiVersion: "2026-07" });
    await assert.rejects(shopify.checkAccess(), /app_not_installed\). The app isn't installed on pride-scooter\.myshopify\.com/);
  } finally {
    global.fetch = realFetch;
  }
});

test("a row that just repeats the product name is not an option", () => {
  const { options, variants } = buildVariants({
    rawTitle: "Core SL3 Corey Sponseller Signature Deck Trotinetă Freestyle",
    groups: [{ colour: null, variants: [variant("Core SL3 Corey Sponseller Signature Deck Trotinetă Freestyle", 154.95)] }],
  }, 4.97);
  assert.deepEqual(options, [{ name: "Title", values: ["Default Title"] }]);
  assert.equal(variants[0].price, "774.99");
});

test("products are published to the Online Store publication", async () => {
  const { createShopifyClient } = require("../lib/shopify");
  const bodies = [];
  const realFetch = global.fetch;
  global.fetch = async (url, opts) => {
    const body = JSON.parse(opts.body);
    bodies.push(body);
    if (body.query.includes("publications(")) {
      return new Response(JSON.stringify({ data: { publications: { nodes: [
        { id: "gid://shopify/Publication/1", name: "Point of Sale" },
        { id: "gid://shopify/Publication/2", name: "Online Store" },
      ] } } }));
    }
    return new Response(JSON.stringify({ data: { publishablePublish: { userErrors: [] } } }));
  };
  try {
    const shopify = createShopifyClient({ store: "pride-scooter.myshopify.com", accessToken: "t", apiVersion: "2026-07" });
    await shopify.publishToOnlineStore("gid://shopify/Product/10");
    await shopify.publishToOnlineStore("gid://shopify/Product/11");
    const publishes = bodies.filter(b => b.query.includes("publishablePublish"));
    assert.equal(bodies.filter(b => b.query.includes("publications(")).length, 1);  // looked up once
    assert.deepEqual(publishes.map(b => b.variables), [
      { id: "gid://shopify/Product/10", input: [{ publicationId: "gid://shopify/Publication/2" }] },
      { id: "gid://shopify/Product/11", input: [{ publicationId: "gid://shopify/Publication/2" }] },
    ]);
  } finally {
    global.fetch = realFetch;
  }
});
