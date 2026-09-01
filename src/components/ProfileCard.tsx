import { useState } from 'react'
import type { Profile } from '../lib/types'
import type { ServiceState } from '../lib/service'
import { tierFor } from '../lib/ranks'
import { formatDate, formatShort, parseISO, toISO } from '../lib/dates'
import { currentPosting, newPosting, postingSpans } from '../lib/postings'
import { deletion } from '../lib/merge'
import { ALL_ESSO, essoLabel } from '../lib/esso'
import { DateField } from './DateField'
import { upperGreek as caps } from '../lib/greek'
import { useI18n } from '../hooks/useI18n'
import { useToast } from '../hooks/useToast'

/** Initials for the badge — two letters at most. */
function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (!parts.length) return '—'
  return parts.slice(0, 2).map((p) => p[0]).join('').toUpperCase()
}

export function ProfileCard({
  profile, service, update, updateWith,
}: {
  profile: Profile
  service: ServiceState
  update: (patch: Partial<Profile>) => void
  updateWith: (build: (prev: Profile) => Partial<Profile>) => void
}) {
  const { t } = useI18n()
  const toast = useToast()
  const tier = tierFor(service)

  // The intake is found from the enlistment date, when it matches a known one.
  const esso = ALL_ESSO.find((e) => e.from === profile.enlistDate)
  const pct = Math.round(service.progress * 100)

  const spans = postingSpans(profile.postings, service.now)
  const here = currentPosting(profile.postings, service.now)

  const [open, setOpen] = useState(false)
  const [unit, setUnit] = useState('')
  const [since, setSince] = useState(toISO(service.now))
  const [pnote, setPnote] = useState('')

  const addPosting = () => {
    if (!unit.trim()) return toast.error(t.profile.errPostingUnit)
    const entry = newPosting(unit, since, pnote)
    // The unit shown in the bar follows the most recent posting that has
    // already begun — otherwise it would still read the training centre.
    const next = currentPosting([...(profile.postings ?? []), entry], service.now)
    update({
      postings: [...(profile.postings ?? []), entry],
      unit: next?.unit ?? profile.unit,
    })
    setUnit(''); setPnote(''); setOpen(false)
    toast.success(t.profile.okPostingAdded)
  }

  const removePosting = (id: string) => {
    const del = deletion(profile, [id])
    const left = (profile.postings ?? []).filter((p) => p.id !== id)
    update({ ...del.patch, unit: currentPosting(left, service.now)?.unit ?? '' })
    toast.undoable(t.profile.okPostingDeleted, t.common.undo, () => updateWith((prev) => {
      const restored = del.restore(prev)
      const list = restored.postings ?? prev.postings
      return { ...restored, unit: currentPosting(list, service.now)?.unit ?? prev.unit }
    }))
  }

  const rows: Array<[string, string]> = [
    [t.profile.enlisted, formatDate(service.enlist, t)],
    [t.profile.discharge, formatDate(service.discharge, t)],
    [t.profile.duration, t.settings.months(profile.months)],
    [t.profile.border, profile.borderUnit ? t.profile.yes : t.profile.no],
  ]
  if (esso) rows.unshift([t.profile.esso, essoLabel(esso, t)])

  return (
    <>
      <section className="band">
        <p className="eyebrow band__label">{caps(t.profile.label)}</p>

        <div className="panel pf">
          <div className="pf__head">
            <span className="pf__badge num">{initials(profile.name)}</span>
            <div className="pf__id">
              <p className="pf__name">{profile.name || t.profile.noName}</p>
              <p className="pf__tier">
                <span className={`badge ${tier.accent === 'signal' ? 'badge--signal' : ''}`}>
                  {t.tiers[tier.key].title}
                </span>
                {here?.unit && <span className="pf__unit">{here.unit}</span>}
              </p>
            </div>
          </div>

          <div className="pf__prog">
            <div className="pf__progmeta">
              <span className="eyebrow">{caps(t.profile.served)}</span>
              <span className="num">{service.daysServed} / {service.totalDays} · {pct}%</span>
            </div>
            <div className="progress__track">
              <div className="progress__fill" style={{ width: `${pct}%` }} />
            </div>
          </div>

          <dl className="pf__rows">
            {rows.map(([k, v]) => (
              <div key={k} className="pf__row">
                <dt>{k}</dt>
                <dd className="num">{v}</dd>
              </div>
            ))}
          </dl>

          <div className="pf__edit">
            <label className="mn__f">
              <span className="eyebrow">{caps(t.profile.editName)}</span>
              <input
                className="input" type="text" autoComplete="given-name"
                placeholder={t.profile.namePlaceholder}
                value={profile.name}
                onChange={(e) => update({ name: e.target.value })}
                onBlur={() => toast.success(t.profile.okSaved)}
              />
            </label>
          </div>
        </div>
      </section>

      {/* Where they served — a bare `unit` lost the training centre on the first transfer. */}
      <section className="band">
        <p className="eyebrow band__label">{caps(t.profile.postingsTitle)}</p>
        <div className="panel ps">
          <p className="mn__starthint">{t.profile.postingsHint}</p>

          {spans.length === 0 ? (
            <p className="mn__empty">{t.profile.postingsEmpty}</p>
          ) : (
            <ol className="ps__list">
              {spans.map((s) => (
                <li key={s.posting.id} className={`ps__item ${s.current ? 'ps__item--now' : ''}`}>
                  <span className="ps__dot" aria-hidden="true" />
                  <div className="ps__body">
                    <p className="ps__unit">
                      {s.posting.unit}
                      {s.current && <span className="tag tag--live">{t.profile.postingCurrent}</span>}
                    </p>
                    <p className="ps__meta num">
                      {s.until
                        ? t.profile.postingRange(
                            formatShort(parseISO(s.posting.from)),
                            formatShort(parseISO(s.until)),
                          )
                        : t.profile.postingSince(formatShort(parseISO(s.posting.from)))}
                      {' · '}
                      {s.days > 0 ? t.profile.postingDays(s.days) : t.profile.postingSoon}
                      {s.posting.note && <span className="ps__note"> · {s.posting.note}</span>}
                    </p>
                  </div>
                  <button className="mn__idel" onClick={() => removePosting(s.posting.id)}
                          aria-label={`${t.leave.delete}: ${s.posting.unit}`}>×</button>
                </li>
              ))}
            </ol>
          )}

          {open ? (
            <div className="mn__recform">
              <label className="mn__f">
                <span className="eyebrow">{caps(t.profile.postingUnit)}</span>
                <input className="input" type="text" value={unit}
                       placeholder={t.profile.unitPlaceholder}
                       onChange={(e) => setUnit(e.target.value)}
                       onKeyDown={(e) => e.key === 'Enter' && addPosting()} />
              </label>
              <div className="mn__addrow">
                <div className="mn__f">
                  <span className="eyebrow">{caps(t.profile.postingFrom)}</span>
                  <DateField label={t.profile.postingFrom} value={since} onChange={setSince} />
                </div>
                <label className="mn__f">
                  <span className="eyebrow">{caps(t.profile.postingNote)}</span>
                  <input className="input" type="text" value={pnote}
                         placeholder={t.profile.postingNotePlaceholder}
                         onChange={(e) => setPnote(e.target.value)}
                         onKeyDown={(e) => e.key === 'Enter' && addPosting()} />
                </label>
              </div>
              <div className="mn__recbtns">
                <button className="btn btn--primary btn--sm" onClick={addPosting}>
                  {t.money.add}
                </button>
                <button className="btn btn--ghost btn--sm" onClick={() => setOpen(false)}>
                  {t.common.cancel}
                </button>
              </div>
            </div>
          ) : (
            <button className="btn btn--secondary btn--sm" onClick={() => setOpen(true)}>
              {t.profile.postingAdd}
            </button>
          )}
        </div>
      </section>
    </>
  )
}
