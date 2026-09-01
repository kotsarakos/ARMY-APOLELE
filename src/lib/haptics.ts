/**
 * Δόνηση επιβεβαίωσης.
 *
 * Σε κινητό, μια καταχώρηση που δεν «ακουμπάει» πίσω μοιάζει να μην έγινε —
 * ειδικά όταν το toast εμφανίζεται κάτω από τον αντίχειρα. Ένας πολύ σύντομος
 * παλμός λύνει το θέμα χωρίς ήχο, που στη σκοπιά δεν θα ήταν ευπρόσδεκτος.
 *
 * Δεν γίνεται τίποτα σε επιτραπέζιο (δεν υπάρχει μηχανισμός), στο iOS Safari
 * (δεν υλοποιεί το Vibration API) και σε όποιον έχει ζητήσει λιγότερη κίνηση.
 */

type Pattern = number | number[]

function allowed(): boolean {
  if (typeof navigator === 'undefined' || typeof navigator.vibrate !== 'function') return false
  if (typeof matchMedia === 'undefined') return true
  // Το «λιγότερη κίνηση» είναι η καθιερωμένη δήλωση «λιγότερα ερεθίσματα».
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return false
  return matchMedia('(hover: none) and (pointer: coarse)').matches
}

function buzz(pattern: Pattern): void {
  if (!allowed()) return
  try { navigator.vibrate(pattern) } catch { /* το αγνοούν κάποιοι browsers */ }
}

/** Ελαφρύ άγγιγμα — επιλογή, άνοιγμα φύλλου. */
export function tap(): void { buzz(8) }

/** Κάτι καταχωρήθηκε. */
export function ok(): void { buzz(14) }

/** Κάτι δεν έγινε — δύο σύντομοι παλμοί, αισθητά διαφορετικοί από το «ok». */
export function warn(): void { buzz([10, 70, 10]) }
