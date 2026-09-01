import { useEffect, useState } from 'react'
import {
  NOTIFY_HOURS, notifyEnabled, notifyHour, notifyState, registerDailySync,
  requestNotifications, setNotifyEnabled, setNotifyHour,
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
  const [hour, setHour] = useState(20)

  useEffect(() => {
    setPerm(notifyState())
    setOn(notifyEnabled())
    setInstalled(isStandalone())
    setHour(notifyHour())
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

  /** Η ώρα μπαίνει στο πρόγραμμα με το επόμενο render του App — δες buildPlan. */
  const pickHour = (h: number) => {
    setNotifyHour(h)
    setHour(h)
    toast.success(t.notify.okHour(h))
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
        {on && perm === 'granted' && (
          <label className="nt__hour">
            <span className="eyebrow">{caps(t.notify.hourLabel)}</span>
            <select
              className="input input--sm"
              value={hour}
              onChange={(e) => pickHour(Number(e.target.value))}
            >
              {NOTIFY_HOURS.map((h) => (
                <option key={h} value={h}>{t.notify.hourValue(h)}</option>
              ))}
            </select>
            <span className="nt__hourhint">{t.notify.hourHint}</span>
          </label>
        )}
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
