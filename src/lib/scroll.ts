/**
 * Μετακίνηση σε ενότητα της σελίδας.
 *
 * Το χρησιμοποιούν δύο δρόμοι που καταλήγουν στο ίδιο σημείο: οι συντομεύσεις
 * του εικονιδίου (`/?add=duty`) και τα κουμπιά των κενών καταστάσεων. Και στις
 * δύο περιπτώσεις ο χρήστης ζήτησε ρητά «θέλω να γράψω κάτι», οπότε η φόρμα
 * πρέπει να είναι μπροστά του χωρίς να ψάχνει.
 */
export function focusSection(id: string): void {
  const el = document.getElementById(id)
  if (!el) return

  const reduce = typeof matchMedia !== 'undefined' &&
    matchMedia('(prefers-reduced-motion: reduce)').matches
  el.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' })

  // Η εστίαση πάει στο πρώτο πεδίο, ώστε να δουλεύει και με πληκτρολόγιο.
  const field = el.querySelector<HTMLElement>('input, select, button')
  field?.focus({ preventScroll: true })
}
