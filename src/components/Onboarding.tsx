import { useState } from 'react'
import type { Profile, ServiceMonths } from '../lib/types'
import { DEFAULT_PROFILE } from '../lib/types'
import { ALL_ESSO, essoLabel } from '../lib/esso'
import { formatShort, parseISO } from '../lib/dates'
import { useI18n } from '../hooks/useI18n'
import { useToast } from '../hooks/useToast'
import { DateField } from './DateField'
import { upperGreek as caps } from '../lib/greek'

const DURATIONS: Array<{ value: ServiceMonths; key: 'd12' | 'd9' | 'd6' | 'd3' }> = [
  { value: 12, key: 'd12' },
  { value: 9, key: 'd9' },
  { value: 6, key: 'd6' },
  { value: 3, key: 'd3' },
]

/** Only dates within a sensible range around today are accepted. */
function isPlausibleDate(iso: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return false
  const d = parseISO(iso)
  if (Number.isNaN(d.getTime())) return false
  const year = d.getFullYear()
  return year >= 1960 && year <= new Date().getFullYear() + 6
}

export function Onboarding({ onDone }: { onDone: (p: Profile) => void }) {
  const { t, lang } = useI18n()
  const toast = useToast()
  const [draft, setDraft] = useState<Profile>({ ...DEFAULT_PROFILE, lang })
  const set = (patch: Partial<Profile>) => setDraft((d) => ({ ...d, ...patch }))

  const submit = () => {
    if (!draft.enlistDate) {
      toast.error(t.onboard.errNoDate)
      return
    }
    if (!isPlausibleDate(draft.enlistDate)) {
      toast.error(t.onboard.errBadDate)
      return
    }
    onDone({ ...draft, lang })
    toast.success(t.onboard.okSaved)
  }

  return (
    <div className="onboard">
      <header className="onboard__head">
        <p className="eyebrow">{caps(t.onboard.eyebrow)}</p>
        <h1 className="onboard__title">{t.onboard.title}</h1>
        <p className="onboard__sub">{t.onboard.sub}</p>
      </header>

      <section className="panel field">
        <label className="eyebrow" htmlFor="name">{caps(t.onboard.nameLabel)}</label>
        <input
          id="name"
          className="input"
          type="text"
          autoComplete="given-name"
          placeholder={t.onboard.namePlaceholder}
          value={draft.name}
          onChange={(e) => set({ name: e.target.value })}
        />
      </section>

      <section className="panel field">
        <p className="eyebrow">{caps(t.onboard.essoLabel)}</p>
        <p className="field__hint">{t.onboard.essoHint}</p>
        <div className="esso-grid">
          {ALL_ESSO.map((e) => (
            <button
              key={`${e.year}-${e.code}`}
              type="button"
              aria-pressed={draft.enlistDate === e.from}
              className={`esso ${draft.enlistDate === e.from ? 'esso--on' : ''}`}
              onClick={() => set({ enlistDate: e.from })}
            >
              <span className="esso__label">{essoLabel(e, t)}</span>
              <span className="esso__dates num">
                {formatShort(parseISO(e.from))} – {formatShort(parseISO(e.to))}
              </span>
              {e.provisional && <span className="esso__tag">{caps(t.onboard.provisional)}</span>}
            </button>
          ))}
        </div>

        <p className="eyebrow field__or">{caps(t.onboard.orExact)}</p>
        <DateField
          id="date"
          label={t.onboard.orExact}
          value={draft.enlistDate}
          onChange={(v) => set({ enlistDate: v })}
        />
      </section>

      <section className="panel field">
        <p className="eyebrow">{caps(t.onboard.durationLabel)}</p>
        <div className="dur-grid">
          {DURATIONS.map((d) => (
            <button
              key={d.value}
              type="button"
              aria-pressed={draft.months === d.value}
              className={`dur ${draft.months === d.value ? 'dur--on' : ''}`}
              onClick={() => set({ months: d.value })}
            >
              <span className="dur__label">{t.durations[d.key].label}</span>
              <span className="dur__detail">{t.durations[d.key].detail}</span>
            </button>
          ))}
        </div>

        <label className="check">
          <input
            type="checkbox"
            checked={draft.borderUnit}
            onChange={(e) => set({ borderUnit: e.target.checked })}
          />
          <span>
            <strong>{t.onboard.borderTitle}</strong>
            <em>{t.onboard.borderDetail}</em>
          </span>
        </label>
      </section>

      <button className="btn btn--primary btn--block" onClick={submit}>
        {t.onboard.submit}
      </button>
    </div>
  )
}
