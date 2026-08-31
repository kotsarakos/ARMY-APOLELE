/** Τοπικό id. Δεν χρειάζεται να είναι καθολικά μοναδικό — μόνο μέσα στο
 *  προφίλ ενός χρήστη — αλλά ο τυχαίος επίλογος αποτρέπει σύγκρουση όταν
 *  δύο συσκευές γράφουν το ίδιο χιλιοστό του δευτερολέπτου. */
export function newId(prefix = ''): string {
  const core = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
  return prefix ? `${prefix}-${core}` : core
}
