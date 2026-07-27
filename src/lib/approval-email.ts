import 'server-only'
import { sendBvsEmail } from '@/lib/mailer'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || ''

type ApprovalKind = 'track' | 'release' | 'beat'

function cleanTitle(value: string) {
  return value.replace(/[\r\n]+/g, ' ').trim().slice(0, 160) || 'Your music'
}

export async function sendMusicApprovalEmail(input: {
  userId: string
  title: string
  kind: ApprovalKind
}) {
  if (!supabaseUrl || !serviceKey || !input.userId) return

  const response = await fetch(`${supabaseUrl}/auth/v1/admin/users/${encodeURIComponent(input.userId)}`, {
    headers: {
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
    },
    cache: 'no-store',
  })
  if (!response.ok) throw new Error(`Could not resolve approval email recipient (${response.status})`)

  const user = await response.json() as { email?: string }
  if (!user.email) return

  const title = cleanTitle(input.title)
  const label = input.kind === 'release' ? 'release' : input.kind === 'beat' ? 'beat' : 'track'
  const catalogueUrl = 'https://bvsradio.com/catalogue'
  const subject = `Approved on BVS Radio: ${title}`
  const text = [
    'Good news — your music has been approved by BVS Radio.',
    '',
    `${label[0].toUpperCase()}${label.slice(1)}: ${title}`,
    '',
    input.kind === 'release'
      ? 'Your release has been published to the BVS catalogue.'
      : `Your ${label} has passed editorial review. It can now proceed to publishing and rotation.`,
    '',
    `Open the BVS catalogue: ${catalogueUrl}`,
    '',
    'Thank you for submitting your work to BVS Radio.',
    '',
    'BVS Radio Editorial',
  ].join('\n')

  await sendBvsEmail({ to: user.email, subject, text })
}

