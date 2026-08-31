import type { ServiceState } from '../lib/service'
import { formatShort } from '../lib/dates'
import { useI18n } from '../hooks/useI18n'
import { upperGreek as caps } from '../lib/greek'

function Tile({ label, value, hint, text }: {
  label: string; value: string | number; hint?: string; text?: boolean
}) {
  return (
    <div className="tile">
      <p className="eyebrow">{caps(label)}</p>
      <p className={`tile__value num ${text ? 'tile__value--text' : ''}`}>{value}</p>
      {hint && <p className="tile__hint">{hint}</p>}
    </div>
  )
}

export function Stats({ state }: { state: ServiceState }) {
  const { t } = useI18n()

  return (
    <section className="band">
      <p className="eyebrow band__label">{caps(t.stats.label)}</p>
      <div className="tiles">
        <Tile label={t.stats.inCamp} value={state.daysInCamp} hint={t.stats.inCampHint} />
        <Tile label={t.stats.served} value={state.daysServed} />
        <Tile
          label={t.stats.months}
          value={state.monthsServed}
          hint={t.stats.monthsHint(state.totalDays)}
        />
        <Tile
          label={t.stats.discharge}
          value={formatShort(state.discharge)}
          hint={t.stats.dischargeHint}
          text
        />
        <Tile
          label={t.stats.pay}
          value={`${state.pay.earnedSoFar}€`}
          hint={t.stats.payHint(state.pay.perMonth, state.pay.totalForService)}
        />
        <Tile label={t.stats.weeksLeft} value={Math.ceil(state.daysLeft / 7)} />
      </div>
    </section>
  )
}
