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
  cache.set(name, url); return url;
}
const {liveStorefronts, marketplaceStorefronts} = await import(await moduleFor('marketplace-storefronts'));
const profile = {user_id:'seller',roles:['producer'],profiles:{display_name:'Test Studio',avatar_url:'/account-avatar.jpg'},portfolio:[{kind:'storefront_banner',path:'marketplace/seller/banner.jpg'},{kind:'storefront_avatar',path:'marketplace/seller/avatar.jpg'}]};
const listing = {id:'one',seller_user_id:'seller',listing_type:'digital_product',category:'sample_pack',title:'Sounds',price_usd:12,artwork_path:'marketplace/seller/art.jpg'};
const store=liveStorefronts([profile],[listing])[0];
assert.equal(store.heroImage,'/api/media/marketplace/seller/banner.jpg');
assert.equal(store.avatarImage,'/api/media/marketplace/seller/avatar.jpg');
assert.equal(store.services[0].artworkImage,'/api/media/marketplace/seller/art.jpg');
assert.equal(liveStorefronts([{...profile,portfolio:[]}],[])[0].heroImage,'/account-avatar.jpg');
const claimed=marketplaceStorefronts([{...profile,profiles:{display_name:'WolfBridges Studio'}}],[listing]).find(s=>s.slug==='wolfbridges-studio');
assert.equal(claimed.heroImage,store.heroImage,'an explicit saved banner is visible on a claimed provider store');
assert.ok(claimed.services.some(s=>s.listingId==='one'),'existing offers remain available');
console.log('Marketplace storefront media: banner/avatar/listing artwork, legacy fallback and claimed storefront passed.');
