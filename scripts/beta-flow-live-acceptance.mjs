const baseUrl = String(process.env.BVS_BETA_URL || 'https://bvsradio-beta.vercel.app').replace(/\/$/, '')

const failures = []
const passes = []

async function get(path, init = {}) {
  const response = await fetch(`${baseUrl}${path}`, {
    redirect: 'follow',
    headers: {
      'User-Agent': 'BVS-Flow-v2-live-acceptance/1.0',
      ...(init.headers || {}),
    },
    ...init,
  })
  return response
}

async function expectPage(path, markers) {
  try {
    const response = await get(path)
    const body = await response.text()
    if (!response.ok) {
      failures.push(`${path}: expected 2xx, received ${response.status}`)
      return
    }
    for (const marker of markers) {
      if (!body.includes(marker)) {
        failures.push(`${path}: missing marker ${JSON.stringify(marker)}`)
        return
      }
    }
    passes.push(`${path}: ${response.status}`)
  } catch (error) {
    failures.push(`${path}: ${error instanceof Error ? error.message : String(error)}`)
  }
}

async function expectJson(path, validate) {
  try {
    const response = await get(path, { headers: { Accept: 'application/json' } })
    const payload = await response.json().catch(() => null)
    if (!response.ok) {
      failures.push(`${path}: expected 2xx JSON, received ${response.status}`)
      return null
    }
    const error = validate(payload)
    if (error) {
      failures.push(`${path}: ${error}`)
      return payload
    }
    passes.push(`${path}: ${response.status}`)
    return payload
  } catch (error) {
    failures.push(`${path}: ${error instanceof Error ? error.message : String(error)}`)
    return null
  }
}

await expectPage('/', ['BVS Radio'])
await expectPage('/library', ['Your BVS', 'BVS remembers your path'])
await expectPage('/search?mode=fresh', ['Explore BVS', 'Fresh', 'On BVS'])
await expectPage('/shows/beta-sunrise-show', ['Beta Sunrise Show', 'BVS Room'])

await expectJson('/api/station/tracks', (payload) => {
  if (!payload || !Array.isArray(payload.tracks)) return 'tracks array missing'
  return null
})

const pulse = await expectJson('/api/pulse?scope=global', (payload) => {
  if (!payload || !Array.isArray(payload.items)) return 'items array missing'
  return null
})

if (pulse?.items) {
  const showRoutes = [...new Set(
    pulse.items
      .filter((item) => item?.subject?.kind === 'show')
      .map((item) => item?.subject?.route)
      .filter((route) => typeof route === 'string' && route.startsWith('/shows/')),
  )]

  for (const route of showRoutes) {
    try {
      const response = await get(route)
      if (!response.ok) failures.push(`Pulse show route ${route}: received ${response.status}`)
      else passes.push(`Pulse show route ${route}: ${response.status}`)
    } catch (error) {
      failures.push(`Pulse show route ${route}: ${error instanceof Error ? error.message : String(error)}`)
    }
  }
}

console.log(`\nBVS Flow v2 live acceptance: ${baseUrl}`)
for (const pass of passes) console.log(`PASS  ${pass}`)
for (const failure of failures) console.error(`FAIL  ${failure}`)

if (failures.length) {
  console.error(`\n${failures.length} acceptance check(s) failed.`)
  process.exit(1)
}

console.log(`\nAll ${passes.length} live acceptance checks passed.`)
console.log('Note: this suite is read-only and does not prove interactive playback, 30-second stream qualification, authentication, payments, or native-shell behavior.')
