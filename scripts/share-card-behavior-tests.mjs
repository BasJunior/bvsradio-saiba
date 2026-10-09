import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

const source = fs.readFileSync('src/components/app-vnext/AppShareButton.tsx', 'utf8');
const draws = [], text = [], requests = [], revocations = [], frames = [], radii = [];
let canvas;
const context = {
  font:'', textAlign:'left', fillStyle:'',
  measureText(value) { return { width: value.length * Number(this.font.match(/(\d+)px/)?.[1] || 20) * .52 }; },
  fillText(value,x,y) { text.push({value,x,y,width:this.measureText(value).width,align:this.textAlign,font:this.font}); },
  drawImage(...args) { draws.push(args); },
  fillRect(){},save(){},restore(){},beginPath(){},roundRect(x,y,w,h,r){radii.push(r);},clip(){},strokeRect(...args){frames.push(args);},moveTo(){},lineTo(){},stroke(){},
  createLinearGradient(){return {addColorStop(){}};},
};
class ImageMock {
  naturalWidth=1600; naturalHeight=1600;
  set src(value) { this.value=value; queueMicrotask(()=>this.onload()); }
}
const scope = {
  exports:{}, require(name){return name==='react/jsx-runtime'?{jsx(){},jsxs(){}}:{};},
  document:{fonts:{ready:Promise.resolve()},createElement(){canvas={width:0,height:0,getContext:()=>context,toBlob:callback=>callback(new Blob(['card'],{type:'image/png'}))};return canvas;}},
  window:{location:{href:'https://preview.example/app/ios/feed'}},
  URL:class extends URL { static createObjectURL(){return 'blob:fixture';} static revokeObjectURL(url){revocations.push(url);} },
  fetch:async url=>{requests.push(url);return {ok:true,blob:async()=>new Blob(['image'])};},
  Image:ImageMock,File,Blob,AbortSignal,queueMicrotask,
};
vm.runInNewContext(ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX,target:ts.ScriptTarget.ES2022}}).outputText,scope);
const render=scope.exports.makeStoryCard;
for (const format of ['story','square']) {
  text.length=0; draws.length=0; frames.length=0; radii.length=0;
  const file=await render({title:'A very long song title '.repeat(15),text:'Wolf Bridges · Hip-Hop',kicker:'BVS BeatStore',image:'/cover.jpg',format});
  assert.equal(canvas.width,1080);
  assert.equal(canvas.height,format==='story'?1920:1080);
  assert.equal(file.type,'image/png');
  assert.match(file.name,new RegExp(`-${format}\\.png$`));
  assert.equal(draws.length,2,'Both uploaded logo and content artwork must render');
  assert.deepEqual(radii, [0], 'Artwork must export with square corners');
  assert.equal(frames.length, 1, 'Artwork and title must share a single frame');
  const [frameX, frameY, frameWidth, frameHeight] = frames[0];
  const artwork = draws[0];
  assert.equal(artwork[5], frameX);
  assert.equal(artwork[6], frameY);
  assert.equal(artwork[7], frameWidth);
  assert.ok(frameHeight > frameWidth, 'Frame must also contain the title band');
  for (const line of text.filter(t => t.value.startsWith('A very long') || t.value.includes('Wolf Bridges'))) {
    assert.ok(line.y > frameY + frameWidth && line.y < frameY + frameHeight, 'Metadata must sit below artwork inside the frame');
    assert.ok(line.width <= frameWidth - 64, 'Metadata must fit inside the frame');
  }
  for(const draw of text) {
    assert.ok(draw.y<canvas.height-55,'Text must stay within export bounds');
    if (draw.align === 'center') assert.ok(draw.x-(draw.width/2)>=50 && draw.x+(draw.width/2)<=1030,'Centered text must stay inside the safe card width');
    else if (draw.align === 'right') assert.ok(draw.x-draw.width>=50,'Right-aligned text must stay inside the safe card width');
    else assert.ok(draw.x+draw.width<=1030,'Left-aligned text must stay inside the safe card width');
  }
  assert.ok(text.some(t=>t.value.endsWith('…')),'Long titles must truncate');
  assert.ok(text.some(t=>t.value==='FIND YOUR NEXT RECORD'),'Beat card CTA must match content');
  const nowOnBvs = text.find(t=>t.value==='NOW ON BVS');
  assert.ok(nowOnBvs && nowOnBvs.align==='center','Share card must carry the centered NOW ON BVS headline');
  assert.match(nowOnBvs.font,/900/,'NOW ON BVS should use the heaviest headline weight');
  assert.ok(text.some(t=>t.value==='BEST VIRTUAL SOUND'),'Bottom brand row must retain the BVS identity');
  assert.ok(text.some(t=>t.value==='bvsradio.com' && t.align==='right'),'Bottom brand row must carry the BVS URL at the right edge');
  if (format === 'story') {
    const titleLine = text.find(t=>t.value.startsWith('A very long song'));
    assert.ok(nowOnBvs.y <= 240,'NOW ON BVS must stay above the artwork');
    assert.ok(titleLine?.y >= 1200,'Story title should sit directly below the artwork');
  }
}
text.length=0;
await render({title:'x'.repeat(180),kicker:'BVS Show',format:'square'});
assert.ok(text.filter(t=>t.value.startsWith('x')).every(t=>t.width<=900),'Unbroken square titles must wrap within the centered title area');
assert.ok(text.some(t=>t.value==='TUNE IN ON BVS'));
assert.ok(requests.includes('https://preview.example/branding/bvs-share-logo.png'),'Uploaded logo must load on current deployment');
assert.ok(revocations.length>=5,'Loaded image URLs must be cleaned up');
scope.fetch=async()=>({ok:false});
text.length=0;
assert.ok(await render({title:'No artwork',kicker:'BVS Community'}),'Missing artwork must still export a valid card');
assert.ok(text.some(t=>t.value==='JOIN THE CONVERSATION'));
console.log('Share card formats, bold NOW ON BVS hierarchy, artwork/title layout, brand row, long-title bounds, contextual CTA, fallbacks and cleanup passed.');
