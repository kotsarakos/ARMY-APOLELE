import { useState } from 'react'
import type { Profile } from '../lib/types'
import type { ServiceState } from '../lib/service'
import { renderShareCard, shareCard } from '../lib/share'
import { useI18n } from '../hooks/useI18n'
import { useToast } from '../hooks/useToast'
import { upperGreek as caps } from '../lib/greek'

export function ShareCard({ profile, state }: { profile: Profile; state: ServiceState }) {
  const { t } = useI18n()
  const toast = useToast()
  const [busy, setBusy] = useState(false)

  const go = async () => {
    setBusy(true)
    try {
      const blob = await renderShareCard(profile, state, t)
      const outcome = await shareCard(blob, t.app.mark)
      if (outcome === 'shared') toast.success(t.share.okShared)
      if (outcome === 'downloaded') toast.success(t.share.okDownloaded)
    } catch (err) {
      console.warn('[army_app] share', err)
      toast.error(t.share.err)
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="band">
      <p className="eyebrow band__label">{caps(t.share.label)}</p>
      <div className="panel sh">
        <div className="sh__text">
          <p className="sh__hint">{t.share.hint}</p>
        </div>
        <button className="btn btn--secondary" onClick={go} disabled={busy}>
          {busy ? t.share.working : t.share.cta}
        </button>
      </div>
    </section>
  )
}
