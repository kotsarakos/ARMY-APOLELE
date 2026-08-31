import type { Profile } from '../lib/types'
import type { ServiceState } from '../lib/service'
import { tierFor } from '../lib/ranks'
import { formatDate } from '../lib/dates'
import { ALL_ESSO, essoLabel } from '../lib/esso'
import { upperGreek as caps } from '../lib/greek'
import { useI18n } from '../hooks/useI18n'
import { useToast } from '../hooks/useToast'

/** Τα αρχικά για το «σήμα» — δύο γράμματα το πολύ. */
function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (!parts.length) return '—'
  return parts.slice(0, 2).map((p) => p[0]).join('').toUpperCase()
}

export function ProfileCard({
  profile, service, update,
}: {
  profile: Profile
  service: ServiceState
  update: (patch: Partial<Profile>) => void
}) {
  const { t } = useI18n()
  const toast = useToast()
  const tier = tierFor(service)

  // Η ΕΣΣΟ βρίσκεται από την ημερομηνία κατάταξης, αν ταιριάζει με γνωστή σειρά.
  const esso = ALL_ESSO.find((e) => e.from === profile.enlistDate)
  const pct = Math.round(service.progress * 100)

  const rows: Array<[string, string]> = [
    [t.profile.enlisted, formatDate(service.enlist, t)],
    [t.profile.discharge, formatDate(service.discharge, t)],
    [t.profile.duration, t.settings.months(profile.months)],
    [t.profile.border, profile.borderUnit ? t.profile.yes : t.profile.no],
  ]
  if (esso) rows.unshift([t.profile.esso, essoLabel(esso, t)])

  return (
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
              {profile.unit && <span className="pf__unit">{profile.unit}</span>}
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
          <label className="mn__f">
            <span className="eyebrow">{caps(t.profile.unit)}</span>
            <input
              className="input" type="text"
              placeholder={t.profile.unitPlaceholder}
              value={profile.unit ?? ''}
              onChange={(e) => update({ unit: e.target.value })}
              onBlur={() => toast.success(t.profile.okSaved)}
            />
          </label>
        </div>
      </div>
    </section>
  )
}
