'use client';

import Image from 'next/image';
import { useState } from 'react';

export default function CreatorProfileArtwork({ src, name, priority = false }: { src?: string; name: string; priority?: boolean }) {
  const [failed, setFailed] = useState<string | undefined>();
  return <>
    <span aria-hidden="true" className="absolute inset-0 grid place-items-center bg-[linear-gradient(145deg,#252922,#101010)] text-4xl font-black tracking-tight text-brand/60">{name.split(/\s+/).slice(0, 2).map(word => word[0]).join('')}</span>
    {src && failed !== src ? <Image src={src} alt={priority ? name : ''} fill unoptimized={/^https?:\/\//i.test(src) || src.startsWith('/api/media/')} sizes={priority ? '(max-width: 639px) 160px, 320px' : '80px'} className="object-cover object-center" priority={priority} onError={() => setFailed(src)} /> : null}
  </>;
}
