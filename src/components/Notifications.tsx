import { useEffect, useState } from 'react'
import {
  notifyEnabled, notifyState, registerDailySync, requestNotifications, setNotifyEnabled,
} from '../lib/notify'
import type { NotifyState } from '../lib/notify'
import { useI18n } from '../hooks/useI18n'
import { useToast } from '../hooks/useToast'
import { upperGreek as caps } from '../lib/greek'

/** Είναι η εφαρμογή εγκατεστημένη; Μόνο τότε φτάνουν ειδοποιήσεις με την
 *  εφαρμογή κλειστή, οπότε αξίζει να το πούμε. */
function isStandalone(): boolean {
  return window.matchMedia('(display-mode: standalone)').matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
}

export function Notifications() {
  const { t } = useI18n()
  const toast = useToast()
  const [perm, setPerm] = useState<NotifyState>('default')
  const [on, setOn] = useState(false)
  const [installed, setInstalled] = useState(true)

  useEffect(() => {
    setPerm(notifyState())
    setOn(notifyEnabled())
    setInstalled(isStandalone())
  }, [])

  if (perm === 'unsupported') {
    return (
      <section className="band">
        <p className="eyebrow band__label">{caps(t.notify.label)}</p>
        <div className="panel"><p className="acc__muted">{t.notify.unsupported}</p></div>
      </section>
    )
  }

  const enable = async () => {
    const res = await requestNotifications()
    setPerm(res)
    if (res !== 'granted') return toast.error(t.notify.denied)
    setNotifyEnabled(true)
    setOn(true)
    await registerDailySync()
    toast.success(t.notify.okEnabled)
  }

  const disable = () => {
    setNotifyEnabled(false)
    setOn(false)
    toast.success(t.notify.okDisabled)
  }

  return (
    <section className="band">
      <p className="eyebrow band__label">{caps(t.notify.label)}</p>
      <div className="panel nt">
        <div className="nt__head">
          <span className={`nt__dot ${on && perm === 'granted' ? 'nt__dot--on' : ''}`} aria-hidden="true" />
          <p className="nt__state">{on && perm === 'granted' ? t.notify.on : t.notify.off}</p>
        </div>
        <p className="nt__body">{t.notify.body}</p>
        {perm === 'denied' && <p className="nt__warn">{t.notify.denied}</p>}
        {!installed && <p className="nt__warn">{t.notify.installFirst}</p>}
        {on && perm === 'granted' ? (
          <button className="btn btn--ghost" onClick={disable}>{t.notify.disable}</button>
        ) : (
          <button className="btn btn--secondary" onClick={enable} disabled={perm === 'denied'}>
            {t.notify.enable}
          </button>
        )}
      </div>
    </section>
  )
}
