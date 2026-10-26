import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import vm from 'node:vm'
import ts from 'typescript'
import React from 'react'
import * as jsx from 'react/jsx-runtime'
import TestRenderer,{act} from 'react-test-renderer'
globalThis.IS_REACT_ACT_ENVIRONMENT=true
function load(path,imports={},globals={}){
 const exports={};const code=ts.transpileModule(readFileSync(path,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText
 vm.runInNewContext(code,{exports,require:n=>{if(n==='react')return React;if(n==='react/jsx-runtime')return jsx;if(n in imports)return imports[n];throw new Error(`Unexpected ${n}`)},console,AbortSignal,...globals},{filename:path});return exports
}
const run=(code,ctx)=>vm.runInNewContext(ts.transpileModule(code,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText,ctx)
let player={sharedProgramme:false,isPlaying:false,joinSharedProgramme:async()=>{player.sharedProgramme=true;player.isPlaying=true;return true}}
let path='/'
const Button=load('src/components/SharedListenButton.tsx',{'next/link':{default:p=>React.createElement('a',p)},'next/navigation':{usePathname:()=>path},'@/components/StationPlayer':{useStationPlayer:()=>player}}).default
let tree;await act(async()=>{tree=TestRenderer.create(React.createElement(Button))})
await act(async()=>tree.root.findByType('button').props.onClick())
await act(async()=>tree.update(React.createElement(Button)))
assert.equal(tree.root.findByType('a').props.href,'/radio')
player={...player,sharedProgramme:false};await act(async()=>tree.update(React.createElement(Button)))
assert.equal(tree.root.findByType('button').props.children,'Listen live','local skip must restore every join button')
player={...player,sharedProgramme:true,isPlaying:false};await act(async()=>tree.update(React.createElement(Button)))
assert.equal(tree.root.findAllByType('a').length,0,'paused playback must offer an actual resume/join action')
player={...player,isPlaying:true};path='/app/ios';await act(async()=>tree.update(React.createElement(Button)))
assert.equal(tree.root.findByType('a').props.href,'/app/ios/radio')
await act(async()=>tree.unmount())
const source=readFileSync('src/components/StationPlayer.tsx','utf8')
const extract=(start,end)=>{const s=source.slice(source.indexOf(start),source.indexOf(end,source.indexOf(start)));return s.slice(s.indexOf('async () => {')+'async () => {'.length,s.lastIndexOf('}, ['))}
const playBody=extract('  const play = useCallback','  const pause =')
let joins=0,audioPlays=0
const playCtx={sharedItemRef:{current:'song'},leftSharedRef:{current:false},modeRef:{current:'station'},joinSharedProgramme:async()=>{joins++},audio:{current:{play(){audioPlays++}}}}
await run(`(async()=>{${playBody}})()`,playCtx)
assert.equal(joins,1);assert.equal(audioPlays,0,'shared resume must fetch/join the current clock instead of replaying the paused position')
const joinBody=extract('  const joinSharedProgramme = useCallback','  const play =')
let switched=0,flushed=0,decisionSeen
const joinCtx={sharedJoinRequest:{current:0},sharedItemRef:{current:null},sharedSeekRef:{current:null},sharedRecoveryTimer:{current:null},sharedRecoveryStreak:{current:2},forceSharedRefresh:{current:true},reloadSharedAudio:{current:true},leftSharedRef:{current:true},setError(){},setNotice(){},setMode(){switched++},setProgrammeEpoch(){},setSharedProgramme(){},setProgrammeNote(){},setPlayingFrom(){},setNowPlaying(){},setPlaying(){},flushListening(){flushed++},makeQueueItem:x=>x,fetch:async()=>({ok:true,json:async()=>({})}),followSharedProgramme:args=>{decisionSeen=args;return {action:'follow',itemId:'current',seekSeconds:87,note:'Shared',title:'Current',artist:'Artist',src:'/current.mp3'}},AbortSignal}
assert.equal(await run(`(async()=>{${joinBody}})()`,joinCtx),true)
assert.equal(joinCtx.sharedSeekRef.current,87);assert.equal(joinCtx.leftSharedRef.current,false);assert.equal(switched,1);assert.equal(flushed,1)
assert.equal(decisionSeen.previousItemId,null);assert.equal(decisionSeen.leftStation,false)
assert.equal(joinCtx.sharedRecoveryStreak.current,0);assert.equal(joinCtx.forceSharedRefresh.current,false);assert.equal(joinCtx.reloadSharedAudio.current,false)
let resolveFetch
const pending={...joinCtx,sharedJoinRequest:{current:0},fetch:()=>new Promise(resolve=>resolveFetch=resolve),setNowPlaying(){throw new Error('stale join must not replace selection')}}
const late=run(`(async()=>{${joinBody}})()`,pending)
pending.sharedJoinRequest.current++
resolveFetch({ok:true,json:async()=>({})})
assert.equal(await late,false,'a late station response must not override a later user action')
// Guide membership follows the player; missing editorial content is omitted.
let guideTick, guideOnline=true
const snapshot={onAir:true,item:{id:'s',kind:'music',title:'Station song',artist:'Station artist',story:null},upNext:[]}
player={...player,sharedProgramme:false,isPlaying:true,current:{title:'My choice',artist:'Me'}}
const Guide=load('src/components/radio/SharedProgrammeGuide.tsx',{'@/components/StationPlayer':{useStationPlayer:()=>player}},{fetch:async()=>{if(!guideOnline)throw new Error('offline');return {ok:true,json:async()=>snapshot}},window:{setInterval:fn=>{guideTick=fn;return 1},clearInterval(){}},AbortController}).default
await act(async()=>{tree=TestRenderer.create(React.createElement(Guide));for(let i=0;i<8;i++)await Promise.resolve()})
let text=JSON.stringify(tree.toJSON());assert.match(text,/own selection/);assert.match(text,/My choice/);assert.match(text,/Station song/);assert.doesNotMatch(text,/No studio note|None is on the clock/)
assert.equal(tree.root.findByType('button').props.children,'Rejoin live')
player={...player,sharedProgramme:true,isPlaying:false};await act(async()=>tree.update(React.createElement(Guide)))
assert.equal(tree.root.findByType('button').props.children,'Resume live')
guideOnline=false;await act(async()=>{await guideTick()})
assert.match(JSON.stringify(tree.toJSON()),/station update is unavailable/)
assert.doesNotMatch(JSON.stringify(tree.toJSON()),/currently off air/)
await act(async()=>tree.unmount())
console.log('Shared listen gaps: button reset, app destination, fresh-clock resume, join cancellation and truthful programme guide passed.')

const bootstrap=load('src/components/app-vnext/AppBootstrap.tsx',{'next/navigation':{useRouter:()=>({})},'@/lib/auth-client-flow':{safeAuthDestination:x=>x},'@/lib/app-external-boundary':{externalBvsUrl:x=>x,isExternalLegalOrLicenceUrl:()=>false}},{URL,URLSearchParams})
for(const surface of ['ios','android']) assert.equal(bootstrap.appDestination(surface,new URL('https://bvsradio.com/radio')),`/app/${surface}/radio`)
