import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import React from 'react';
import * as jsx from 'react/jsx-runtime';
import TestRenderer,{act} from 'react-test-renderer';
import {parseReleaseFormDraft,releaseFormDraftKey} from '../src/lib/release-form-draft.ts';
globalThis.IS_REACT_ACT_ENVIRONMENT=true;
const storage=new Map();let owner='creator-one';let blocked=false;
const localStorage={getItem:key=>storage.get(key)||null,setItem:(key,value)=>{if(blocked)throw Error('Storage blocked');storage.set(key,value);},removeItem:key=>storage.delete(key)};
const imports={
 '@/lib/use-browser-session':{useBrowserSession:()=>({session:{user:{id:owner}},loading:false})},
 '@/lib/release-form-draft':{parseReleaseFormDraft,releaseFormDraftKey},
 '@/lib/supabase':{isSupabaseConfigured:()=>false,createClient:()=>{throw Error('No auth expected');}},
 '@/lib/audio-formats':{isAllowedAudioFile:()=>({ok:true})},'@/lib/analytics':{trackEvent:()=>{}},
 '@/lib/signed-upload':{fetchJson:()=>{throw Error('No uploads expected');},humanizeUploadError:String,putToSignedSlot:()=>{}},
};
const exports={};vm.runInNewContext(ts.transpileModule(readFileSync('src/components/ReleaseSubmitForm.tsx','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText,{exports,require:name=>name==='react'?React:name==='react/jsx-runtime'?jsx:imports[name],window:{localStorage,addEventListener:()=>{},removeEventListener:()=>{}},localStorage,queueMicrotask,Date,console,URL,URLSearchParams});
const Form=exports.default;let tree;
async function mount(){await act(async()=>{tree=TestRenderer.create(React.createElement(Form));await Promise.resolve();});}
await mount();
const title=()=>tree.root.findAllByType('input').find(input=>input.props.placeholder==='Your official release title');
await act(async()=>{title().props.onChange({target:{value:'Saved session'}});});
const saved=parseReleaseFormDraft(storage.get(releaseFormDraftKey(owner)));assert.equal(saved.title,'Saved session');assert(!('rights' in saved));assert(!('grantHost' in saved));
await act(async()=>tree.unmount());await mount();assert.equal(title().props.value,'Saved session','metadata restores after remount');
owner='creator-two';await act(async()=>tree.update(React.createElement(Form)));assert.equal(title().props.value,'','account switch remounts without previous metadata');
await act(async()=>tree.unmount());owner='creator-one';await mount();assert.equal(title().props.value,'Saved session');
blocked=true;await act(async()=>title().props.onChange({target:{value:'Changed with blocked storage'}}));assert(tree.root.findAllByType('p').some(node=>node.children.join('').includes('could not save')));await act(async()=>tree.unmount());
assert.equal(parseReleaseFormDraft('{broken'),null);
const raw=JSON.parse(storage.get(releaseFormDraftKey('creator-one')));assert.equal(parseReleaseFormDraft(JSON.stringify({...raw,savedAt:Date.now()-31*86400000})),null);
assert.notEqual(releaseFormDraftKey('one'),releaseFormDraftKey('two'));assert.notEqual(releaseFormDraftKey('one','song-a'),releaseFormDraftKey('one','song-b'));
console.log('Release form drafts: actual form autosave/restoration, account switch isolation, workspace keys, storage failures, expiry and confirmation exclusion passed.');
