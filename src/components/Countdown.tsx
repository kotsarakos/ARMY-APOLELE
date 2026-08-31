import type { ServiceState } from '../lib/service'
import { tierFor } from '../lib/ranks'
import { formatDate } from '../lib/dates'
import { useI18n } from '../hooks/useI18n'
import { upperGreek as caps } from '../lib/greek'

/** Το ρολόι της αποστολής: ένας αριθμός, τεράστιος, χωρίς διακόσμηση. */
export function Countdown({ state, name }: { state: ServiceState; name: string }) {
  const { t } = useI18n()
  const tier = tierFor(state)
  const pct = Math.round(state.progress * 100)

  const headline = state.isDischarged
    ? { eyebrow: t.clock.discharged, value: 0 }
    : !state.hasEnlisted
      ? { eyebrow: t.clock.toEnlist, value: state.daysUntilEnlist }
      : { eyebrow: t.clock.toDischarge, value: state.daysLeft }
  const unit = headline.value === 1 ? t.clock.day : t.clock.days

  return (
    <section className={`clock clock--${tier.accent}`}>
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

      {state.hasEnlisted && (
        <div className="progress">
          <div className="progress__meta">
            <span className="eyebrow">{caps(t.clock.progress)}</span>
            <span className="progress__pct num">{pct}%</span>
          </div>
          <div
            className="progress__track"
            role="progressbar"
            aria-valuenow={pct}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label={t.clock.progress}
          >
            <div className="progress__fill" style={{ width: `${pct}%` }} />
          </div>
          <div className="progress__ends">
            <span className="num">{formatDate(state.enlist, t)}</span>
            <span className="num">{formatDate(state.discharge, t)}</span>
          </div>
        </div>
      )}

      {!state.hasEnlisted && (
        <p className="clock__note">
          {t.clock.enlistOn}: <strong>{formatDate(state.enlist, t, true)}</strong>
        </p>
      )}
    </section>
  )
}
