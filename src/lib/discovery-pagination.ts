/** Follow every database page, even when its configured row cap is below pageSize. */
export async function readDiscoveryPages<T extends { id: string }>(
  read: (after: string | undefined, pageSize: number) => Promise<T[]>, pageSize = 500,
): Promise<T[]> {
  const rows: T[] = []
  let after: string | undefined
  for (;;) {
    const page = await read(after, pageSize)
    if (!page.length) return rows
    const next = page[page.length - 1].id
    if (!next || (after && next <= after)) throw new Error('Search pagination did not advance')
    rows.push(...page)
    after = next
  }
}
