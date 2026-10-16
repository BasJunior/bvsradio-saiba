import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import vm from 'node:vm'
import ts from 'typescript'
const { rankMovement } = await import('../src/lib/trending.ts')
const jsx=(type,props)=>({type,props})
const all=tree=>!tree||typeof tree!=='object'?[]:[tree,...[tree.props?.children].flat(Infinity).flatMap(all)]
const text=tree=>typeof tree==='string'||typeof tree==='number'?String(tree):tree&&typeof tree==='object'?[tree.props?.children].flat(Infinity).map(text).join(''):''
const tick=()=>new Promise(resolve=>setImmediate(resolve))
const calls=[], requests=[], slots=[], effects=[]
let index=0
const player={current:null,isPlaying:false,playNow:(...args)=>calls.push(args),toggle:()=>calls.push('toggle')}
const entries=[{id:'00000000-0000-4000-8000-000000000001',title:'New wave',artist:'Artist',src:'/api/media/song.mp3',rank:1,previousRank:4,reason:'New listeners are building momentum.'},{id:'00000000-0000-4000-8000-000000000002',title:'Second',artist:'Other',src:'/api/media/second.mp3',rank:2,previousRank:null,reason:'Listeners are saving this discovery.'}]
const board={window:'now',generatedAt:new Date().toISOString(),hasPrevious:true,entries}
let fail=false,empty=false
const memo=(fn,deps)=>{const i=index++,old=slots[i];if(!old||deps.some((d,n)=>d!==old.deps[n]))slots[i]={deps,value:fn()};return slots[i].value}
const imports={
 'react':{useState(initial){const i=index++;if(!(i in slots))slots[i]=initial;return[slots[i],v=>{slots[i]=typeof v==='function'?v(slots[i]):v}]},useEffect(fn,deps){memo(()=>effects.push(fn),deps)}},
 'react/jsx-runtime':{jsx,jsxs:jsx},'next/link':{default:'Link'},'next/image':{default:'Image'},
 '@/components/LibraryAction':{default:'LibraryAction'},'@/components/SongShareButton':{default:'SongShareButton'},
 '@/components/StationPlayer':{useStationPlayer:()=>player},'@/lib/trending':{rankMovement},
}
const exports={}
vm.runInNewContext(ts.transpileModule(readFileSync('src/components/TrendingBoard.tsx','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText,{
 exports,require:n=>{if(n in imports)return imports[n];throw Error(n)},AbortController,Date,
 fetch:async(url)=>{requests.push(url);return{ok:!fail,json:async()=>({...board,entries:empty?[]:entries})}},
})
const render=(props={})=>{index=0;const tree=exports.default(props);effects.splice(0).forEach(f=>f());return tree}
let tree=render();assert.match(text(tree),/Loading the chart/)
await tick();tree=render()
assert.equal(all(tree).filter(n=>n.type==='li').length,2)
assert.match(text(tree),/↑3/);assert.match(text(tree),/NEW/)
assert.ok(all(tree).some(n=>n.type==='Link'&&n.props.href===`/song/${entries[0].id}`),'direct song link')
all(tree).find(n=>n.type==='button'&&n.props['aria-label']==='Play New wave').props.onClick()
assert.equal(calls[0][0].id,entries[0].id)
assert.equal(calls[0][1].related.length,2,'next/previous uses the persistent player chart queue')
assert.equal(all(tree).filter(n=>n.type==='LibraryAction').length,2)
assert.equal(all(tree).filter(n=>n.type==='SongShareButton').length,2)
player.current=entries[0];player.isPlaying=true
all(render()).find(n=>n.type==='button'&&n.props['aria-label']==='Pause New wave').props.onClick()
assert.equal(calls.at(-1),'toggle')
all(tree).find(n=>n.type==='button'&&text(n)==='This Week').props.onClick()
tree=render();assert.match(text(tree),/Loading the chart/,'period switch clears the previous chart before fetching')
await tick();tree=render({surface:'ios',preview:true})
assert.equal(requests.at(-1),'/api/trending?window=week')
assert.ok(all(tree).some(n=>n.type==='Link'&&n.props.href==='/app/ios/trending'))
assert.ok(all(tree).some(n=>n.type==='Link'&&n.props.href===`/app/ios/song/${entries[0].id}`))
fail=true
all(tree).find(n=>n.type==='button'&&text(n)==='Trending Now').props.onClick();render();await tick();tree=render()
assert.match(text(tree),/Trending couldn’t load/)
fail=false;empty=true
all(tree).find(n=>n.type==='button'&&text(n)==='Try again').props.onClick();render();await tick();tree=render()
assert.match(text(tree),/next wave is still building/)
assert.equal(all(tree).filter(n=>n.type==='li').length,0,'no invented chart entries in empty state')
console.log('Trending UI: chart, queue, play/pause, save/share, exact links, period switch, error/retry and empty state passed.')
