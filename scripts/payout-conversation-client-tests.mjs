import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import vm from 'node:vm'
import ts from 'typescript'
import React from 'react'
import * as jsx from 'react/jsx-runtime'
import TestRenderer, { act } from 'react-test-renderer'
import { webcrypto } from 'node:crypto'
globalThis.IS_REACT_ACT_ENVIRONMENT = true
const exports={}
let author='creator',requests=[],messages=[],failSend=false,confirmedName=null
const fetcher=async(path,init={})=>{
 if(init.method==='POST'){
  const body=JSON.parse(init.body);requests.push(body)
  if(failSend){failSend=false;throw new Error('Connection lost')}
  if(body.confirmedName)confirmedName=body.confirmedName
  messages.push({id:body.id,body:body.message||`Confirmed: ${body.confirmedName}`,authorKind:author,createdAt:new Date().toISOString(),confirmedName:body.confirmedName})
  return {ok:true,json:async()=>({ok:true})}
 }
 if(init.method==='PATCH')return {ok:true,json:async()=>({ok:true})}
 return {ok:true,json:async()=>({messages,savedFullName:author==='creator'?'Saved Legal Name':undefined,confirmedName,confirmedAt:confirmedName?new Date().toISOString():null,nextCursor:null})}
}
const code=ts.transpileModule(readFileSync('src/components/PayoutConversation.tsx','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText
vm.runInNewContext(code,{exports,require:name=>{if(name==='react')return React;if(name==='react/jsx-runtime')return jsx;throw new Error(name)},crypto:webcrypto,fetch:fetcher,window:{location:{hash:''},setInterval:()=>1,clearInterval(){},addEventListener(){},removeEventListener(){}},document:{getElementById:()=>null},console,Date,Map,Set,Promise,AbortController})
const Component=exports.default
let tree
const flush=async()=>{for(let i=0;i<25;i++)await Promise.resolve()}
const button=text=>tree.root.findAllByType('button').find(node=>node.children.join('')===text)
await act(async()=>{tree=TestRenderer.create(React.createElement(Component,{requestId:'fixture',token:'token'}));await flush()})
assert.equal(requests.length,0,'visiting a request never confirms a name or sends a message')
await act(async()=>{tree.root.findByProps({'aria-controls':'conversation-fixture'}).props.onClick();await flush()})
assert.match(JSON.stringify(tree.toJSON()),/Saved Legal Name/)
assert.equal(requests.length,0,'showing the saved private name still requires explicit confirmation')
await act(async()=>{button('Confirm payout name').props.onClick();await flush()})
assert.equal(requests[0].confirmedName,'Saved Legal Name')
assert.equal(requests[0].status,undefined)
assert.match(JSON.stringify(tree.toJSON()),/Creator-confirmed payout name/)
await act(async()=>{tree.root.findAllByType('input').filter(n=>n.props.type==='radio').at(-1).props.onChange();await flush()})
await act(async()=>{tree.root.findByProps({autoComplete:'name'}).props.onChange({target:{value:'Other Account Name'}})})
await act(async()=>{button('Update confirmed name').props.onClick();await flush()})
assert.equal(requests[1].confirmedName,'Other Account Name','creator may explicitly confirm a different registered holder')
await act(async()=>tree.root.findByType('textarea').props.onChange({target:{value:'Please check my details.'}}))
failSend=true
const submit=async()=>{await act(async()=>{tree.root.findByType('form').props.onSubmit({preventDefault(){}});await flush()})}
await submit();assert.equal(tree.root.findByType('textarea').props.value,'Please check my details.','failed send preserves reply text')
await submit();assert.equal(requests.at(-1).id,requests.at(-2).id,'retry keeps the idempotency key')
assert.equal(tree.root.findByType('textarea').props.value,'')
await act(async()=>tree.unmount())
author='staff';messages=[];requests=[]
await act(async()=>{tree=TestRenderer.create(React.createElement(Component,{requestId:'fixture',token:'token',staff:true,hasNewReply:true}));await flush()})
await act(async()=>{tree.root.findByProps({'aria-controls':'conversation-fixture'}).props.onClick();await flush()})
assert.equal(tree.root.findAllByType('input').filter(n=>n.props.type==='radio').length,0,'staff cannot confirm the creator name')
await act(async()=>tree.root.findByType('textarea').props.onChange({target:{value:'Please confirm your EcoCash name.'}}))
await submit();assert.equal(requests[0].message,'Please confirm your EcoCash name.')
assert.equal(requests[0].confirmedName,undefined)
await act(async()=>tree.unmount())
console.log('Payout conversation UI: explicit saved/different name confirmation, private Finance composer, retained draft, safe retry and no status side effects passed.')
