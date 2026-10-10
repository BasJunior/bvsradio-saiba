import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

const source = fs.readFileSync('src/components/app-vnext/AppShareButton.tsx', 'utf8');
const draws = [], text = [], requests = [], revocations = [], radii = [], fills = [];
let canvas;
const context = {
  font:'', textAlign:'left', fillStyle:'', strokeStyle:'', lineWidth:1, lineCap:'butt', filter:'none',
  measureText(value) { return { width: value.length * Number(this.font.match(/(\d+)px/)?.[1] || 20) * .52 }; },
  fillText(value,x,y) { text.push({value,x,y,width:this.measureText(value).width,align:this.textAlign,font:this.font}); },
  drawImage(...args) { draws.push(args); },
  fillRect(){},save(){},restore(){},beginPath(){},roundRect(x,y,w,h,r){radii.push({x,y,w,h,r});},clip(){},strokeRect(){},moveTo(){},lineTo(){},stroke(){},fill(){fills.push(true);},
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
  text.length=0; draws.length=0; radii.length=0; fills.length=0;
  const file=await render({title:'A very long song title '.repeat(15),text:'Wolf Bridges · Hip-Hop',kicker:'BVS BeatStore',image:'/cover.jpg',format});
  assert.equal(canvas.width,1080);
  assert.equal(canvas.height,format==='story'?1920:1080);
  assert.equal(file.type,'image/png');
  assert.match(file.name,new RegExp(`-${format}\\.png$`));
  assert.equal(draws.length,3,'Backdrop artwork, foreground artwork and uploaded BVS logo must all render');
  const coverRadius = format === 'story' ? 46 : 34;
  assert.ok(radii.some(entry=>entry.r===coverRadius),'Artwork must use the new rounded BVS card treatment');
  assert.ok(fills.length>=2,'Metadata and CTA must render as glass surfaces');
  const nowOnBvs = text.find(t=>t.value==='NOW ON BVS');
  assert.ok(nowOnBvs && nowOnBvs.align==='center','Share card must carry the centered NOW ON BVS headline');
  assert.match(nowOnBvs.font,/900/,'NOW ON BVS should use the heaviest headline weight');
  assert.ok(text.some(t=>t.value==='DISCOVERED ON BVS'),'Metadata panel must carry the BVS discovery label');
  assert.ok(text.some(t=>t.value==='FIND YOUR NEXT RECORD'),'Beat card CTA must remain contextual');
  assert.ok(text.some(t=>t.value.endsWith('…')),'Long titles must truncate');
  const titleLine = text.find(t=>t.value.startsWith('A very long song'));
  assert.ok(titleLine,'Title must render');
  assert.ok(titleLine.align==='left','New share card title must use editorial left alignment');
  assert.ok(titleLine.y > (format==='story'?1070:734),'Title must sit below the artwork and waveform');
  for(const draw of text) {
    assert.ok(draw.y<canvas.height-18,'Text must stay within export bounds');
    if (draw.align === 'center') assert.ok(draw.x-(draw.width/2)>=35 && draw.x+(draw.width/2)<=1045,'Centered text must stay inside the safe card width');
    else if (draw.align === 'right') assert.ok(draw.x-draw.width>=20,'Right-aligned text must stay inside the safe card width');
    else assert.ok(draw.x+draw.width<=1060,'Left-aligned text must stay inside the safe card width');
  }
  if (format === 'story') {
    assert.ok(text.some(t=>t.value==='BEST VIRTUAL SOUND'),'Story footer must retain the BVS identity');
    assert.ok(text.some(t=>t.value==='bvsradio.com · Built in Zimbabwe · Open to the world'),'Story footer must carry the BVS URL and origin line');
  }
}
text.length=0;
await render({title:'x'.repeat(180),kicker:'BVS Show',format:'square'});
assert.ok(text.filter(t=>t.value.startsWith('x')).every(t=>t.width<=780),'Unbroken square titles must wrap within the glass metadata panel');
assert.ok(text.some(t=>t.value==='TUNE IN ON BVS'));
assert.ok(requests.includes('https://preview.example/branding/bvs-share-logo.png'),'Uploaded logo must load on current deployment');
assert.ok(revocations.length>=5,'Loaded image URLs must be cleaned up');
scope.fetch=async()=>({ok:false});
text.length=0;
assert.ok(await render({title:'No artwork',kicker:'BVS Community'}),'Missing artwork must still export a valid card');
assert.ok(text.some(t=>t.value==='JOIN THE CONVERSATION'));
console.log('BVS Share Card V2 story/square layouts, branded glass surfaces, rounded artwork, logo CTA, contextual actions, fallbacks and cleanup passed.');
