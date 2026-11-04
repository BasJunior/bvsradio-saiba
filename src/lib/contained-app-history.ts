/** Remember app destinations without turning filter replacements into Back entries. */
export function recordAppRoute(stack: string[], route: string): string[] {
  if (stack[stack.length - 1] === route) return stack;
  if (stack[stack.length - 2] === route) return stack.slice(0, -1);
  if (stack[stack.length - 1]?.split("?")[0] === route.split("?")[0]) {
    return [...stack.slice(0, -1), route];
  }
  return [...stack, route].slice(-24);
}

export function appBackRoute(stack: string[], home: string): string {
  const previous = stack[stack.length - 2] || home;
  return previous === home || previous.startsWith(`${home}/`) || previous.startsWith(`${home}?`) ? previous : home;
}
