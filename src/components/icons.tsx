/**
 * Icons for the tab bar.
 *
 * Five Greek words at 320px squeeze together until they cannot be read. A
 * shape above the label is recognised before the word is, and it survives the
 * language switch, where the lengths change.
 *
 * Line only, one weight, no fill: the same idiom as the rest of the interface.
 * They are decorative — the label beneath is the accessible name.
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

/** Counter: a clock. */
function Clock() {
  return (
    <svg {...common}>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 7.5V12l3 1.8" />
    </svg>
  )
}

/** Leave: a gate opening outwards. */
function Leave() {
  return (
    <svg {...common}>
      <path d="M13.5 4H6a1 1 0 0 0-1 1v14a1 1 0 0 0 1 1h7.5" />
      <path d="M10.5 12H19" />
      <path d="M16 9l3 3-3 3" />
    </svg>
  )
}

/** Duties: a sentry's shield. */
function Duty() {
  return (
    <svg {...common}>
      <path d="M12 3.5l6.5 2.4v5.3c0 4-2.7 7.4-6.5 8.8-3.8-1.4-6.5-4.8-6.5-8.8V5.9L12 3.5z" />
      <path d="M9.5 12l1.8 1.8 3.4-3.6" />
    </svg>
  )
}

/** Money: a wallet. */
function Money() {
  return (
    <svg {...common}>
      <path d="M4 8.5A1.5 1.5 0 0 1 5.5 7H18a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V8.5z" />
      <path d="M4 8.5V7a2 2 0 0 1 2-2h9" />
      <circle cx="16.2" cy="12.5" r="1.1" />
    </svg>
  )
}

/** Profile: a figure on a badge. */
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
