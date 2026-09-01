import { useState } from 'react'
import { useI18n } from '../hooks/useI18n'
import { upperGreek as caps } from '../lib/greek'
import { InstallMock } from './InstallMocks'
import { useInstall, detectPlatform } from '../hooks/useInstall'
import type { Platform } from '../hooks/useInstall'

const ORDER: Platform[] = ['ios', 'android', 'desktop']

/** The full install guide, one tab per platform. */
export function InstallGuide({ onBack }: { onBack: () => void }) {
  const { t } = useI18n()
  const { installed, canPromptNatively, install } = useInstall()
  const [tab, setTab] = useState<Platform>(detectPlatform)

  const steps = t.install[tab]

  return (
    <article className="page">
      <div className="ig__head">
        <img className="ig__logo" src="/icon-192.png" alt="" width="56" height="56" />
        <h1 className="page__title">{t.install.pageTitle}</h1>
        <p className="page__intro">{t.install.pageSub}</p>
        {installed && <p className="ig__done">✓ {t.install.installed}</p>}
      </div>

      {canPromptNatively && !installed && (
        <button className="btn btn--primary btn--block ig__cta" onClick={() => void install()}>
          {t.install.cta}
        </button>
      )}

      <div className="ig__tabs" role="tablist">
        {ORDER.map((p) => (
          <button
            key={p}
            role="tab"
            aria-selected={tab === p}
            className={`ig__tab ${tab === p ? 'ig__tab--on' : ''}`}
            onClick={() => setTab(p)}
          >
            {caps(t.install.tabs[p])}
          </button>
        ))}
      </div>
      <p className="ig__auto">{t.install.autoTab}</p>

      <ol className="ig__steps">
        {steps.map((s, i) => (
          <li key={s.h} className="panel ig__step">
            <div className="ig__stephead">
              <span className="ig__num num">{i + 1}</span>
              <div>
                <h2 className="ig__h">{s.h}</h2>
                <p className="ig__p">{s.p}</p>
              </div>
            </div>
            <InstallMock platform={tab} step={i} />
          </li>
        ))}
      </ol>

      <h2 className="ig__section">{t.install.benefitsTitle}</h2>
      <div className="ig__benefits">
        {t.install.benefits.map((b) => (
          <section key={b.h} className="panel page__section">
            <h3 className="page__h2">{b.h}</h3>
            <p className="page__p">{b.p}</p>
          </section>
        ))}
      </div>

      <p className="ig__remove">{t.install.removeNote}</p>

      <button className="btn btn--secondary btn--block" onClick={onBack}>
        {t.app.backHome}
      </button>
    </article>
  )
}
