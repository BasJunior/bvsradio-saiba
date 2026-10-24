import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import vm from 'node:vm'
import ts from 'typescript'
import React from 'react'
import * as jsx from 'react/jsx-runtime'
import TestRenderer,{act} from 'react-test-renderer'
import {webcrypto,randomUUID} from 'node:crypto'
globalThis.IS_REACT_ACT_ENVIRONMENT=true
function load(path,imports={},globals={}) {
 const exports={};const code=ts.transpileModule(readFileSync(path,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText
 vm.runInNewContext(code,{exports,require:n=>{if(n==='react')return React;if(n==='react/jsx-runtime')return jsx;if(n in imports)return imports[n];throw new Error(`Unexpected import ${n}`)},console,Error,crypto:webcrypto,structuredClone,URLSearchParams,AbortSignal,AbortController,...globals},{filename:path});return exports
}
const lib=load('src/lib/beat-crate.ts')
const owner=randomUUID();const storage=new Map();let saved=null;let uploaded=new Set();let transfers=[];let failAt24=true;let submitted=0;let lostResponse=true
const apiFetch=async(path,init={})=>{
 const body=init.body?JSON.parse(init.body):{}
 if(path==='/api/beats/upload/prepare'){
  const kind=Object.keys(body)[0];return {ok:true,json:async()=>({slots:{[kind]:{path:`beats/${owner}/${body[kind].name}-${randomUUID()}`,signedUrl:'test',contentType:'audio/mpeg'}}})}
 }
 if(init.method==='PUT'){
  if(submitted && body.id===saved?.id)return {ok:false,json:async()=>({error:'Already submitted',result:{count:25}})}
  saved={id:body.id,payload:structuredClone(body.payload),state:'draft',updated_at:new Date().toISOString()};return {ok:true,json:async()=>({draft:saved})}
 }
 if(init.method==='POST'){
  submitted++;if(lostResponse){lostResponse=false;throw new Error('Response lost after commit')}
  return {ok:true,json:async()=>({result:{count:25}})}
 }
 const received=Object.fromEntries([...uploaded].map(p=>[p,true]));return {ok:true,json:async()=>({producer:true,progress:{approved:0,pending:0,changes:0,drafts:0,hasPhoto:true,producer:true,instagram:'producer'},drafts:saved && !submitted?[{...saved,received}]:[]})}
}
const Form=load('src/components/BeatCrateUploadForm.tsx',{
 'next/link':{default:props=>React.createElement('a',props)},
 '@/lib/supabase':{createClient:()=>({auth:{getSession:async()=>({data:{session:{access_token:'fixture',user:{id:owner}}}})}})},
 '@/lib/use-browser-session':{useBrowserSession:()=>({loading:false,session:{user:{id:owner},access_token:'fixture'}})},
 '@/lib/audio-formats':{isAllowedAudioFile:()=>({ok:true})},'@/lib/analytics':{trackEvent:()=>{}},'@/lib/beat-crate':lib,
 '@/lib/beat-crate-client':{audioFingerprint:async file=>file.name.padEnd(64,'0'),retryCrateFile:async(slot,file)=>{transfers.push(file.name);if(file.name==='Beat24.mp3' && failAt24){failAt24=false;throw new Error('Connection dropped at beat 24')}uploaded.add(slot.path)}},
 '@/components/BeatCrateChallenge':{CrateProgressCard:()=>React.createElement('aside')},
},{fetch:apiFetch,localStorage:{getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v),removeItem:k=>storage.delete(k)},window:{location:{search:'?challenge=crate',reload(){}},addEventListener(){},removeEventListener(){}},setTimeout:()=>1,clearTimeout(){}}).default
// Restore an old campaign draft through a legacy challenge link.
storage.set(`bvs.crate-draft.v1:${owner}`,JSON.stringify({id:randomUUID(),payload:{...lib.newCratePayload(),challenge:true},at:Date.now()}))
let tree
await act(async()=>{tree=TestRenderer.create(React.createElement(Form));for(let i=0;i<10;i++)await Promise.resolve()})
assert.equal(tree.root.findAllByType('aside').length,0,'campaign progress is hidden')
assert.doesNotMatch(JSON.stringify(tree.toJSON()),/25 Beat Crate Challenge|Instagram username/)
await act(async()=>tree.root.findAllByType('input').find(i=>i.props.multiple).props.onChange({target:{files:Array.from({length:25},(_,i)=>({name:`Beat${i+1}.mp3`,size:100,type:'audio/mpeg'})),value:''}}))
await act(async()=>tree.root.findAllByType('input').filter(i=>i.props.type==='checkbox').at(-1).props.onChange({target:{checked:true}}))
async function submit(){await act(async()=>{tree.root.findByType('form').props.onSubmit({preventDefault(){}});for(let i=0;i<1800;i++)await Promise.resolve()})}
await submit()
assert.equal(saved.payload.challenge,false,'old campaign drafts resume as ordinary crates')
assert.equal(transfers.length,24);assert.equal(uploaded.size,23)
assert.match(JSON.stringify(tree.toJSON()),/Connection dropped at beat 24/)
await submit()
assert.equal(transfers.length,26,'retry uploads only the failed 24th and missing 25th file')
assert.equal(uploaded.size,25);assert.equal(submitted,1)
assert.match(JSON.stringify(tree.toJSON()),/Response lost after commit/)
await submit()
assert.equal(transfers.length,26,'lost receipt recovery does not upload any files again')
assert.equal(submitted,1,'lost receipt recovery must not create another submission')
assert.match(JSON.stringify(tree.toJSON()),/already received/)
assert.equal(storage.size,0,'successful receipt recovery clears the browser backup')
await act(async()=>tree.unmount())
console.log('Beat crate client: 25 selected files, failure at #24, completed-file reuse, lost-response recovery and backup cleanup passed.')
