/**
 * A confirming buzz.
 *
 * On a phone, an entry that does not push back feels like it did not happen —
 * especially when the toast appears underneath your thumb. A very short pulse
 * settles it without sound, which on guard duty would not be welcome.
 *
 * Nothing happens on desktop (no hardware for it), on iOS Safari (which does
 * not implement the Vibration API), or for anyone who has asked for less
 * motion.
 */

type Pattern = number | number[]

function allowed(): boolean {
  if (typeof navigator === 'undefined' || typeof navigator.vibrate !== 'function') return false
  if (typeof matchMedia === 'undefined') return true
  // "Reduced motion" is the established way of saying "fewer stimuli".
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return false
  return matchMedia('(hover: none) and (pointer: coarse)').matches
}

function buzz(pattern: Pattern): void {
  if (!allowed()) return
  try { navigator.vibrate(pattern) } catch { /* some browsers just ignore it */ }
}

/** A light tap — a selection, a sheet opening. */
export function tap(): void { buzz(8) }

/** Something was recorded. */
export function ok(): void { buzz(14) }

/** Something failed — two short pulses, clearly unlike the "ok" one. */
export function warn(): void { buzz([10, 70, 10]) }
