/** A local id. It does not need to be globally unique — only unique within
 *  one person's profile — but the random suffix prevents a collision when two
 *  devices happen to write in the same millisecond. */
export function newId(prefix = ''): string {
  const core = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
  return prefix ? `${prefix}-${core}` : core
}
