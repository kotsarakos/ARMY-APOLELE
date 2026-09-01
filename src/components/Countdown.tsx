import { useEffect, useState } from 'react'
import type { ServiceState } from '../lib/service'
import { tierFor } from '../lib/ranks'
import { formatDate } from '../lib/dates'
import { useI18n } from '../hooks/useI18n'
import { upperGreek as caps } from '../lib/greek'

/** Hours until the next midnight, rounded up. */
function hoursToMidnight(): number {
  const now = new Date()
  const midnight = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1)
  return Math.max(1, Math.ceil((midnight.getTime() - now.getTime()) / 3_600_000))
}

/** The mission clock: one number, enormous, undecorated. */
export function Countdown({ state, name }: { state: ServiceState; name: string }) {
  const { t } = useI18n()
  const tier = tierFor(state)

  // The last day in the army is the day before discharge, when the counter
  // reads "1" and sits there all day. It is the day the app gets opened ten
  // times, so it counts hours instead.
  const lastDay = state.hasEnlisted && !state.isDischarged && state.daysLeft === 1
  const [hours, setHours] = useState(hoursToMidnight)

  useEffect(() => {
    if (!lastDay) return
    const id = setInterval(() => setHours(hoursToMidnight()), 60_000)
    return () => clearInterval(id)
  }, [lastDay])

  const headline = state.isDischarged
    ? { eyebrow: t.clock.discharged, value: 0, unit: t.clock.days }
    : !state.hasEnlisted
      ? { eyebrow: t.clock.toEnlist, value: state.daysUntilEnlist, unit: t.clock.days }
      : lastDay
        ? { eyebrow: t.clock.lastDay, value: hours, unit: hours === 1 ? t.clock.hour : t.clock.hours }
        : { eyebrow: t.clock.toDischarge, value: state.daysLeft, unit: t.clock.days }

  const unit = !lastDay && headline.value === 1 ? t.clock.day : headline.unit

  return (
    <section className={`clock clock--${tier.accent} ${lastDay ? 'clock--last' : ''}`}>
      <div className="clock__top">
        <p className="eyebrow">{caps(headline.eyebrow)}</p>
        {name && <p className="clock__name">{caps(name)}</p>}
      </div>

      <div className="clock__figure">
        <span className="clock__num num">{headline.value}</span>
        <span className="clock__unit">{caps(unit)}</span>
      </div>

      <div className="clock__tier">
        <span className="badge">{t.tiers[tier.key].title}</span>
        <span className="clock__blurb">{t.tiers[tier.key].blurb}</span>
      </div>

      {lastDay && <p className="clock__note">{t.clock.lastDayHint}</p>}

      {/* Progress is not here: it lives on the timeline, beside the
          milestones that explain what the percentage means. Two bars for the
          same thing were simply the same information twice. */}

      {!state.hasEnlisted && (
        <p className="clock__note">
          {t.clock.enlistOn}: <strong>{formatDate(state.enlist, t, true)}</strong>
        </p>
      )}
    </section>
  )
}
