'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { readCartLines, writeCartLines } from '@/lib/cart-client'

type Listing = { id:string; listing_type:string; category:string; title:string; description:string; price_usd:number; licence_summary?:string; compatibility?:string; profiles?:{ username?:string; creator_public_name?:string; display_name?:string } }
type Profile = { user_id:string; roles:string[]; headline:string; bio:string; skills:string[]; accomplishments:Array<{title:string;detail?:string;verification?:string}>; profiles?:{username?:string;creator_public_name?:string;display_name?:string} }

export default function MarketplacePage() {
  const [data,setData]=useState<{listings:Listing[];profiles:Profile[]}>({listings:[],profiles:[]})
  const [added,setAdded]=useState<string | null>(null)
  useEffect(()=>{ void fetch('/api/marketplace',{cache:'no-store'}).then(r=>r.json()).then(setData).catch(()=>null) },[])
  function addProduct(item: Listing) {
    const current = readCartLines()
    const existing = current.findIndex(line => String(line.id) === item.id && line.type === 'creator_product')
    const next = [...current]
    if (existing >= 0) next[existing] = { ...next[existing], quantity: 1 }
    else next.push({
      id: item.id,
      title: item.title,
      artist: item.profiles?.creator_public_name || item.profiles?.display_name || item.profiles?.username || 'BVS creator',
      type: 'creator_product',
      price: Number(item.price_usd),
      quantity: 1,
      delivery: item.licence_summary || 'Private download after confirmed payment',
    })
    writeCartLines(next)
    setAdded(item.id)
  }
  return <main className="mx-auto max-w-7xl px-6 py-12">
    <p className="text-xs uppercase tracking-[.24em] text-brand">BVS Creator Marketplace</p>
    <h1 className="mt-3 text-5xl font-semibold">Discover creators. Buy their work. Hire their skills.</h1>
    <p className="mt-5 max-w-3xl text-lg text-text-secondary">One BVS ecosystem for beats, production assets, professional services and credible creator profiles. Approval protects the marketplace; Premium expands business tools but never buys approval or ranking.</p>
    <div className="mt-8 flex flex-wrap gap-3"><Link href="/catalogue?type=beat#beatstore" className="rounded-full bg-brand px-5 py-2 font-semibold text-black">Browse beats</Link><a href="#products" className="rounded-full border border-white/20 px-5 py-2">Creator products</a><Link href="/shop" className="rounded-full border border-white/20 px-5 py-2">BVS Studio services</Link><a href="#creators" className="rounded-full border border-white/20 px-5 py-2">Creators</a><Link href="/creator/marketplace" className="rounded-full border border-brand/50 px-5 py-2 text-brand">Build your marketplace profile</Link></div>

    <section id="products" className="mt-16"><p className="text-xs uppercase tracking-[.2em] text-brand">Approved listings</p><h2 className="mt-2 text-3xl font-semibold">Products & services</h2>{data.listings.length?<div className="mt-6 grid gap-5 md:grid-cols-2 lg:grid-cols-3">{data.listings.map(item=><article key={item.id} className="rounded-2xl border border-white/10 bg-white/[.03] p-6"><div className="flex justify-between gap-4"><span className="text-xs uppercase text-brand">{item.listing_type.replaceAll('_',' ')} · {item.category.replaceAll('_',' ')}</span><strong>${Number(item.price_usd).toFixed(2)}</strong></div><h3 className="mt-3 text-xl font-semibold">{item.title}</h3><p className="mt-2 text-sm text-text-secondary">{item.description}</p><p className="mt-4 text-xs text-text-secondary">by {item.profiles?.creator_public_name || item.profiles?.display_name || item.profiles?.username || 'BVS creator'}</p>{item.licence_summary?<p className="mt-3 rounded-xl border border-white/10 p-3 text-xs text-text-secondary">Licence: {item.licence_summary}</p>:null}{item.listing_type==='digital_product'?<div className="mt-4 flex gap-2"><button type="button" onClick={()=>addProduct(item)} className="rounded-full bg-brand px-4 py-2 text-sm font-semibold text-black">{added===item.id?'Added to basket':'Add to basket'}</button>{added===item.id?<Link href="/checkout" className="rounded-full border border-white/20 px-4 py-2 text-sm">Checkout</Link>:null}</div>:<span className="mt-4 inline-block text-xs text-amber-200">Service bookings remain Pilot until briefs, revisions and delivery are complete</span>}</article>)}</div>:<div className="mt-6 rounded-2xl border border-white/10 p-8 text-text-secondary">Creator product submissions are open. Public products appear only after Editorial approves the profile, rights, licence and private fulfilment file.</div>}</section>

    <section id="creators" className="mt-16"><p className="text-xs uppercase tracking-[.2em] text-brand">Professional creator directory</p><h2 className="mt-2 text-3xl font-semibold">Approved creators</h2>{data.profiles.length?<div className="mt-6 grid gap-5 md:grid-cols-2">{data.profiles.map(profile=><article key={profile.user_id} className="rounded-2xl border border-white/10 p-6"><p className="text-xs uppercase text-brand">{profile.roles.join(' · ')}</p><h3 className="mt-2 text-xl font-semibold">{profile.profiles?.creator_public_name || profile.profiles?.display_name || profile.profiles?.username}</h3><p className="mt-2 text-sm text-text-secondary">{profile.headline || profile.bio}</p><div className="mt-4 flex flex-wrap gap-2">{profile.skills?.map(skill=><span key={skill} className="rounded-full bg-white/5 px-3 py-1 text-xs">{skill.replaceAll('_',' ')}</span>)}</div>{profile.accomplishments?.slice(0,3).map(item=><p key={item.title} className="mt-3 text-xs text-text-secondary">• {item.title} <span className="text-white/40">· {item.verification==='verified'?'BVS verified':'creator entered'}</span></p>)}</article>)}</div>:<p className="mt-6 text-text-secondary">Approved multi-role creator profiles will appear here.</p>}</section>

    <section className="mt-16 grid gap-5 md:grid-cols-3"><div className="rounded-2xl border border-white/10 p-6"><h3 className="font-semibold">Free can earn</h3><p className="mt-2 text-sm text-text-secondary">Approval unlocks genuine participation. Premium is not required for editorial approval.</p></div><div className="rounded-2xl border border-white/10 p-6"><h3 className="font-semibold">Premium helps scale</h3><p className="mt-2 text-sm text-text-secondary">More listings, richer tools, analytics and lower marketplace fees arrive by role and product readiness.</p></div><div className="rounded-2xl border border-white/10 p-6"><h3 className="font-semibold">Trust is evidence-based</h3><p className="mt-2 text-sm text-text-secondary">Self-declared accomplishments are labelled. BVS verification requires evidence or platform records.</p></div></section>
  </main>
}
