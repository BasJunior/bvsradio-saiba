/**
 * Versioned BeatStars-style beat licence templates.
 * Increment `version` when legal copy changes; checkout snapshots the version at purchase.
 */

export type BeatLicenceType =
  | 'standard_lease'
  | 'premium_lease'
  | 'exclusive'
  | 'free_download'
  | 'not_for_sale'

export type BeatLicenceTemplate = {
  type: BeatLicenceType
  name: string
  version: number
  summary: string
  terms: string
  isExclusive: boolean
  isFree: boolean
  defaultPriceUsd: number | null
  priceMinUsd: number | null
  priceMaxUsd: number | null
}

export const BEAT_LICENCE_TEMPLATES: BeatLicenceTemplate[] = [
  {
    type: 'standard_lease',
    name: 'Standard Lease',
    version: 1,
    summary:
      'Non-exclusive lease. Buyer may use the beat for up to 5,000 audio streams, 1 music video, and non-commercial use. Producer retains full rights and may resell.',
    terms:
      "Standard Non-Exclusive Lease — Version 1\n\nThis licence grants the buyer a non-exclusive, non-transferable right to use the beat in one (1) musical composition. Usage is limited to: 5,000 audio streams across all platforms, one (1) music video, and non-commercial public performance. The buyer may not register the composition with a PRO (BMI/ASCAP/etc) without the producer's written consent. Producer retains all rights and may license the beat to other parties. Credit to producer is required in metadata and promotional materials. This licence is perpetual once purchased. No refunds after download.",
    isExclusive: false,
    isFree: false,
    defaultPriceUsd: 29,
    priceMinUsd: 15,
    priceMaxUsd: 50,
  },
  {
    type: 'premium_lease',
    name: 'Premium Lease',
    version: 1,
    summary:
      'Non-exclusive lease with higher usage limits. Up to 100,000 streams, commercial use, stems included. Producer retains rights.',
    terms:
      'Premium Non-Exclusive Lease — Version 1\n\nThis licence grants the buyer a non-exclusive, non-transferable right to use the beat in one (1) musical composition. Usage is limited to: 100,000 audio streams, unlimited video, commercial use (soundtrack, advertising), and up to 5,000 physical copies. Stems/wav files included. Buyer may register with a PRO but must split 50% performance royalties with the producer. Producer retains all rights and may license the beat to other parties. Credit is required. No refunds after download.',
    isExclusive: false,
    isFree: false,
    defaultPriceUsd: 99,
    priceMinUsd: 50,
    priceMaxUsd: 200,
  },
  {
    type: 'exclusive',
    name: 'Exclusive Rights',
    version: 1,
    summary:
      'Full transfer of rights. Buyer owns the beat exclusively. Producer may not resell. Includes all files.',
    terms:
      'Exclusive Rights Transfer — Version 1\n\nThis agreement transfers all rights, title, and interest in the beat to the buyer on an exclusive basis. Producer retains no ownership and may not license, sell, or distribute the beat to any other party. Buyer receives all files (stems, multitracks, MIDI). Buyer may register the composition with a PRO and retain 100% of royalties. Producer agrees to take down the beat from all platforms within 14 days. This transfer is irrevocable. No refunds after download.',
    isExclusive: true,
    isFree: false,
    defaultPriceUsd: 499,
    priceMinUsd: 200,
    priceMaxUsd: 2000,
  },
  {
    type: 'free_download',
    name: 'Free Download (Tagged)',
    version: 1,
    summary: 'Free download with watermarked audio. Non-commercial use only.',
    terms:
      'Free Download — Version 1\n\nThis beat is provided free of charge with a producer tag/watermark. Buyer may use it for non-commercial demo, practice, or promotional purposes only. No commercial release, streaming, or monetization is permitted without upgrading to a paid licence. Producer retains all rights.',
    isExclusive: false,
    isFree: true,
    defaultPriceUsd: null,
    priceMinUsd: null,
    priceMaxUsd: null,
  },
  {
    type: 'not_for_sale',
    name: 'Not for Sale',
    version: 1,
    summary: 'Not currently available for licensing.',
    terms: '',
    isExclusive: false,
    isFree: false,
    defaultPriceUsd: null,
    priceMinUsd: null,
    priceMaxUsd: null,
  },
]

const BY_TYPE = Object.fromEntries(
  BEAT_LICENCE_TEMPLATES.map((t) => [t.type, t]),
) as Record<BeatLicenceType, BeatLicenceTemplate>

/** Track download licence types used on editorial tracks (not beat store). */
export type TrackDownloadLicenceType =
  | BeatLicenceType
  | 'personal_download'
  | 'custom'

export function isBeatLicenceType(value: string): value is BeatLicenceType {
  return value in BY_TYPE
}

export function getBeatLicenceTemplate(
  type: string | null | undefined,
): BeatLicenceTemplate | null {
  if (!type || !isBeatLicenceType(type)) return null
  return BY_TYPE[type]
}

export function getBeatLicenceTemplateOrDefault(
  type?: string | null,
): BeatLicenceTemplate {
  return getBeatLicenceTemplate(type) || BY_TYPE.standard_lease
}

/** Compact version string stored on beat_licence_options.terms_version */
export function licenceTermsVersionTag(template: BeatLicenceTemplate): string {
  return `${template.type}-v${template.version}`
}

export function licenceOptionSeed(
  type: BeatLicenceType = 'standard_lease',
  priceUsd?: number | null,
): {
  licence_code: BeatLicenceType
  licence_name: string
  price_usd: number | null
  currency: 'usd'
  included_files: string[]
  is_active: boolean
  terms_version: string
  terms_summary: string
  licence_template_version: number
  terms_full: string
} {
  const t = getBeatLicenceTemplateOrDefault(type)
  const price =
    typeof priceUsd === 'number' && Number.isFinite(priceUsd)
      ? Math.round(priceUsd * 100) / 100
      : t.defaultPriceUsd

  const included =
    t.type === 'exclusive' || t.type === 'premium_lease'
      ? ['preview', 'master', 'stems']
      : t.type === 'free_download'
        ? ['preview']
        : ['preview', 'master']

  return {
    licence_code: t.type,
    licence_name: t.name,
    price_usd: t.isFree ? 0 : price,
    currency: 'usd',
    included_files: included,
    is_active: t.type !== 'not_for_sale',
    terms_version: licenceTermsVersionTag(t),
    terms_summary: t.summary,
    licence_template_version: t.version,
    terms_full: t.terms,
  }
}

/** Dropdown labels for editorial / admin UIs */
export function beatLicenceSelectOptions(): Array<{
  value: BeatLicenceType
  label: string
}> {
  return BEAT_LICENCE_TEMPLATES.map((t) => {
    let range = ''
    if (t.isFree) range = ' · free'
    else if (t.priceMinUsd != null && t.priceMaxUsd != null) {
      range = ` · $${t.priceMinUsd}–$${t.priceMaxUsd}`
    }
    return { value: t.type, label: `${t.name}${range}` }
  })
}

/** Editorial track options include personal_download + custom */
export function editorialLicenceSelectOptions(): Array<{ value: string; label: string }> {
  const personal = {
    value: 'personal_download',
    label: 'Personal download · listening only',
  }
  const custom = { value: 'custom', label: 'Custom terms' }
  return [personal, ...beatLicenceSelectOptions(), custom]
}

export function rightsSummaryForLicenceType(type?: string | null): string {
  if (type === 'personal_download') {
    return 'Personal listening download. Copyright and reuse rights remain with the rights holder; this purchase does not grant sampling, sync or redistribution rights.'
  }
  if (type === 'custom') {
    return 'Custom licence terms as agreed with the rights holder. See order notes / rights summary at purchase.'
  }
  const t = getBeatLicenceTemplate(type)
  if (!t || t.type === 'not_for_sale') {
    return 'Not currently available for licensing or download sale.'
  }
  return `${t.summary} (template ${t.name} v${t.version}). Full terms snapshotted at purchase.`
}
