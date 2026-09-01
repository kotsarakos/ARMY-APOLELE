import { useCallback, useEffect, useState } from 'react'

export type Platform = 'ios' | 'android' | 'desktop'

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

const DISMISS_KEY = 'army_app.install.dismissed.v1'
/** Once dismissed, silence for 30 days. A prompt must not become nagging. */
const SNOOZE_MS = 30 * 24 * 60 * 60 * 1000

export function detectPlatform(): Platform {
  const ua = navigator.userAgent
  // iPadOS 13+ reports itself as "Macintosh", so touch is checked as well.
  const iPadOS = /Macintosh/.test(ua) && navigator.maxTouchPoints > 1
  if (/iPhone|iPad|iPod/.test(ua) || iPadOS) return 'ios'
  if (/Android/.test(ua)) return 'android'
  return 'desktop'
}

/** Already running as an installed app? */
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
      // Keep the event so it can be fired from our own button.
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

    // iOS has no beforeinstallprompt — the event never arrives — so we show it
    // ourselves, once the person has had a moment to see the page.
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

  /** The real native prompt — Android and Chrome only. */
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
    /** True once Chrome has confirmed the app is installable. */
    canPromptNatively: deferred !== null,
    visible,
    install,
    dismiss,
    hide: () => setVisible(false),
  }
}
