'use client'

import { useState } from 'react'

export default function ShareCreatorButton({ name }: { name: string }) {
  const [copied, setCopied] = useState(false)
  const share = async () => {
    const url = window.location.href
    try {
      if (navigator.share) await navigator.share({ title: `${name} on BVS Radio`, url })
      else {
        await navigator.clipboard.writeText(url)
        setCopied(true)
        window.setTimeout(() => setCopied(false), 2000)
      }
    } catch {
      // User cancelled the native share sheet.
    }
  }
  return <button type="button" onClick={() => void share()} className="rounded-full border border-white/20 px-4 py-2 text-sm hover:border-brand">{copied ? 'Link copied' : 'Share profile'}</button>
}
