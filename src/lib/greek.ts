/**
 * Capitalisation that follows the Greek typographic rule.
 *
 * In upper case the accent is dropped — ΥΠΟΛΟΓΙΣΤΗΣ, not ΥΠΟΛΟΓΙΣΤΉΣ — unless
 * it falls on the **first** letter of the word, where it is kept: ΆΔΕΙΕΣ,
 * ΈΡΧΟΝΤΑΙ, Ή.
 *
 * A diaeresis is NOT an accent and always survives: ΑΫΠΝΙΑ.
 *
 * `text-transform: uppercase` cannot be used for this, because the browser
 * strips the accent from the first letter too.
 */

/** The combining acute accent, as it appears after NFD normalisation. */
const TONOS = '́'

export function upperGreek(input: string): string {
  // Word by word: the rule is about the first letter of each word.
  return input.replace(/[\p{L}\p{M}]+/gu, (word) => {
    const decomposed = word.toUpperCase().normalize('NFD')
    let out = ''
    let baseIndex = -1

    for (const ch of decomposed) {
      if (ch === TONOS) {
        // The accent trails its letter, and is kept only on the first one.
        if (baseIndex === 0) out += ch
        continue
      }
      // Any non-combining character advances the letter position.
      if (!/\p{M}/u.test(ch)) baseIndex += 1
      out += ch
    }

    return out.normalize('NFC')
  })
}
