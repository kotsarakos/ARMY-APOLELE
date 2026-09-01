/**
 * Εικονίδια για τη γραμμή ενοτήτων.
 *
 * Πέντε ελληνικές λέξεις σε πλάτος 320px στριμώχνονται μέχρι να γίνουν
 * δυσανάγνωστες. Ένα σχήμα από πάνω αναγνωρίζεται πριν διαβαστεί η λέξη, και
 * αντέχει και την εναλλαγή γλώσσας, όπου τα μήκη αλλάζουν.
 *
 * Γραμμικά, ένα βάρος, καμία γέμιση: ακολουθούν το ίδιο ύφος με την υπόλοιπη
 * διεπαφή. Είναι διακοσμητικά — η ετικέτα από κάτω είναι το προσβάσιμο όνομα.
 */

const common = {
  width: 20,
  height: 20,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.6,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  'aria-hidden': true,
  focusable: false,
}

/** Μετρητής: ρολόι. */
function Clock() {
  return (
    <svg {...common}>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 7.5V12l3 1.8" />
    </svg>
  )
}

/** Άδειες: πύλη ανοιχτή προς τα έξω. */
function Leave() {
  return (
    <svg {...common}>
      <path d="M13.5 4H6a1 1 0 0 0-1 1v14a1 1 0 0 0 1 1h7.5" />
      <path d="M10.5 12H19" />
      <path d="M16 9l3 3-3 3" />
    </svg>
  )
}

/** Υπηρεσίες: ασπίδα σκοπιάς. */
function Duty() {
  return (
    <svg {...common}>
      <path d="M12 3.5l6.5 2.4v5.3c0 4-2.7 7.4-6.5 8.8-3.8-1.4-6.5-4.8-6.5-8.8V5.9L12 3.5z" />
      <path d="M9.5 12l1.8 1.8 3.4-3.6" />
    </svg>
  )
}

/** Ταμείο: πορτοφόλι. */
function Money() {
  return (
    <svg {...common}>
      <path d="M4 8.5A1.5 1.5 0 0 1 5.5 7H18a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V8.5z" />
      <path d="M4 8.5V7a2 2 0 0 1 2-2h9" />
      <circle cx="16.2" cy="12.5" r="1.1" />
    </svg>
  )
}

/** Προφίλ: σήμα με προτομή. */
function Profile() {
  return (
    <svg {...common}>
      <circle cx="12" cy="9" r="3.2" />
      <path d="M5.5 19.5a6.5 6.5 0 0 1 13 0" />
    </svg>
  )
}

export const TAB_ICONS = {
  clock: Clock,
  leave: Leave,
  duty: Duty,
  money: Money,
  profile: Profile,
}
