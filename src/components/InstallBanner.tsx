import { useInstall } from '../hooks/useInstall'
import { useI18n } from '../hooks/useI18n'
import { useToast } from '../hooks/useToast'

/**
 * The prompt that appears on a phone.
 *
 * On Android and Chrome it fires the real native install prompt. iOS has no
 * such API, so it sends the reader to the step-by-step guide instead.
 */
export function InstallBanner({ onOpenGuide }: { onOpenGuide: () => void }) {
  const { t } = useI18n()
  const toast = useToast()
  const { visible, platform, canPromptNatively, install, dismiss, hide } = useInstall()

  if (!visible) return null

  const primary = async () => {
    if (canPromptNatively) {
      const outcome = await install()
      if (outcome === 'accepted') toast.success(t.install.okInstalled)
      else if (outcome === 'dismissed') hide()
      return
    }
    hide()
    onOpenGuide()
  }

  return (
    <div className="ib" role="dialog" aria-label={t.install.bannerTitle}>
      <div className="ib__card">
        <img className="ib__icon" src="/icon-192.png" alt="" width="44" height="44" />
        <div className="ib__text">
          <p className="ib__title">{t.install.bannerTitle}</p>
          <p className="ib__body">{t.install.bannerBody}</p>
        </div>
        <button className="ib__x" onClick={dismiss} aria-label={t.install.close}>×</button>
        <div className="ib__actions">
          <button className="btn btn--primary btn--sm" onClick={primary}>
            {canPromptNatively ? t.install.cta : t.install.how}
          </button>
          <button className="btn btn--ghost btn--sm" onClick={dismiss}>
            {t.install.later}
          </button>
        </div>
      </div>
      <p className="ib__note">
        {platform === 'ios' ? t.install.dismissedNote : t.install.dismissedNote}
      </p>
    </div>
  )
}
