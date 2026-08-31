import { useCallback, useEffect, useState } from 'react'

export type Platform = 'ios' | 'android' | 'desktop'

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

const DISMISS_KEY = 'army_app.install.dismissed.v1'
/** Μετά την απόρριψη, σιωπή για 30 μέρες. Το prompt δεν πρέπει να γίνεται γκρίνια. */
const SNOOZE_MS = 30 * 24 * 60 * 60 * 1000

export function detectPlatform(): Platform {
  const ua = navigator.userAgent
  // iPadOS 13+ δηλώνει «Macintosh», οπότε ελέγχουμε και την αφή.
  const iPadOS = /Macintosh/.test(ua) && navigator.maxTouchPoints > 1
  if (/iPhone|iPad|iPod/.test(ua) || iPadOS) return 'ios'
  if (/Android/.test(ua)) return 'android'
  return 'desktop'
}

/** Τρέχει ήδη ως εγκατεστημένη εφαρμογή; */
export function isStandalone(): boolean {
  return window.matchMedia('(display-mode: standalone)').matches
    || (navigator as Navigator & { standalone?: boolean }).standalone === true
}

function snoozed(): boolean {
  try {
    const raw = localStorage.getItem(DISMISS_KEY)
    if (!raw) return false
    return Date.now() - Number(raw) < SNOOZE_MS
  } catch { return false }
}

export function useInstall() {
  const [platform] = useState<Platform>(detectPlatform)
  const [installed, setInstalled] = useState(isStandalone)
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (installed || snoozed()) return

    const onBefore = (e: Event) => {
      // Κρατάμε το γεγονός για να το πυροδοτήσουμε από δικό μας κουμπί.
      e.preventDefault()
      setDeferred(e as BeforeInstallPromptEvent)
      setVisible(true)
    }
    const onInstalled = () => {
      setInstalled(true)
      setVisible(false)
      setDeferred(null)
    }

    window.addEventListener('beforeinstallprompt', onBefore)
    window.addEventListener('appinstalled', onInstalled)

    // Το iOS δεν υποστηρίζει beforeinstallprompt — δεν θα έρθει ποτέ γεγονός,
    // οπότε το εμφανίζουμε μόνοι μας, αφού ο χρήστης προλάβει να δει τη σελίδα.
    let timer: ReturnType<typeof setTimeout> | undefined
    if (platform === 'ios') {
      timer = setTimeout(() => setVisible(true), 4000)
    }

    return () => {
      window.removeEventListener('beforeinstallprompt', onBefore)
      window.removeEventListener('appinstalled', onInstalled)
      if (timer) clearTimeout(timer)
    }
  }, [platform, installed])

  /** Το πραγματικό native prompt — μόνο Android/Chrome. */
  const install = useCallback(async (): Promise<'accepted' | 'dismissed' | 'unavailable'> => {
    if (!deferred) return 'unavailable'
    await deferred.prompt()
    const { outcome } = await deferred.userChoice
    setDeferred(null)
    if (outcome === 'accepted') setVisible(false)
    return outcome
  }, [deferred])

  const dismiss = useCallback(() => {
    setVisible(false)
    try { localStorage.setItem(DISMISS_KEY, String(Date.now())) } catch { /* ignore */ }
  }, [])

  return {
    platform,
    installed,
    /** true όταν το Chrome έχει επιβεβαιώσει ότι η εφαρμογή είναι εγκαταστάσιμη. */
    canPromptNatively: deferred !== null,
    visible,
    install,
    dismiss,
    hide: () => setVisible(false),
  }
}
