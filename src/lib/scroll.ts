/**
 * Scrolls to a section of the page.
 *
 * Two routes end up here: the home-screen shortcuts (`/?add=duty`) and the
 * buttons on empty states. In both cases the person has explicitly said "I
 * want to write something down", so the form should be in front of them
 * without any hunting.
 */
export function focusSection(id: string): void {
  const el = document.getElementById(id)
  if (!el) return

  const reduce = typeof matchMedia !== 'undefined' &&
    matchMedia('(prefers-reduced-motion: reduce)').matches
  el.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' })

  // Focus lands on the first field, so this works from a keyboard too.
  const field = el.querySelector<HTMLElement>('input, select, button')
  field?.focus({ preventScroll: true })
}
