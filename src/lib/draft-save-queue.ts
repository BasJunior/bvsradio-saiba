/** Keep writes in submission order, including after a failed request. */
export function createDraftSaveQueue() {
  let previous: Promise<unknown> = Promise.resolve()
  return function enqueue<T>(write: () => Promise<T>): Promise<T> {
    const next = previous.then(write, write)
    previous = next.catch(() => undefined)
    return next
  }
}
