import { useMemo, useState } from 'react'
import type { ServiceState } from '../lib/service'
import {
  BLOOD_LEAVE_DAYS, MAX_BLOOD_DONATIONS, leaveForecast, whenAvailable,
} from '../lib/service'
import type { LeaveKind, Profile } from '../lib/types'
import {
  LEAVE_KINDS, SICK_LEAVE_FREE_DAYS, leaveDays, leaveTimeline, newLeave,
  sickDays, sortLeaves, validateLeave,
} from '../lib/leave'
import { deletion } from '../lib/merge'
import { formatDate, formatShort, parseISO, toISO, today } from '../lib/dates'
import { focusSection } from '../lib/scroll'
import { DateField } from './DateField'
import { useI18n } from '../hooks/useI18n'
import { useToast } from '../hooks/useToast'
import { upperGreek as caps } from '../lib/greek'

/** How close is "close": three days, about the length of a weekend out. */
const SOON_DAYS = 3

export function Leave({
  state, profile, update, updateWith,
}: {
  state: ServiceState
  profile: Profile
  update: (patch: Partial<Profile>) => void
  updateWith: (build: (prev: Profile) => Partial<Profile>) => void
}) {
  const { t } = useI18n()
  const toast = useToast()
  const { leave } = state
  const tl = leaveTimeline(profile.leaves, state.now)

  const iso = toISO(today())
  const [kind, setKind] = useState<LeaveKind>('regular')
  const [from, setFrom] = useState(iso)
  const [to, setTo] = useState(iso)
  const [note, setNote] = useState('')
  const [want, setWant] = useState(3)

  const forecast = useMemo(() => leaveForecast(profile, state), [profile, state])
  const answer = whenAvailable(state, forecast, want)

  const usedPct = leave.totalEntitlement > 0
    ? Math.min(100, Math.round((leave.committed / leave.totalEntitlement) * 100))
    : 0

  const sick = sickDays(profile.leaves)
  const soon = tl.next !== null && tl.daysToNext <= SOON_DAYS

  const addLeave = () => {
    if (!from || !to) return toast.error(t.leave.errDates)
    const entry = newLeave(kind, from, to, note)
    const problem = validateLeave(entry, profile.leaves)
    if (problem) {
      const msg = { range: t.leave.errRange, overlap: t.leave.errOverlap, tooLong: t.leave.errTooLong }
      return toast.error(msg[problem])
    }
    update({ leaves: [...profile.leaves, entry] })
    setNote('')
    toast.success(t.leave.okAdded)
  }

  const removeLeave = (id: string) => {
    const del = deletion(profile, [id])
    update(del.patch)
    toast.undoable(t.leave.okDeleted, t.common.undo, () => updateWith(del.restore))
  }

  const changeBlood = (delta: number) => {
    const next = profile.bloodDonations + delta
    if (next < 0) return toast.error(t.leave.errNegative)
    if (next > MAX_BLOOD_DONATIONS) return toast.error(t.leave.errMaxBlood)
    update({ bloodDonations: next })
    if (delta > 0) toast.success(t.leave.okBlood)
  }

  return (
    <>
      {/* The question conscripts actually ask: when am I out again. */}
      <section className={`clock ${tl.current ? 'clock--olive' : soon ? 'clock--signal' : ''}`}>
        <p className="eyebrow">
          {caps(tl.current ? t.leave.onLeaveTitle : t.leave.nextTitle)}
        </p>
        {tl.current ? (
          <>
            <div className="clock__figure">
              <span className="clock__num num">{tl.daysLeftOfCurrent}</span>
            </div>
            <p className="clock__sub">{t.leave.onLeaveBody(tl.daysLeftOfCurrent)}</p>
          </>
        ) : tl.next ? (
          <>
            <div className="clock__figure">
              <span className="clock__num num">{tl.daysToNext}</span>
            </div>
            <p className="clock__sub">
              {t.leave.kinds[tl.next.kind]} · {formatShort(parseISO(tl.next.from))} ·{' '}
              {t.leave.days(leaveDays(tl.next))}
            </p>
          </>
        ) : (
          <p className="clock__sub clock__sub--empty">{t.leave.noNext}</p>
        )}
      </section>

      <section className="band">
        <p className="eyebrow band__label">{caps(t.leave.label)}</p>

        <div className="panel">
          <div className="leave__head">
            <div>
              <p className="leave__big num">{leave.available}</p>
              <p className="eyebrow">{caps(t.leave.availableNow)}</p>
            </div>
            <div className="leave__side">
              <p className="leave__row">
                <span>{t.leave.earned}</span><strong className="num">{leave.earned}</strong>
              </p>
              <p className="leave__row">
                <span>{t.leave.taken}</span><strong className="num">{leave.taken}</strong>
              </p>
              {leave.planned > 0 && (
                <p className="leave__row">
                  <span>{t.leave.planned}</span>
                  <strong className="num">{leave.planned}</strong>
                </p>
              )}
              <p className="leave__row">
                <span>{t.leave.upcoming}</span><strong className="num">{leave.upcoming}</strong>
              </p>
              {leave.otherTaken > 0 && (
                <p className="leave__row">
                  <span>{t.leave.otherTaken}</span>
                  <strong className="num">{leave.otherTaken}</strong>
                </p>
              )}
              {leave.bonusHonorary > 0 && (
                <p className="leave__row">
                  <span>{t.leave.honorary}</span>
                  <strong className="num">+{leave.bonusHonorary}</strong>
                </p>
              )}
            </div>
          </div>

          <div className="progress__track" role="presentation">
            <div className="progress__fill progress__fill--signal" style={{ width: `${usedPct}%` }} />
          </div>

          <p className="leave__note">
            {t.leave.rule(leave.totalEntitlement, leave.cap)}
            {leave.daysToNextAccrual > 0 && <> {t.leave.nextAccrual(leave.daysToNextAccrual)}</>}
            {leave.planned > 0 && <> {t.leave.plannedHint(leave.planned)}</>}
          </p>

          <div className="stepper">
            <span className="eyebrow">{caps(t.leave.bloodLabel)}</span>
            <div className="stepper__row">
              <button className="btn btn--ghost" onClick={() => changeBlood(-1)}
                      aria-label={`${t.leave.decrease}: ${t.leave.bloodLabel}`}>−</button>
              <span className="stepper__val num">{profile.bloodDonations}</span>
              <button className="btn btn--ghost" onClick={() => changeBlood(1)}
                      aria-label={`${t.leave.increase}: ${t.leave.bloodLabel}`}>+</button>
            </div>
            <p className="stepper__hint">
              {t.leave.bloodHint(BLOOD_LEAVE_DAYS, MAX_BLOOD_DONATIONS)}
            </p>
          </div>
        </div>
      </section>

      {/* "I want five days in October — do I have them?" */}
      <section className="band">
        <p className="eyebrow band__label">{caps(t.leave.forecastTitle)}</p>
        <div className="panel fc">
          <p className="fc__hint">{t.leave.forecastHint}</p>

          <div className="fc__ask">
            <span className="eyebrow">{caps(t.leave.forecastWant)}</span>
            <div className="stepper__row">
              <button className="btn btn--ghost" onClick={() => setWant(Math.max(1, want - 1))}
                      aria-label={`${t.leave.decrease}: ${t.leave.forecastWant}`}>−</button>
              <span className="stepper__val num">{want}</span>
              <button className="btn btn--ghost"
                      onClick={() => setWant(Math.min(leave.cap, want + 1))}
                      aria-label={`${t.leave.increase}: ${t.leave.forecastWant}`}>+</button>
            </div>
          </div>

          <p className={`fc__answer ${answer.date ? '' : 'fc__answer--no'}`} aria-live="polite">
            {answer.already
              ? t.leave.forecastAlready(leave.available)
              : answer.date
                ? t.leave.forecastOn(formatDate(answer.date, t), answer.daysAway)
                : t.leave.forecastNever}
          </p>

          {forecast.length > 0 && (
            <>
              <p className="eyebrow fc__next">{caps(t.leave.forecastNext)}</p>
              <ul className="fc__list">
                {forecast.slice(0, 4).map((p) => (
                  <li key={p.date.toISOString()}>
                    <span className="num">{formatShort(p.date)}</span>
                    <span className="fc__credit num">{t.leave.forecastCredit(p.credit)}</span>
                    <span className="fc__total num">{p.available}</span>
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      </section>

      {/* Sick leave is the only kind that can move the discharge date. */}
      {sick > 0 && (
        <section className="band">
          <p className="eyebrow band__label">{caps(t.leave.sickTitle)}</p>
          <div className={`panel sk ${state.sickExtension > 0 ? 'sk--over' : ''}`}>
            <p className="sk__body">{t.leave.sickBody(sick, SICK_LEAVE_FREE_DAYS)}</p>
            {state.sickExtension > 0 && (
              <p className="sk__warn">
                {t.leave.sickExtends(state.sickExtension)}{' '}
                <span className="num">{formatShort(state.baseDischarge)}</span>
                {' → '}
                <strong className="num">{formatShort(state.discharge)}</strong>
              </p>
            )}
            <p className="sk__check">{t.leave.sickCheck}</p>
          </div>
        </section>
      )}

      {/* Recording leave — the day count comes from the dates. */}
      <section className="band" id="add-leave">
        <p className="eyebrow band__label">{caps(t.leave.addTitle)}</p>
        <div className="panel mn__add">
          <label className="mn__f">
            <span className="eyebrow">{caps(t.leave.kind)}</span>
            <select className="input" value={kind}
                    onChange={(e) => setKind(e.target.value as LeaveKind)}>
              {LEAVE_KINDS.map((k) => (
                <option key={k} value={k}>{t.leave.kinds[k]}</option>
              ))}
            </select>
          </label>
          <div className="mn__addrow">
            <div className="mn__f">
              <span className="eyebrow">{caps(t.leave.from)}</span>
              <DateField
                label={t.leave.from}
                value={from}
                onChange={(v) => { setFrom(v); if (v > to) setTo(v) }}
              />
            </div>
            <div className="mn__f">
              <span className="eyebrow">{caps(t.leave.to)}</span>
              {/* `min` makes a backwards range impossible rather than
                  rejecting it afterwards — fewer error messages. */}
              <DateField label={t.leave.to} value={to} min={from} onChange={setTo} />
            </div>
          </div>
          <label className="mn__f">
            <span className="eyebrow">{caps(t.leave.note)}</span>
            <input className="input" type="text" placeholder={t.leave.notePlaceholder}
                   value={note} onChange={(e) => setNote(e.target.value)}
                   onKeyDown={(e) => e.key === 'Enter' && addLeave()} />
          </label>
          <button className="btn btn--primary btn--block" onClick={addLeave}>
            {t.leave.add}
          </button>
        </div>
      </section>

      <section className="band">
        <p className="eyebrow band__label">{caps(t.leave.history)}</p>
        {profile.leaves.length === 0 ? (
          <div className="panel empty">
            <p className="empty__text">{t.leave.empty}</p>
            <button className="btn btn--secondary btn--sm"
                    onClick={() => focusSection('add-leave')}>
              {t.leave.emptyCta}
            </button>
          </div>
        ) : (
          <ul className="mn__list">
            {sortLeaves(profile.leaves).map((l) => (
              <li key={l.id} className="panel mn__item">
                <div className="mn__itext">
                  <p className="mn__icat">
                    {t.leave.kinds[l.kind]}
                    {tl.current?.id === l.id && <span className="tag tag--live">{t.leave.ongoing}</span>}
                  </p>
                  <p className="mn__imeta">
                    <span className="num">
                      {t.leave.range(formatShort(parseISO(l.from)), formatShort(parseISO(l.to)))}
                    </span>
                    {l.note && <> · {l.note}</>}
                  </p>
                </div>
                <span className="mn__iamt num">{t.leave.days(leaveDays(l))}</span>
                <button className="mn__idel" onClick={() => removeLeave(l.id)}
                        aria-label={`${t.leave.delete}: ${t.leave.kinds[l.kind]}`}>×</button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  )
}
