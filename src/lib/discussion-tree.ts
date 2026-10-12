export type DiscussionNode<T> = { message: T; children: DiscussionNode<T>[] };
export function discussionForest<T extends { id: string; replyToId: string | null; kind: string }>(messages: T[]): DiscussionNode<T>[] {
  const entries = messages.filter(message => message.kind !== "root");
  const nodes = new Map(entries.map(message => [message.id, { message, children: [] } as DiscussionNode<T>]));
  const roots: DiscussionNode<T>[] = [];
  for (const message of entries) {
    const node = nodes.get(message.id)!;
    let parent = message.replyToId ? nodes.get(message.replyToId) : undefined;
    const seen = new Set([message.id]);
    let cursor = parent;
    while (cursor) {
      if (seen.has(cursor.message.id)) { parent = undefined; break; }
      seen.add(cursor.message.id);
      cursor = cursor.message.replyToId ? nodes.get(cursor.message.replyToId) : undefined;
    }
    if (parent) parent.children.push(node); else roots.push(node);
  }
  return roots;
}
