import { useState } from 'react'
import type { DutyKind, Profile } from '../lib/types'
import type { ServiceState } from '../lib/service'
import { DEFAULT_HOURS, DUTY_KINDS, computeDuties, newDuty } from '../lib/duty'
import { withDeletion } from '../lib/merge'
import { formatShort, parseISO, toISO, today } from '../lib/dates'
import { DateField } from './DateField'
import { useI18n } from '../hooks/useI18n'
import { useToast } from '../hooks/useToast'
import { upperGreek as caps } from '../lib/greek'

export function Duty({
  profile, service, update,
}: {
  profile: Profile
  service: ServiceState
  update: (patch: Partial<Profile>) => void
}) {
  const { t, lang } = useI18n()
  const toast = useToast()
  const d = computeDuties(profile.duties, service.monthsServed, service.now)

  // Στα ελληνικά το δεκαδικό χωρίζεται με κόμμα, όχι με τελεία.
  const decimal = (n: number) =>
    new Intl.NumberFormat(lang === 'el' ? 'el-GR' : 'en-IE', {
      maximumFractionDigits: 1,
    }).format(n)

  const [kind, setKind] = useState<DutyKind>('guard')
  const [date, setDate] = useState(toISO(today()))
  const [start, setStart] = useState('')
  const [hours, setHours] = useState(String(DEFAULT_HOURS.guard))
  const [note, setNote] = useState('')

  // Αλλάζοντας είδος, η διάρκεια ακολουθεί την τυπική του — εκτός αν την
  // πείραξε ήδη ο χρήστης.
  const pickKind = (k: DutyKind) => {
    if (hours === String(DEFAULT_HOURS[kind])) setHours(String(DEFAULT_HOURS[k]))
    setKind(k)
  }

  const add = () => {
    if (!date) return toast.error(t.duty.errDate)
    const h = Number(hours.replace(',', '.'))
    if (!Number.isFinite(h) || h < 0 || h > 24) return toast.error(t.duty.errHours)
    update({ duties: [...profile.duties, newDuty(kind, date, h, start, note)] })
    setNote('')
    toast.success(t.duty.okAdded)
  }

  const remove = (id: string) => {
    update(withDeletion(profile, id))
    toast.success(t.duty.okDeleted)
  }

  const row = (id: string, k: DutyKind, dateISO: string, startAt: string | undefined, h: number, n: string | undefined, live: boolean) => (
    <li key={id} className="panel mn__item">
      <div className="mn__itext">
        <p className="mn__icat">
          {t.duty.kinds[k]}
          {live && <span className="tag tag--live">{t.duty.today}</span>}
        </p>
        <p className="mn__imeta">
          <span className="num">{formatShort(parseISO(dateISO))}</span>
          {startAt && <> · <span className="num">{t.duty.at(startAt)}</span></>}
          {n && <> · {n}</>}
        </p>
      </div>
      <span className="mn__iamt num">{decimal(h)}h</span>
      <button className="mn__idel" onClick={() => remove(id)}
              aria-label={`${t.duty.delete}: ${t.duty.kinds[k]}`}>×</button>
    </li>
  )

  const todayISO = toISO(service.now)

  return (
    <>
      <section className={`clock ${d.next && d.daysToNext === 0 ? 'clock--signal' : ''}`}>
        <p className="eyebrow">{caps(t.duty.next)}</p>
        {d.next ? (
          <>
            <div className="clock__figure">
              <span className="clock__num num">{d.daysToNext}</span>
            </div>
            <p className="clock__sub">
              {t.duty.kinds[d.next.kind]} · {t.duty.inDays(d.daysToNext)}
              {d.next.start && <> · {t.duty.at(d.next.start)}</>}
            </p>
          </>
        ) : (
          <p className="clock__sub clock__sub--empty">{t.duty.none}</p>
        )}
      </section>

      <section className="band">
        <p className="eyebrow band__label">{caps(t.duty.label)}</p>
        <div className="tiles">
          <div className="tile">
            <p className="eyebrow">{caps(t.duty.total)}</p>
            <p className="tile__value num">{d.total}</p>
          </div>
          <div className="tile">
            <p className="eyebrow">{caps(t.duty.hoursLabel)}</p>
            <p className="tile__value num">{d.totalHours}</p>
          </div>
          <div className="tile">
            <p className="eyebrow">{caps(t.duty.perMonth)}</p>
            <p className="tile__value num">{decimal(d.perMonth)}</p>
          </div>
          <div className="tile">
            <p className="eyebrow">{caps(t.duty.past)}</p>
            <p className="tile__value num">{d.done}</p>
          </div>
        </div>
      </section>

      <section className="band">
        <p className="eyebrow band__label">{caps(t.duty.addTitle)}</p>
        <div className="panel mn__add">
          <label className="mn__f">
            <span className="eyebrow">{caps(t.duty.kind)}</span>
            <select className="input" value={kind}
                    onChange={(e) => pickKind(e.target.value as DutyKind)}>
              {DUTY_KINDS.map((k) => (
                <option key={k} value={k}>{t.duty.kinds[k]}</option>
              ))}
            </select>
          </label>
          <div className="mn__addrow">
            <div className="mn__f">
              <span className="eyebrow">{caps(t.duty.date)}</span>
              <DateField label={t.duty.date} value={date} onChange={setDate} />
            </div>
            <label className="mn__f">
              <span className="eyebrow">{caps(t.duty.start)}</span>
              <input className="input" type="time" value={start}
                     onChange={(e) => setStart(e.target.value)} />
            </label>
          </div>
          <div className="mn__addrow">
            <label className="mn__f">
              <span className="eyebrow">{caps(t.duty.hours)}</span>
              <input className="input" type="text" inputMode="decimal" value={hours}
                     onChange={(e) => setHours(e.target.value)} />
            </label>
            <label className="mn__f">
              <span className="eyebrow">{caps(t.duty.note)}</span>
              <input className="input" type="text" placeholder={t.duty.notePlaceholder}
                     value={note} onChange={(e) => setNote(e.target.value)}
                     onKeyDown={(e) => e.key === 'Enter' && add()} />
            </label>
          </div>
          <button className="btn btn--primary btn--block" onClick={add}>{t.duty.add}</button>
        </div>
      </section>

      {d.byKind.length > 0 && (
        <section className="band">
          <p className="eyebrow band__label">{caps(t.duty.breakdown)}</p>
          <div className="panel mn__cats">
            {d.byKind.map((c) => (
              <div key={c.kind} className="mn__cat">
                <div className="mn__catrow">
                  <span>{t.duty.kinds[c.kind]}</span>
                  <strong className="num">{c.count} · {t.duty.countHours(c.hours)}</strong>
                </div>
                <div className="progress__track">
                  <div className="progress__fill"
                       style={{ width: `${d.total > 0 ? Math.round((c.count / d.total) * 100) : 0}%` }} />
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {d.upcoming.length > 0 && (
        <section className="band">
          <p className="eyebrow band__label">{caps(t.duty.upcoming)}</p>
          <ul className="mn__list">
            {d.upcoming.map((x) => row(x.id, x.kind, x.date, x.start, x.hours, x.note, x.date === todayISO))}
          </ul>
        </section>
      )}

      <section className="band">
        <p className="eyebrow band__label">{caps(t.duty.past)}</p>
        {d.past.length === 0 ? (
          <div className="panel"><p className="mn__empty">{t.duty.empty}</p></div>
        ) : (
          <ul className="mn__list">
            {d.past.slice(0, 30).map((x) => row(x.id, x.kind, x.date, x.start, x.hours, x.note, false))}
          </ul>
        )}
      </section>
    </>
  )
}
