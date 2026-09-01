import type { ServiceState } from '../lib/service'
import { formatShort } from '../lib/dates'
import { useI18n } from '../hooks/useI18n'
import { upperGreek as caps } from '../lib/greek'

/**
 * Έξι πλακίδια με το ίδιο οπτικό βάρος σημαίνουν ότι κανένα δεν ξεχωρίζει, και
 * το μάτι τα διαβάζει όλα ή κανένα. Δύο από αυτά απαντούν στην ερώτηση που
 * κάνει κανείς κάθε μέρα — «πόσο ακόμη μέσα» και «πότε» — οπότε παίρνουν το
 * διπλάσιο πλάτος και μεγαλύτερο νούμερο. Τα υπόλοιπα μένουν υποστηρικτικά.
 */
function Tile({ label, value, hint, text, big }: {
  label: string
  value: string | number
  hint?: string
  text?: boolean
  big?: boolean
}) {
  return (
    <div className={`tile ${big ? 'tile--lead' : ''}`}>
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

      <div className="tiles tiles--lead">
        <Tile
          big
          label={t.stats.inCamp}
          value={state.daysInCamp}
          hint={t.stats.inCampHint}
        />
        <Tile
          big
          text
          label={t.stats.discharge}
          value={formatShort(state.discharge)}
          hint={t.stats.dischargeHint}
        />
      </div>

      <div className="tiles tiles--rest">
        <Tile label={t.stats.served} value={state.daysServed} />
        <Tile label={t.stats.months} value={state.monthsServed} />
        <Tile label={t.stats.weeksLeft} value={Math.ceil(state.daysLeft / 7)} />
        <Tile
          label={t.stats.pay}
          value={`${state.pay.earnedSoFar}€`}
          hint={t.stats.payHint(state.pay.perMonth, state.pay.totalForService)}
        />
      </div>
    </section>
  )
}
