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
