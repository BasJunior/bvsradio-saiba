export function fairDailyOrder<T extends { id: string }>(items: T[], scope: string, now = new Date()): T[] {
  const stable = [...items].sort((a, b) => a.id.localeCompare(b.id))
  const day = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Africa/Harare',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now)

  let state = 2166136261
  const seed = `${scope}:${day}`
  for (let index = 0; index < seed.length; index += 1) {
    state ^= seed.charCodeAt(index)
    state = Math.imul(state, 16777619)
  }
  state >>>= 0
  if (!state) state = 1

  const random = () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0
    return state / 4294967296
  }

  for (let index = stable.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(random() * (index + 1))
    ;[stable[index], stable[swapIndex]] = [stable[swapIndex], stable[index]]
  }

  return stable
}

/**
 * Public marketplace ordering: rotate creators once per BVS day, then round-robin
 * one item per creator before any creator receives a second slot. This keeps browse
 * stable during a session/day while preventing prolific uploaders from owning the
 * first screen. Creator dashboards should continue using their normal newest-first
 * management order.
 */
export function fairCreatorDailyOrder<T extends { id: string }>(
  items: T[],
  scope: string,
  creatorKey: (item: T) => string | null | undefined,
  now = new Date(),
): T[] {
  if (items.length < 2) return [...items]

  const groups = new Map<string, T[]>()
  const canonical = [...items].sort((a, b) => a.id.localeCompare(b.id))
  for (const item of canonical) {
    const rawKey = String(creatorKey(item) || '').trim().toLocaleLowerCase('en')
    const key = rawKey || `unknown:${item.id}`
    const group = groups.get(key) || []
    group.push(item)
    groups.set(key, group)
  }

  const creators = fairDailyOrder(
    [...groups.keys()].map((id) => ({ id })),
    `${scope}:creators`,
    now,
  )

  const queues = new Map<string, T[]>()
  for (const creator of creators) {
    queues.set(
      creator.id,
      fairDailyOrder(groups.get(creator.id) || [], `${scope}:items:${creator.id}`, now),
    )
  }

  const result: T[] = []
  let remaining = items.length
  while (remaining > 0) {
    for (const creator of creators) {
      const queue = queues.get(creator.id)
      const next = queue?.shift()
      if (!next) continue
      result.push(next)
      remaining -= 1
    }
  }

  return result
}
