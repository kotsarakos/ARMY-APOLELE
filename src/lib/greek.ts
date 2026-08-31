/**
 * Κεφαλαιοποίηση με τον ελληνικό τυπογραφικό κανόνα.
 *
 * Στα κεφαλαία ο τόνος παραλείπεται — ΥΠΟΛΟΓΙΣΤΗΣ, όχι ΥΠΟΛΟΓΙΣΤΉΣ — εκτός
 * όταν πέφτει στο **αρχικό** γράμμα της λέξης, οπότε διατηρείται: ΆΔΕΙΕΣ,
 * ΈΡΧΟΝΤΑΙ, Ή.
 *
 * Τα διαλυτικά ΔΕΝ είναι τόνος και μένουν πάντα: ΑΫΠΝΙΑ.
 *
 * Δεν χρησιμοποιούμε `text-transform: uppercase` γι' αυτό, επειδή ο browser
 * αφαιρεί τον τόνο και από το αρχικό γράμμα.
 */

/** Συνδυαστικός χαρακτήρας οξείας (τόνος) μετά από NFD. */
const TONOS = '́'

export function upperGreek(input: string): string {
  // Δουλεύουμε ανά λέξη: ο κανόνας αφορά το αρχικό γράμμα κάθε λέξης.
  return input.replace(/[\p{L}\p{M}]+/gu, (word) => {
    const decomposed = word.toUpperCase().normalize('NFD')
    let out = ''
    let baseIndex = -1

    for (const ch of decomposed) {
      if (ch === TONOS) {
        // Ο τόνος ακολουθεί το γράμμα του· κρατιέται μόνο στο πρώτο.
        if (baseIndex === 0) out += ch
        continue
      }
      // Κάθε μη-συνδυαστικός χαρακτήρας προχωρά τη θέση του γράμματος.
      if (!/\p{M}/u.test(ch)) baseIndex += 1
      out += ch
    }

    return out.normalize('NFC')
  })
}
