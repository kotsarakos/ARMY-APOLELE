/** Διάρκεια θητείας σε μήνες. Από 1/1/2026 όλοι κατατάσσονται στον Στρατό Ξηράς. */
export type ServiceMonths = 12 | 9 | 6 | 3

export type EssoCode = 'A' | 'B' | 'C' | 'D'

import type { Lang } from './i18n'

/** Κατηγορίες εξόδων που βγάζουν νόημα σε φαντάρο. */
export type ExpenseCategory =
  | 'canteen' | 'transport' | 'food' | 'phone' | 'gear' | 'fun' | 'other'

export interface Expense {
  id: string
  /** Ποσό σε **λεπτά** — ποτέ δεκαδικά, ώστε τα αθροίσματα να μη «γλιστρούν». */
  amount: number
  category: ExpenseCategory
  /** ISO 'YYYY-MM-DD'. */
  date: string
  note?: string
}

/**
 * Πάγιο έξοδο που επαναλαμβάνεται κάθε μήνα (τηλέφωνο, συνδρομές).
 * Δεν είναι έξοδο από μόνο του: παράγει κανονικά `Expense` όταν έρθει η μέρα
 * του, με ντετερμινιστικό id ώστε να μη γραφτεί ποτέ δύο φορές.
 */
export interface Recurring {
  id: string
  amount: number
  category: ExpenseCategory
  /** Μέρα του μήνα, 1-28 — το 28 είναι το τελευταίο που υπάρχει σε κάθε μήνα. */
  day: number
  note?: string
  /** ISO της πρώτης χρέωσης· δεν παράγουμε τίποτε πριν από αυτή. */
  since: string
}

/** Είδη άδειας. Οι τιμητικές δεν μετρούν στην κανονική δικαιούμενη. */
export type LeaveKind = 'regular' | 'honorary' | 'blood' | 'march' | 'sick'

export interface LeaveEntry {
  id: string
  kind: LeaveKind
  /** ISO 'YYYY-MM-DD', πρώτη μέρα εκτός μονάδας. */
  from: string
  /** ISO 'YYYY-MM-DD', τελευταία μέρα — **περιλαμβάνεται**. */
  to: string
  note?: string
}

/** Είδη υπηρεσίας. */
export type DutyKind = 'guard' | 'kitchen' | 'orderly' | 'patrol' | 'other'

export interface Duty {
  id: string
  kind: DutyKind
  /** ISO 'YYYY-MM-DD'. */
  date: string
  /** 'HH:MM' — ώρα ανάληψης. Προαιρετική. */
  start?: string
  /** Διάρκεια σε ώρες. */
  hours: number
  note?: string
}

export interface Profile {
  /** Ονοματεπώνυμο ή ψευδώνυμο — μόνο για εμφάνιση. */
  name: string
  /** Ημερομηνία κατάταξης, ISO 'YYYY-MM-DD'. */
  enlistDate: string
  /** Πλήρης (12) ή μειωμένη (9/6/3) στρατιωτική υποχρέωση. */
  months: ServiceMonths
  /** Μονάδα σε παραμεθόριο (Θράκη, νησιά Αν. Αιγαίου, Δωδεκάνησα, ΕΛΔΥΚ). */
  borderUnit: boolean
  /** Προαιρετικό: όνομα μονάδας/ΚΕΝ για εμφάνιση. */
  unit?: string
  /**
   * Ημέρες άδειας που έχουν ήδη καταναλωθεί.
   * **Παλιό πεδίο.** Πλέον η πηγή αλήθειας είναι το `leaves`· μένει μόνο για
   * να μεταφερθούν προφίλ που γράφτηκαν πριν μπουν οι ημερομηνίες.
   * @deprecated
   */
  leaveTaken: number
  /** Άδειες με ημερομηνίες. Πηγή αλήθειας για τις μέρες που πάρθηκαν. */
  leaves: LeaveEntry[]
  /** Υπηρεσίες (σκοπιές, θάλαμος, αγγαρείες). */
  duties: Duty[]
  /** Φορές αιμοδοσίας (έως 2, τιμητική άδεια 2-4 ημέρες η κάθε μία). */
  bloodDonations: number
  /** Γλώσσα διεπαφής. */
  lang: Lang
  /** Χρήματα που έχει ο φαντάρος εκτός στρατού, σε **λεπτά**. */
  startingBalance: number
  /** Καταγεγραμμένα έξοδα. */
  expenses: Expense[]
  /** Πάγια μηνιαία έξοδα. */
  recurring: Recurring[]
  /**
   * Ταφόπλακες: id που έχει σβήσει ο χρήστης.
   *
   * Χωρίς αυτές, η συγχώνευση δύο συσκευών θα ανάσταινε ό,τι έσβησες στη μία
   * αλλά υπάρχει ακόμη στην άλλη. Κρατιούνται τα τελευταία `MAX_TOMBSTONES`.
   */
  deletedIds: string[]
  /** Epoch ms της τελευταίας αλλαγής — καθορίζει ποια συσκευή «κερδίζει». */
  updatedAt: number
}

export const DEFAULT_PROFILE: Profile = {
  name: '',
  enlistDate: '',
  months: 12,
  borderUnit: false,
  unit: '',
  leaveTaken: 0,
  leaves: [],
  duties: [],
  bloodDonations: 0,
  lang: 'el',
  startingBalance: 0,
  expenses: [],
  recurring: [],
  deletedIds: [],
  updatedAt: 0,
}
