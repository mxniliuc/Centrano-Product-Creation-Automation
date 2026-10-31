// lib/shopify.js
// Minimal Shopify Admin GraphQL client: upload images and create a product.

// Map our product onto Shopify's ProductSetInput (all options, variants and images at once).
function toProductSetInput(product, { status = "ACTIVE", mediaSources = [] } = {}) {
  return {
    title: product.title,
    descriptionHtml: product.descriptionHtml,
    vendor: product.vendor || undefined,
    productType: product.productType || undefined,
    tags: product.tags,
    status,
    productOptions: product.options.map(o => ({
      name: o.name,
      values: o.values.map(name => ({ name })),
    })),
    variants: product.variants.map(v => ({
      optionValues: Object.entries(v.options).map(([optionName, name]) => ({ optionName, name })),
      price: v.price ?? "0.00",
      barcode: v.barcode || undefined,
      inventoryPolicy: "CONTINUE",
      taxable: false,
      inventoryItem: { tracked: true, requiresShipping: true, sku: v.sku || undefined },
    })),
    files: mediaSources.map(originalSource => ({
      originalSource,
      contentType: "IMAGE",
      alt: product.title,
    })),
  };
}

function createShopifyClient({ store, accessToken, apiVersion }) {
  const shop = store.replace(/^https?:\/\//, "").replace(/\/.*$/, "");
  const endpoint = `https://${shop}/admin/api/${apiVersion}/graphql.json`;

  async function graphql(query, variables) {
    const res = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Shopify-Access-Token": accessToken },
      body: JSON.stringify({ query, variables }),
    });
    const text = await res.text();
    if (!res.ok) throw new Error(`Shopify HTTP ${res.status}: ${text.slice(0, 500)}`);
    const json = JSON.parse(text);
    if (json.errors?.length) throw new Error(`Shopify GraphQL error: ${json.errors.map(e => e.message).join("; ")}`);
    return json.data;
  }

  function throwOnUserErrors(op, userErrors) {
    if (userErrors?.length) {
      throw new Error(`${op} failed: ${userErrors.map(e => `${(e.field || []).join(".")}: ${e.message}`).join("; ")}`);
    }
  }

  // Upload local JPEG buffers to Shopify's staging storage.
  // Returns one URL per image (or null where the upload failed) to use as a media originalSource.
  async function stageImages(images) {
    if (!images.length) return [];
    const data = await graphql(
      `mutation StageImages($input: [StagedUploadInput!]!) {
        stagedUploadsCreate(input: $input) {
          stagedTargets { url resourceUrl parameters { name value } }
          userErrors { field message }
        }
      }`,
      {
        input: images.map(img => ({
          resource: "IMAGE",
          filename: img.filename,
          mimeType: "image/jpeg",
          httpMethod: "POST",
          fileSize: String(img.buffer.length),
        })),
      }
    );
    throwOnUserErrors("stagedUploadsCreate", data.stagedUploadsCreate.userErrors);

    const targets = data.stagedUploadsCreate.stagedTargets;
    return Promise.all(images.map(async (img, i) => {
      const target = targets[i];
      try {
        const form = new FormData();
        for (const { name, value } of target.parameters) form.append(name, value);
        form.append("file", new Blob([img.buffer], { type: "image/jpeg" }), img.filename);
        const res = await fetch(target.url, { method: "POST", body: form });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return target.resourceUrl;
      } catch (err) {
        console.warn(`   ⚠️  Upload of ${img.filename} failed: ${err.message}`);
        return null;
      }
    }));
  }

  // Create the product with all options, variants and images in one call.
  async function createProduct(product, options) {
    const input = toProductSetInput(product, options);

    const data = await graphql(
      `mutation CreateProduct($input: ProductSetInput!) {
        productSet(synchronous: true, input: $input) {
          product { id handle title status variantsCount { count } }
          userErrors { field message code }
        }
      }`,
      { input }
    );
    throwOnUserErrors("productSet", data.productSet.userErrors);

    const created = data.productSet.product;
    const storeHandle = shop.replace(/\.myshopify\.com$/, "");
    const numericId = created.id.split("/").pop();
    return { ...created, adminUrl: `https://admin.shopify.com/store/${storeHandle}/products/${numericId}` };
  }

  // Shopify processes images in the background. Wait a bit and report any that failed.
  async function waitForMedia(productId, { timeoutMs = 60000 } = {}) {
    const deadline = Date.now() + timeoutMs;
    let nodes = [];
    while (Date.now() < deadline) {
      const data = await graphql(
        `query Media($id: ID!) {
          product(id: $id) { media(first: 50) { nodes { status mediaErrors { message } } } }
        }`,
        { id: productId }
      );
      nodes = data.product?.media?.nodes || [];
      if (nodes.every(n => n.status === "READY" || n.status === "FAILED")) break;
      await new Promise(r => setTimeout(r, 3000));
    }
    return {
      ready: nodes.filter(n => n.status === "READY").length,
      failed: nodes.filter(n => n.status === "FAILED").flatMap(n => n.mediaErrors.map(e => e.message)),
      pending: nodes.filter(n => n.status !== "READY" && n.status !== "FAILED").length,
    };
  }

  return { graphql, stageImages, createProduct, waitForMedia };
}

module.exports = { createShopifyClient, toProductSetInput };
