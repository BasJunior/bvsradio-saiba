'use client';
import {useState} from 'react';
import {beatVibeKey,beatVibeSuggestions} from '@/lib/beat-vibe-normalization';
import {beatGenreKey} from '@/lib/beat-genre-normalization';
export default function BeatUploadSuggestions({genre,value,onChange}: {genre:string;value:string;onChange:(value:string)=>void}) {
  const [expanded,setExpanded]=useState(false);
  const key=beatGenreKey(genre);
  const suggested=key.includes('rnb') || key.includes('soul') ? ['Soulful','Smooth','Romantic','Emotional','Laid Back','Melodic'] : key.includes('drill') || key.includes('trap') ? ['Dark','Hard','Aggressive','Melodic','Gritty','Hype'] : key.includes('afro') || key.includes('amapiano') || key.includes('dancehall') ? ['Dance','Energetic','Summer','Uplifting','Smooth','Turn Up'] : key.includes('lofi') || key.includes('jazz') ? ['Chill','Laid Back','Nostalgic','Smooth','Ambient','Soulful'] : ['Chill','Dark','Melodic','Energetic','Soulful','Cinematic'];
  const options=expanded ? [...new Set([...suggested,...beatVibeSuggestions])] : suggested;
  const selected=value.split(/[,;]/).map(tag=>beatVibeKey(tag.trim())).filter(Boolean);
  function choose(tag:string) {
    const parts=value.split(/[,;]/).map(part=>part.trim()).filter(Boolean);
    const exists=selected.includes(beatVibeKey(tag));
    const next=exists ? parts.filter(part=>beatVibeKey(part)!==beatVibeKey(tag)).join(', ') : [...parts,tag].join(', ');
    if(next.length<=120)onChange(next);
  }
  return <div className="mt-3 border-t border-white/10 pt-3"><p className="text-xs font-medium text-text-secondary">Vibe suggestions{genre ? ` for ${genre}` : ''}</p><p className="mt-1 text-xs leading-5 text-text-secondary">Choose a few that describe the sound. These help listeners find your beat through BeatStore’s vibe filters.</p><div className="mt-2 flex flex-wrap gap-2" role="group" aria-label="Suggested beat vibes">{options.map(tag=><button type="button" key={tag} aria-pressed={selected.includes(beatVibeKey(tag))} onClick={()=>choose(tag)} className={`min-h-9 border px-3 text-xs ${selected.includes(beatVibeKey(tag)) ? 'border-brand/40 bg-brand/10 text-brand' : 'border-white/15 text-text-secondary hover:border-brand/40'}`}>{tag}</button>)}</div><button type="button" aria-expanded={expanded} onClick={()=>setExpanded(!expanded)} className="mt-1 min-h-11 text-xs text-brand">{expanded ? 'Show suggested vibes' : 'Browse all vibes'}</button><p className="text-[11px] text-text-secondary">Tags are suggestions. Keep custom wording in the Vibes field. {value.length}/120 characters.</p></div>;
}
