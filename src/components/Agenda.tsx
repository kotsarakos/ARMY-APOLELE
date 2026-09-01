import { useMemo, useState } from 'react'
import type { Profile } from '../lib/types'
import type { ServiceState } from '../lib/service'
import type { AgendaDay, AgendaEvent } from '../lib/agenda'
import { kindsPresent, monthAgenda, sortEvents } from '../lib/agenda'
import { weekHeader } from '../lib/calendar'
import { addMonths, formatDate, toISO } from '../lib/dates'
import { formatMoney } from '../lib/money'
import { useI18n } from '../hooks/useI18n'
import { upperGreek as caps } from '../lib/greek'
import { tap } from '../lib/haptics'

/**
 * The month, with everything on it.
 *
 * Leave, duties and spending sat in three tabs while the question is one:
 * "what have I got in October". Each day shows up to three dots; tapping it
 * opens that day's full list below, so the grid stays readable and the cells
 * stay above 44px.
 */
export function Agenda({ profile, state }: { profile: Profile; state: ServiceState }) {
  const { t, lang } = useI18n()
  const [view, setView] = useState<Date>(state.now)
  const [picked, setPicked] = useState<string | null>(null)

  const days = useMemo(
    () => monthAgenda(profile, state, view.getFullYear(), view.getMonth()),
    [profile, state, view],
  )
  const headers = useMemo(() => weekHeader(t.weekdaysShort), [t])
  const legend = kindsPresent(days)

  const selected = picked ? days.find((d) => d.iso === picked) ?? null : null
  const thisMonth = toISO(state.now).slice(0, 7) === toISO(view).slice(0, 7)

  const go = (delta: number) => {
    setView(addMonths(view, delta))
    setPicked(null)
    tap()
  }

  return (
    <section className="band">
      <p className="eyebrow band__label">{caps(t.agenda.label)}</p>

      <div className="panel ag">
        <div className="ag__head">
          <button type="button" className="cal__nav" onClick={() => go(-1)}
                  aria-label={t.agenda.prev}>‹</button>
          <p className="ag__month">
            {t.monthsAlone[view.getMonth()]} <span className="num">{view.getFullYear()}</span>
          </p>
          <button type="button" className="cal__nav" onClick={() => go(1)}
                  aria-label={t.agenda.next}>›</button>
        </div>

        <div className="cal__week" aria-hidden="true">
          {headers.map((w, i) => <span key={i}>{caps(w)}</span>)}
        </div>

        <div className="ag__grid">
          {days.map((d) => (
            <Cell
              key={d.iso}
              day={d}
              selected={d.iso === picked}
              label={formatDate(d.date, t, true)}
              onPick={() => { setPicked(d.iso === picked ? null : d.iso); tap() }}
            />
          ))}
        </div>

        {!thisMonth && (
          <div className="ag__back">
            <button type="button" className="btn btn--ghost btn--sm"
                    onClick={() => { setView(state.now); setPicked(null) }}>
              {t.agenda.thisMonth}
            </button>
          </div>
        )}

        {legend.length > 0 ? (
          <ul className="ag__legend">
            {legend.map((k) => (
              <li key={k}>
                <span className={`ag__dot ag__dot--${k}`} aria-hidden="true" />
                {t.agenda.kinds[k]}
              </li>
            ))}
          </ul>
        ) : (
          <p className="mn__empty">{t.agenda.empty}</p>
        )}

        {selected && (
          <div className="ag__day">
            <p className="eyebrow">{caps(formatDate(selected.date, t, true))}</p>
            {selected.events.length === 0 ? (
              <p className="mn__empty">{t.agenda.dayEmpty}</p>
            ) : (
              <ul className="ag__list">
                {sortEvents(selected.events).map((e, i) => (
                  <li key={i}>
                    <span className={`ag__dot ag__dot--${e.kind}`} aria-hidden="true" />
                    <span className="ag__etext">{describe(e, t, lang)}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>
    </section>
  )
}

/** At most three dots per day — more than that is a smudge at 44px. */
function Cell({ day, selected, label, onPick }: {
  day: AgendaDay
  selected: boolean
  label: string
  onPick: () => void
}) {
  const dots = sortEvents(day.events).slice(0, 3)

  return (
    <button
      type="button"
      data-day={day.iso}
      className={[
        'ag__cell',
        day.inMonth ? '' : 'ag__cell--out',
        day.today ? 'ag__cell--today' : '',
        selected ? 'ag__cell--on' : '',
        day.inService ? '' : 'ag__cell--off',
      ].filter(Boolean).join(' ')}
      aria-pressed={selected}
      aria-current={day.today ? 'date' : undefined}
      aria-label={`${label}${day.events.length ? ` · ${day.events.length}` : ''}`}
      onClick={onPick}
    >
      <span className="ag__n num">{day.date.getDate()}</span>
      <span className="ag__dots" aria-hidden="true">
        {dots.map((e, i) => <i key={i} className={`ag__dot ag__dot--${e.kind}`} />)}
      </span>
    </button>
  )
}

type Dict = ReturnType<typeof useI18n>['t']

/** Translation happens here: agenda.ts returns keys only. */
function describe(e: AgendaEvent, t: Dict, lang: 'el' | 'en'): string {
  switch (e.kind) {
    case 'leave':
      return `${t.agenda.kinds.leave}: ${t.leave.kinds[e.ref as keyof typeof t.leave.kinds]}`
    case 'duty': {
      const name = t.duty.kinds[e.ref as keyof typeof t.duty.kinds]
      return e.at ? `${name} · ${t.duty.at(e.at)}` : name
    }
    case 'pay':
      return `${t.agenda.kinds.pay} · ${e.amount}€`
    case 'accrual':
      return t.agenda.accrualDays(e.amount ?? 3)
    case 'milestone':
      return t.milestones.items[e.ref as keyof typeof t.milestones.items].label
    case 'spend':
      return `${t.agenda.kinds.spend} · ${formatMoney(e.amount ?? 0, lang)}`
  }
}
