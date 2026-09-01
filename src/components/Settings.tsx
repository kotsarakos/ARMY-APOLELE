import { useRef, useState } from 'react'
import type { Profile, ServiceMonths } from '../lib/types'
import type { ServiceState } from '../lib/service'
import { downloadBackup, parseBackup } from '../lib/backup'
import { downloadIcs } from '../lib/ics'
import type { Theme } from '../lib/theme'
import { THEMES, readTheme, setTheme } from '../lib/theme'
import { useI18n } from '../hooks/useI18n'
import { useToast } from '../hooks/useToast'
import { LANGS } from '../lib/i18n'
import type { Lang } from '../lib/i18n'
import { DateField } from './DateField'
import { upperGreek as caps } from '../lib/greek'

const LANG_NAMES: Record<Lang, string> = { el: 'Ελληνικά', en: 'English' }

export function Settings({
  profile, service, update, onReset, onRestore,
}: {
  profile: Profile
  service: ServiceState
  update: (patch: Partial<Profile>) => void
  onReset: () => void
  onRestore: (next: Profile) => void
}) {
  const { t, lang, setLang } = useI18n()
  const toast = useToast()
  const [confirming, setConfirming] = useState(false)
  const [theme, setThemeState] = useState<Theme>(readTheme)
  const fileRef = useRef<HTMLInputElement>(null)

  const pickTheme = (next: Theme) => {
    setTheme(next)
    setThemeState(next)
  }

  const exportIcs = () => {
    downloadIcs(profile, service, t)
    toast.success(t.settings.okIcs)
  }

  const commit = (patch: Partial<Profile>) => {
    update(patch)
    toast.success(t.settings.okSaved)
  }

  const exportData = () => {
    downloadBackup(profile)
    toast.success(t.settings.okExported)
  }

  const importData = async (file: File) => {
    const { profile: restored, error } = parseBackup(await file.text())
    if (error) {
      const msg = {
        parse: t.settings.errImportParse,
        format: t.settings.errImportFormat,
        empty: t.settings.errImportEmpty,
      }
      return toast.error(msg[error])
    }
    onRestore(restored!)
    toast.success(t.settings.okImported)
  }

  return (
    <section className="band">
      <p className="eyebrow band__label">{caps(t.settings.label)}</p>
      <div className="panel set">
        <div className="set__row">
          <span>{t.settings.enlistDate}</span>
          <div className="set__ctl">
            <DateField
              label={t.settings.enlistDate}
              value={profile.enlistDate}
              onChange={(v) => v && commit({ enlistDate: v })}
            />
          </div>
        </div>

        <label className="set__row">
          <span>{t.settings.duration}</span>
          <select
            className="input input--sm"
            value={profile.months}
            onChange={(e) => commit({ months: Number(e.target.value) as ServiceMonths })}
          >
            {([12, 9, 6, 3] as ServiceMonths[]).map((m) => (
              <option key={m} value={m}>{t.settings.months(m)}</option>
            ))}
          </select>
        </label>

        <label className="set__row set__row--check">
          <span>{t.settings.border}</span>
          <input
            type="checkbox"
            checked={profile.borderUnit}
            onChange={(e) => commit({ borderUnit: e.target.checked })}
          />
        </label>

        <label className="set__row">
          <span>{t.settings.language}</span>
          <select
            className="input input--sm"
            value={lang}
            onChange={(e) => setLang(e.target.value as Lang)}
          >
            {LANGS.map((l) => (
              <option key={l} value={l}>{LANG_NAMES[l]}</option>
            ))}
          </select>
        </label>

        <div className="set__row set__row--seg">
          <span>{t.settings.theme}</span>
          <div className="seg" role="group" aria-label={t.settings.theme}>
            {THEMES.map((k) => (
              <button
                key={k}
                type="button"
                className={`seg__b ${theme === k ? 'seg__b--on' : ''}`}
                aria-pressed={theme === k}
                onClick={() => pickTheme(k)}
              >{t.settings.themes[k]}</button>
            ))}
          </div>
        </div>
        <p className="set__hint set__hint--row">{t.settings.themeHint}</p>

        <div className="set__data">
          <p className="eyebrow">{caps(t.settings.dataTitle)}</p>
          <div className="set__databtns">
            <button className="btn btn--secondary btn--sm" onClick={exportData}>
              {t.settings.export}
            </button>
            <button className="btn btn--secondary btn--sm" onClick={() => fileRef.current?.click()}>
              {t.settings.import}
            </button>
            <button className="btn btn--secondary btn--sm" onClick={exportIcs}>
              {t.settings.ics}
            </button>
          </div>
          <p className="set__hint">{t.settings.exportHint}</p>
          <p className="set__hint">{t.settings.importHint}</p>
          <p className="set__hint">{t.settings.icsHint}</p>
          <input
            ref={fileRef}
            className="visually-hidden"
            type="file"
            accept="application/json,.json"
            onChange={(e) => {
              const file = e.target.files?.[0]
              // Clear the value so the same file can be picked again.
              e.target.value = ''
              if (file) void importData(file)
            }}
          />
        </div>

        <div className="set__foot">
          {confirming ? (
            <div className="set__confirm">
              <span className="set__confirm-q">{t.settings.confirmReset}</span>
              <button className="btn btn--danger" onClick={onReset}>
                {t.settings.confirmYes}
              </button>
              <button className="btn btn--ghost btn--sm" onClick={() => setConfirming(false)}>
                {t.settings.confirmNo}
              </button>
            </div>
          ) : (
            <button className="btn btn--danger" onClick={() => setConfirming(true)}>
              {t.settings.reset}
            </button>
          )}
        </div>
      </div>
    </section>
  )
}
