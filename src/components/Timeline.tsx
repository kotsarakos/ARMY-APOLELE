import type { Milestone, ServiceState } from '../lib/service'
import { formatDate } from '../lib/dates'
import { useI18n } from '../hooks/useI18n'
import { upperGreek as caps } from '../lib/greek'

/**
 * The service timeline — progress and milestones as one thing.
 *
 * They were two sections saying the same thing: a bar with a percentage, and a
 * list of dates below it. The bar did not say *what* was coming; the list did
 * not say *where* you were.
 *
 * Positions are not proportional to time. That was tried, and does not work:
 * the oath (day 21) and first leave (day 24) are less than 1% of the term
 * apart, so their labels would land on top of each other. Instead the rows are
 * evenly spaced and "now" gets a row of its own, slotted into the right place
 * chronologically.
 */
export function Timeline({
  items, months, state,
}: {
  items: Milestone[]
  months: number
  state: ServiceState
}) {
  const { t } = useI18n()
  const pct = Math.round(state.progress * 100)

  // How many milestones have passed — that is where the "today" row goes.
  const passed = items.filter((m) => m.done).length
  const showNow = state.hasEnlisted && !state.isDischarged

  return (
    <section className="band">
      <p className="eyebrow band__label">{caps(t.milestones.label)}</p>

      <div className="tl">
        <div className="tl__meta">
          <span className="eyebrow">{caps(t.clock.progress)}</span>
          <span className="tl__pct num">{pct}%</span>
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
        <p className="tl__counts num">
          {t.milestones.served(state.daysServed, state.totalDays)}
          {' · '}
          {t.milestones.left(state.daysLeft)}
        </p>

        <ol className="ms">
          {items.map((m, i) => (
            <li key={m.key}>
              {showNow && i === passed && <NowRow state={state} />}
              <Row m={m} months={months} />
            </li>
          ))}
          {/* When every milestone has passed, "now" goes at the end. */}
          {showNow && passed === items.length && (
            <li><NowRow state={state} /></li>
          )}
        </ol>
      </div>
    </section>
  )
}

function NowRow({ state }: { state: ServiceState }) {
  const { t } = useI18n()
  return (
    <div className="ms__item ms__item--now">
      <span className="ms__dot ms__dot--now" aria-hidden="true" />
      <div className="ms__body">
        <div className="ms__line">
          <span className="ms__label">{t.milestones.youAreHere}</span>
          <span className="ms__when num">{formatDate(state.now, t)}</span>
        </div>
      </div>
    </div>
  )
}

function Row({ m, months }: { m: Milestone; months: number }) {
  const { t } = useI18n()
  const entry = t.milestones.items[m.key]
  const detail = typeof entry.detail === 'function' ? entry.detail(months) : entry.detail
  const when = m.done
    ? t.milestones.done
    : m.daysAway === 0
      ? t.milestones.today
      : t.milestones.inDays(m.daysAway)

  return (
    <div className={`ms__item ${m.done ? 'ms__item--done' : ''}`}>
      <span className="ms__dot" aria-hidden="true" />
      <div className="ms__body">
        <div className="ms__line">
          <span className="ms__label">{entry.label}</span>
          <span className="ms__when num">{when}</span>
        </div>
        <p className="ms__detail">
          {detail} · <span className="num">{formatDate(m.date, t)}</span>
        </p>
      </div>
    </div>
  )
}
