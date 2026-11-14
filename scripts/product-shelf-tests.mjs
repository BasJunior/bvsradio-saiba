import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';

const cache = new Map();
async function moduleFor(name) {
  if (cache.has(name)) return cache.get(name);
  let source = fs.readFileSync(`src/lib/${name}.ts`, 'utf8');
  const imports = [...source.matchAll(/from ['"]@\/lib\/([^'"]+)['"]/g)];
  for (const match of imports) source = source.replace(match[0], `from '${await moduleFor(match[1])}'`);
  const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ES2022, target: ts.ScriptTarget.ES2022 } }).outputText;
  const url = `data:text/javascript;base64,${Buffer.from(code).toString('base64')}`;
  cache.set(name, url);
  return url;
}
const read = (path) => fs.readFileSync(path, 'utf8');

const shelf = await import(await moduleFor('product-shelf'));

// Shaping: database rows become display products without leaking the private file.
const product = shelf.shelfProductFromRow({
  id: 'p1', seller_user_id: 'seller', category: 'drum_kit', title: 'Kit', slug: 'kit-abc123', description: 'Hits',
  price_usd: '9.5', artwork_path: 'marketplace/seller/art.jpg', preview_path: 'marketplace/seller/demo.mp3',
  asset_path: 'marketplace/seller/private.zip', licence_summary: 'Royalty-free', licence_terms: 'Full terms',
  profiles: { username: 'producer', creator_public_name: 'Zim Producer' },
});
assert.equal(product.priceUsd, 9.5);
assert.equal(product.categoryLabel, 'Drum kits');
assert.equal(product.artworkUrl, '/api/media/marketplace/seller/art.jpg');
assert.equal(product.previewUrl, '/api/media/marketplace/seller/demo.mp3');
assert.equal(product.sellerName, 'Zim Producer');
assert.equal(product.storefrontSlug, 'zim-producer');
assert.equal(product.licenceTerms, 'Full terms');
assert.ok(!JSON.stringify(product).includes('private.zip'), 'the private download path never reaches the storefront');
assert.equal(shelf.shelfProductFromRow({ id: 'p2', title: 'X', slug: 'x', price_usd: 5, category: 'made_up' }).category, 'other', 'unknown categories fall back safely');
assert.ok(!('licenceTerms' in shelf.shelfProductFromRow({ id: 'p3', title: 'X', slug: 'x', price_usd: 5 })), 'list rows carry no full terms');

// Slugs are validated before they reach a database filter.
assert.ok(shelf.isShelfSlug('zim-drum-kit-a1b2c3'));
for (const bad of ['', '../x', 'a b', 'A', 'x&status=eq.draft', '-lead']) assert.ok(!shelf.isShelfSlug(bad), `rejects ${bad}`);

// Planned products are a roadmap, not stock.
assert.ok(shelf.PLANNED_SHELF_PRODUCTS.length >= 3 && shelf.PLANNED_SHELF_PRODUCTS.length <= 5, 'launch catalogue stays small');
for (const planned of shelf.PLANNED_SHELF_PRODUCTS) {
  assert.ok(shelf.SHELF_CATEGORIES.some((category) => category.id === planned.category), `${planned.key} uses a real category`);
  assert.ok(planned.rightsRequirement.length > 20, `${planned.key} states what rights are needed`);
  assert.ok(planned.proposedPriceUsd >= 1, `${planned.key} meets the US$1 listing minimum`);
}
assert.equal(shelf.plannedProductsToShow([{ category: 'drum_kit' }]).some((item) => item.category === 'drum_kit'), false, 'a live product replaces its planned placeholder');
for (const row of shelf.SHELF_FIXTURE_ROWS) assert.ok(row.title.startsWith('[Fixture]'), 'fixtures are labelled');

// API contract.
const api = read('src/app/api/marketplace/products/route.ts');
assert.ok(api.includes('status=eq.published&listing_type=eq.digital_product'), 'only published digital products are listed');
assert.ok(!shelf.SHELF_LIST_COLUMNS.includes('asset_path') && !shelf.SHELF_DETAIL_COLUMNS.includes('asset_path'), 'asset_path is never selected');
assert.ok(!shelf.SHELF_LIST_COLUMNS.includes('licence_terms') && shelf.SHELF_DETAIL_COLUMNS.includes('licence_terms'), 'full terms load on the product page only');
assert.ok(api.includes('process.env.NODE_ENV !== "production"') && api.includes('BVS_SHELF_FIXTURES'), 'fixtures cannot load in production');
assert.ok(api.includes('isShelfSlug(slug)'), 'slug is validated');

// Storefront pages: buying goes through the existing creator_product checkout line.
const shelfPage = read('src/app/marketplace/products/page.tsx');
const detailPage = read('src/app/marketplace/products/[slug]/page.tsx');
assert.ok(read('src/lib/product-shelf.ts').includes('type: "creator_product"'), 'cart line uses the existing creator_product type');
assert.ok(read('src/lib/commerce-ledger.ts').includes('item.type === "creator_product"'), 'checkout still resolves creator products server-side');
for (const [name, source] of [['shelf', shelfPage], ['detail', detailPage]]) {
  assert.ok(source.includes('addShelfProductToCart'), `${name} adds to the shared cart`);
  assert.ok(source.includes('product_add_to_cart'), `${name} measures add to cart`);
  assert.ok(source.includes('product.fixture'), `${name} never sells a fixture`);
  assert.ok(source.includes('/catalogue?type=beat#beatstore') && source.includes('/marketplace'), `${name} cross-links beats and services`);
}
assert.ok(shelfPage.includes('product_shelf_view') && shelfPage.includes('Coming soon') && shelfPage.includes('/creator/marketplace'), 'shelf measures impressions, labels planned items and recruits sellers');
assert.ok(detailPage.includes('product_view') && detailPage.includes('licenceTerms') && detailPage.includes('storefrontSlug'), 'product page measures views and shows licence terms and the creator');

// Measurement and delivery.
const analytics = read('src/lib/analytics.ts');
for (const event of ['product_shelf_view', 'product_view', 'product_preview_play', 'product_add_to_cart', 'product_submitted', 'product_download']) {
  assert.ok(analytics.includes(`"${event}"`), `${event} is an allowed analytics event`);
  assert.match(event, /^[a-z][a-z0-9_]{1,63}$/, `${event} fits the database event-name rule`);
}
const download = read('src/app/api/download/route.ts');
assert.ok(download.includes('recordServerEvent("product_download"'), 'downloads are measured');
assert.ok(download.indexOf('order.status !== "paid"') < download.indexOf('recordServerEvent("product_download"'), 'a download is only counted after the paid-order check');
assert.ok(!/customer|email|name:/.test(download.slice(download.indexOf('recordServerEvent("product_download"'), download.indexOf('if (asset.kind === "r2")'))), 'no customer details in the download event');

// Seller flow: preview upload is offered and constrained.
const desk = read('src/components/CreatorMarketplaceDesk.tsx');
assert.ok(desk.includes('uploadBox("preview", "Audio preview")') && desk.includes('uploadFiles(["asset", "artwork", "preview"])'), 'sellers can upload an audio preview');
assert.ok(desk.includes('trackEvent("product_submitted"'), 'product submissions are measured');
const prepare = read('src/app/api/marketplace/upload/prepare/route.ts');
assert.ok(prepare.includes('kind === "preview"') && prepare.includes('20 * 1024 * 1024'), 'public previews are limited to short audio files');

// In-app links to the shelf stay inside the app Marketplace.
const routing = await import(await moduleFor('app-link-routing'));
assert.equal(routing.appRouteForNativeUrl('https://bvsradio.com/marketplace/products/kit-abc123', 'ios'), '/app/ios/marketplace');
assert.equal(routing.appRouteForNativeUrl('https://bvsradio.com/marketplace/wolfbridges-studio', 'ios'), '/app/ios/marketplace?provider=wolfbridges-studio');

console.log('Product shelf: shaping, privacy, planned catalogue, storefront wiring, analytics and delivery assertions passed.');
