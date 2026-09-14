import { mkdir } from 'node:fs/promises';
const {chromium}=await import(process.env.BVS_PLAYWRIGHT_MODULE || 'playwright');
const artifactDir=process.env.BVS_REVIEW_ARTIFACTS || '/tmp/bvs-marketplace-review';
await mkdir(artifactDir,{recursive:true});
import assert from 'node:assert/strict';
const base=process.env.BVS_REVIEW_URL || 'http://127.0.0.1:3124';
if(!['127.0.0.1','localhost'].includes(new URL(base).hostname))throw new Error('This fixture test runs only against localhost.');
const uid='11111111-1111-4111-8111-111111111111';
const jwt=Buffer.from(JSON.stringify({alg:'HS256',typ:'JWT'})).toString('base64url')+'.'+Buffer.from(JSON.stringify({sub:uid,exp:Math.floor(Date.now()/1000)+3600,role:'authenticated'})).toString('base64url')+'.test';
const user={id:uid,email:'seller@example.test',aud:'authenticated',role:'authenticated',app_metadata:{},user_metadata:{},created_at:new Date().toISOString()};
const session={access_token:jwt,refresh_token:'local-fixture',token_type:'bearer',expires_in:3600,expires_at:Math.floor(Date.now()/1000)+3600,user};
const browser=await chromium.launch({headless:true,...(process.env.BVS_BROWSER_EXECUTABLE?{executablePath:process.env.BVS_BROWSER_EXECUTABLE}:{}),args:['--no-sandbox']});
const context=await browser.newContext({viewport:{width:1440,height:1000}});
await context.addCookies([{name:'sb-127-auth-token',value:'base64-'+Buffer.from(JSON.stringify(session)).toString('base64url'),url:base,httpOnly:false,sameSite:'Lax'}]);
const state={profile:{status:'approved',roles:['producer'],headline:'Soulful sounds from Berlin',bio:'Music crafted with care.',skills:['Production'],portfolio:[],credits:[],accomplishments:[]},seller:{username:'seller-name',display_name:'Demo Studio'},listings:[{id:'22222222-2222-4222-8222-222222222222',title:'Midnight Drums',status:'published',listing_type:'digital_product',category:'drum_kit',description:'24 carefully recorded drums.',price_usd:19,asset_path:`marketplace/${uid}/asset.zip`,licence_summary:'Commercial use',packages:[]}],entitlements:{planId:'creator',productListingLimit:10,serviceListingLimit:5,servicePackageLimit:3}};
const writes=[];let failSave=false,uploads=0;
await context.route('http://127.0.0.1:54399/**',route=>route.fulfill({json:route.request().url().includes('/auth/v1/user')?user:[]}));
await context.route(base+'/api/**',async route=>{
 const url=new URL(route.request().url()),method=route.request().method();
 if(url.pathname==='/api/marketplace/upload/prepare') { const body=route.request().postDataJSON();return route.fulfill({json:{slots:body.files.map(f=>({kind:f.kind,path:`marketplace/${uid}/123-${f.kind}-abcdef.jpg`,signedUrl:base+'/local-upload',contentType:f.type}))}});}
 if(url.pathname==='/api/marketplace') {
  if(method==='GET')return route.fulfill({json:url.searchParams.get('scope')==='mine'?state:{profiles:[{user_id:uid,...state.profile,profiles:state.seller}],listings:state.listings.map(l=>({...l,seller_user_id:uid}))}});
  const body=route.request().postDataJSON();writes.push(body);if(failSave){failSave=false;return route.fulfill({status:503,json:{error:'Temporary save failure. Please retry.'}});}
  if(body.action==='save_listing'){const l={...state.listings.find(l=>l.id===body.id),id:body.id||'33333333-3333-4333-8333-333333333333',title:body.title,listing_type:body.listingType,price_usd:Number(body.priceUsd),status:body.submit?'submitted':'draft',category:body.category,description:body.description};state.listings=state.listings.filter(x=>x.id!==l.id).concat(l);return route.fulfill({json:{listing:l}});}
  if(body.action==='save_profile'){state.profile={...state.profile,...body,status:body.submit?'submitted':'draft'};return route.fulfill({json:{profile:state.profile}});}
  if(body.action==='pause_listing'){state.listings=state.listings.map(l=>l.id===body.id?{...l,status:'archived'}:l);return route.fulfill({json:{listing:state.listings.find(l=>l.id===body.id)}});}
 }
 if(url.pathname==='/api/marketplace/availability')return route.fulfill({json:{providerKey:'demo-studio',slots:[],bookings:[]}});
 return route.fulfill({json:{items:[],tracks:[],notifications:[],unreadCount:0}});
});
await context.route(base+'/local-upload',r=>{uploads++;return r.fulfill({status:200,body:''});});
const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>d.accept());
try{
 await page.goto(base+'/creator/marketplace');await page.getByRole('heading',{name:'Make room for your next sale.'}).waitFor({timeout:30000});
 assert.equal(await page.getByRole('link',{name:'View storefront'}).getAttribute('href'),'/marketplace/demo-studio');
 await page.screenshot({path:artifactDir+'/BVS_Marketplace_Workspace_Desktop.png',fullPage:true});
 await page.getByRole('tab',{name:'Your listings'}).click();await page.getByRole('button',{name:'Edit',exact:true}).first().click();
 assert.equal(await page.getByLabel('Title',{exact:true}).inputValue(),'Midnight Drums');
 await page.getByLabel('Title',{exact:true}).fill('Midnight Drums Deluxe');
 const refreshed={...session,access_token:jwt.replace('.test','.refreshed')};
 await page.evaluate(s=>{const c=new BroadcastChannel('sb-127-auth-token');c.postMessage({event:'TOKEN_REFRESHED',session:s});c.close();},refreshed);
 await page.waitForTimeout(200);
 assert.equal(await page.getByLabel('Title',{exact:true}).inputValue(),'Midnight Drums Deluxe','token refresh retains unsaved editing');
 failSave=true;await page.getByRole('button',{name:'Save draft',exact:true}).click();await page.getByRole('alert').filter({hasText:'Temporary save failure'}).waitFor();assert.equal(await page.getByLabel('Title',{exact:true}).inputValue(),'Midnight Drums Deluxe');
 await page.getByRole('button',{name:'Save draft',exact:true}).click();await page.getByRole('status').filter({hasText:'Draft saved'}).waitFor();assert.equal(writes.at(-1).id,'22222222-2222-4222-8222-222222222222');assert.equal(uploads,0);assert.equal(writes.at(-1).rightsConfirmed,false);
 await page.getByRole('tab',{name:'Storefront',exact:true}).click();assert.equal(await page.getByLabel('Headline',{exact:true}).inputValue(),'Soulful sounds from Berlin');
 await page.getByLabel('Storefront banner', {exact:false}).setInputFiles({name:'banner.png',mimeType:'image/png',buffer:Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/l9sAAAAASUVORK5CYII=','base64')});
 await page.getByAltText('Storefront banner preview').first().waitFor();await page.getByRole('button',{name:'Save changes',exact:true}).click();await page.getByRole('status').filter({hasText:'Storefront saved'}).waitFor();assert.equal(uploads,1);assert.match(writes.at(-1).bannerPath, /storefront_banner/);
 await page.setViewportSize({width:390,height:844});await page.screenshot({path:artifactDir+'/BVS_Marketplace_Storefront_Mobile.png',fullPage:true});
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth),true,'mobile must not overflow horizontally');
 await page.getByRole('tab',{name:'Availability'}).click();await page.getByText('You have no upcoming open slots.').waitFor();
 await page.evaluate(()=>{document.documentElement.dataset.theme='dark';localStorage.setItem('bvs_theme','dark');});
 await page.getByRole('tab',{name:'Overview',exact:true}).click();await page.screenshot({path:artifactDir+'/BVS_Marketplace_Workspace_Dark.png',fullPage:true});
 await page.evaluate(()=>{const c=new BroadcastChannel('sb-127-auth-token');c.postMessage({event:'SIGNED_OUT',session:null});c.close();});
 await page.getByRole('heading',{name:'Your creative business, in one place.'}).waitFor();
 assert.equal(await page.getByText('Midnight Drums Deluxe',{exact:true}).count(),0,'account data clears on signout');
 await page.setViewportSize({width:1440,height:1000});
 await page.goto(base+'/marketplace');await page.getByRole('searchbox').fill('zz-no-provider');await page.getByRole('heading',{name:'No stores match yet'}).waitFor();
 await page.getByRole('button',{name:'Clear filters',exact:true}).click();await page.getByRole('link',{name:'Open Wolf Studio'}).waitFor();
 await page.goto(base+'/marketplace/demo-studio');await page.getByRole('heading',{name:'Demo Studio',exact:true}).waitFor();
 await page.getByRole('button',{name:'Services',exact:true}).click();await page.getByRole('heading',{name:'No services available yet'}).waitFor();
 await page.getByRole('button',{name:'Downloads',exact:true}).click();await page.getByRole('heading',{name:'Midnight Drums Deluxe',exact:true}).waitFor();
 assert.deepEqual(errors,[]);
 console.log('PASS desktop/mobile seller browser: correct storefront link, listing hydration, failed-save recovery, draft ID preserved/no re-upload, storefront upload+save, mobile overflow, availability empty state; no page errors.');
}catch(e){await page.screenshot({path:artifactDir+'/BVS_Marketplace_Test_Debug.png',fullPage:true});console.error(e);console.log((await page.locator('body').innerText()).slice(0,3500));process.exitCode=1;}finally{await browser.close();}
