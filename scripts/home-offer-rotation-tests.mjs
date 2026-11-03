import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
const slots=[], effects=[], intervals=new Map();let position=0, sequence=0, intersection, motion;
const exports={};
const preference={matches:false,addEventListener:(_name,fn)=>{motion=fn;},removeEventListener(){}};
vm.runInNewContext(ts.transpileModule(fs.readFileSync('src/components/home/useOfferRotation.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{
  exports,
  require:()=>({
    useState(initial){const i=position++;if(!(i in slots))slots[i]=initial;return[slots[i],v=>slots[i]=typeof v==='function'?v(slots[i]):v];},
    useRef(){const i=position++;return slots[i]??={current:{}};},
    useEffect(fn,deps){const i=position++,previous=slots[i];if(!previous||deps.some((v,n)=>v!==previous.deps[n]))effects.push(()=>{previous?.cleanup?.();slots[i]={deps,cleanup:fn()};});},
  }),
  window:{matchMedia:()=>preference,setInterval:fn=>{intervals.set(++sequence,fn);return sequence;},clearInterval:id=>intervals.delete(id)},
  document:{hidden:false,addEventListener(){},removeEventListener(){}},
  IntersectionObserver:class{constructor(fn){intersection=fn;}observe(){}disconnect(){}},
});
const render=()=>{position=0;const hook=exports.useOfferRotation(3);effects.splice(0).forEach(fn=>fn());return hook;};
let hook=render();assert.equal(intervals.size,0,'Offscreen offers do not rotate');intersection([{isIntersecting:true}]);hook=render();assert.equal(intervals.size,1);[...intervals.values()][0]();hook=render();assert.equal(hook.index,1);
hook.sectionProps.onMouseEnter();hook=render();assert.equal(intervals.size,0,'Hover pauses prices and CTAs');hook.sectionProps.onMouseLeave();hook=render();assert.equal(intervals.size,1);
hook.sectionProps.onFocusCapture();hook=render();assert.equal(intervals.size,0,'Keyboard focus pauses');hook.sectionProps.onBlurCapture({currentTarget:{contains:()=>false},relatedTarget:null});hook=render();assert.equal(intervals.size,1);
hook.select(2);hook=render();assert.equal(hook.index,2);assert.equal(intervals.size,0,'Manual choice stays put');hook.toggle();hook=render();assert.equal(intervals.size,1);
preference.matches=true;motion();render();assert.equal(intervals.size,0,'Reduced motion disables automatic changes');
preference.matches=false;motion();render();assert.equal(intervals.size,1);
intersection([{isIntersecting:false}]);render();assert.equal(intervals.size,0);
slots.forEach(slot=>slot?.cleanup?.());assert.equal(intervals.size,0);
console.log('Offer rotation passed: visibility, hover/focus pause, manual selection, resume and cleanup.');
