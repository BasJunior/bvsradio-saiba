import assert from 'node:assert/strict'
import fs from 'node:fs'
import vm from 'node:vm'
import ts from 'typescript'
let state, effects=[], events=new Map(), scrolls=0
const exports={}
const jsx=(type,props)=>({type,props})
const win={location:{hash:''},history:{state:{preserve:true},replaceState(current,unused,hash){assert.equal(current.preserve,true);win.location.hash=hash}},addEventListener:(name,fn)=>events.set(name,fn),removeEventListener:name=>events.delete(name)}
vm.runInNewContext(ts.transpileModule(fs.readFileSync('src/components/editorial/EditorialWorkspace.tsx','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX,target:ts.ScriptTarget.ES2022}}).outputText,{exports,window:win,require(name){
 if(name==='react')return {createContext:()=>({Provider:'provider'}),useContext:()=>null,useState:initial=>{state??=initial;return[state,next=>state=typeof next==='function'?next(state):next]},useRef:()=>({current:{scrollIntoView(){scrolls++}}}),useEffect:fn=>effects.push(fn)}
 if(name==='react/jsx-runtime')return{jsx,jsxs:jsx}
 throw Error(name)
}})
const sections=[{id:'ed-beats',label:'BeatStore (3)'},{id:'ed-analytics',label:'Analytics'},{id:'ed-artists',label:'Artists'}]
const render=()=>exports.default({sections,initialSection:'ed-beats',children:'queues'})
function nodes(tree){return tree&&typeof tree==='object'?[tree,...[tree.props?.children].flat(Infinity).flatMap(nodes)]:[]}
let tree=render();effects.splice(0).forEach(fn=>fn())
assert.equal(tree.props.value.active,'ed-beats','Review queue is the first workspace')
nodes(tree).find(node=>node.type==='select').props.onChange({target:{value:'ed-analytics'}})
tree=render()
assert.equal(tree.props.value.active,'ed-analytics')
assert.deepEqual(Array.from(tree.props.value.visited),['ed-beats','ed-analytics'],'Visited review forms remain mounted when switching')
assert.equal(win.location.hash,'#ed-analytics');assert.equal(scrolls,1)
win.location.hash='#ed-programmes';events.get('hashchange')();tree=render()
assert.equal(tree.props.value.active,'ed-artists','Existing programme links open their workspace')
win.location.hash='#unknown';events.get('hashchange')();tree=render()
assert.equal(tree.props.value.active,'ed-artists','Invalid fragments cannot select an unavailable queue')
const page=fs.readFileSync('src/app/admin/editorial/page.tsx','utf8')
assert.ok(page.includes('hidden={!active}')&&page.includes('if (!active && !visited) return null'),'Inactive workspaces stay hidden and unvisited tools load on demand')
console.log('Editorial workspace: queue-first entry, navigation, retained forms and existing hash links passed.')
