import type { ReactElement, ReactNode } from 'react'
import { useI18n } from '../hooks/useI18n'
import type { Platform } from '../hooks/useInstall'

/**
 * Device mock-ups for the install guide.
 *
 * They are HTML and CSS rather than screenshots: they stay sharp at any
 * resolution, follow the colours in DESIGN.md, and translate along with the
 * rest of the text. The control the reader has to press is always the only
 * thing picked out in amber.
 */

function Skeleton() {
  return (
    <div className="mk__body" aria-hidden="true">
      <div className="mk__row"><span className="mk__sq" /><span className="mk__bar mk__bar--60" /></div>
      <div className="mk__block" />
      <div className="mk__bar mk__bar--80" />
      <div className="mk__bar mk__bar--45" />
      <div className="mk__block mk__block--sm" />
      <div className="mk__bar mk__bar--70" />
    </div>
  )
}

function Phone({ children }: { children: ReactNode }) {
  return <div className="mk" aria-hidden="true"><div className="mk__screen">{children}</div></div>
}

/* ── iOS ─────────────────────────────────────────────────────────────────── */

function IosSafari() {
  const { t } = useI18n()
  return (
    <Phone>
      <Skeleton />
      <div className="mk__chrome">
        <div className="mk__url">{t.install.mock.url}</div>
        <div className="mk__tools">
          <span className="mk__ico">‹</span>
          <span className="mk__ico">›</span>
          <span className="mk__ico mk__ico--hi" aria-label="share">
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none"
                 stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 15V3m0 0L8 7m4-4 4 4" />
              <path d="M5 12v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-7" />
            </svg>
          </span>
          <span className="mk__ico">▤</span>
          <span className="mk__ico">❐</span>
        </div>
      </div>
    </Phone>
  )
}

function IosSheet() {
  const { t } = useI18n()
  const m = t.install.mock
  return (
    <Phone>
      <div className="mk__dim"><Skeleton /></div>
      <div className="mk__sheet">
        <span className="mk__grab" />
        <div className="mk__app">
          <img src="/icon-192.png" alt="" width="30" height="30" className="mk__appicon" />
          <div>
            <p className="mk__appname">{m.app}</p>
            <p className="mk__appurl">{m.url}</p>
          </div>
        </div>
        <ul className="mk__list">
          <li>{m.ios.copy}</li>
          <li>{m.ios.reading}</li>
          <li>{m.ios.bookmark}</li>
          <li className="mk__hi">{m.ios.addHome}</li>
          <li>{m.ios.find}</li>
        </ul>
      </div>
    </Phone>
  )
}

function IosDialog() {
  const { t } = useI18n()
  const m = t.install.mock
  return (
    <Phone>
      <div className="mk__dim"><Skeleton /></div>
      <div className="mk__dialog">
        <div className="mk__dtop">
          <span className="mk__dcancel">{m.ios.cancel}</span>
          <span className="mk__dtitle">{m.ios.dialog}</span>
          <span className="mk__dgo mk__hi">{m.ios.add}</span>
        </div>
        <div className="mk__dbody">
          <img src="/icon-192.png" alt="" width="34" height="34" className="mk__appicon" />
          <div className="mk__field">{m.app}</div>
        </div>
        <p className="mk__durl">{m.url}</p>
      </div>
    </Phone>
  )
}

/* ── Android ─────────────────────────────────────────────────────────────── */

function AndroidBar() {
  const { t } = useI18n()
  const m = t.install.mock
  return (
    <Phone>
      <div className="mk__topbar">
        <span className="mk__url mk__url--flex">{m.url}</span>
        <span className="mk__ico">⋮</span>
      </div>
      <Skeleton />
      {/* The app's own banner, exactly as it will appear. */}
      <div className="mk__banner">
        <img src="/icon-192.png" alt="" width="18" height="18" className="mk__appicon" />
        <div className="mk__btext">
          <p className="mk__bt">{t.install.bannerTitle}</p>
        </div>
        <span className="mk__hi mk__bbtn">{t.install.cta}</span>
      </div>
    </Phone>
  )
}

function AndroidMenu() {
  const { t } = useI18n()
  const m = t.install.mock
  return (
    <Phone>
      <div className="mk__topbar">
        <span className="mk__url mk__url--flex">{m.url}</span>
        <span className="mk__ico">⋮</span>
      </div>
      <div className="mk__dim mk__dim--sm"><Skeleton /></div>
      <ul className="mk__menu">
        <li>{m.android.newTab}</li>
        <li>{m.android.history}</li>
        <li>{m.android.share}</li>
        <li className="mk__hi">{m.android.install}</li>
      </ul>
    </Phone>
  )
}

function AndroidDialog() {
  const { t } = useI18n()
  const m = t.install.mock
  return (
    <Phone>
      <div className="mk__dim"><Skeleton /></div>
      <div className="mk__adialog">
        <img src="/icon-192.png" alt="" width="36" height="36" className="mk__appicon" />
        <p className="mk__atitle">{m.android.dialog}</p>
        <p className="mk__aurl">{m.app}</p>
        <div className="mk__abtns">
          <span>{m.android.cancel}</span>
          <span className="mk__hi">{m.android.confirm}</span>
        </div>
      </div>
    </Phone>
  )
}

/* ── Desktop ─────────────────────────────────────────────────────────────── */

function Window({ children }: { children: ReactNode }) {
  return <div className="mk mk--wide" aria-hidden="true"><div className="mk__screen">{children}</div></div>
}

function DesktopBar() {
  const { t } = useI18n()
  return (
    <Window>
      <div className="mk__wintop">
        <span className="mk__dot" /><span className="mk__dot" /><span className="mk__dot" />
        <span className="mk__url mk__url--flex">{t.install.mock.url}</span>
        <span className="mk__ico mk__ico--hi">
          <svg viewBox="0 0 24 24" width="13" height="13" fill="none"
               stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="4" width="18" height="13" rx="2" />
            <path d="M12 8v5m0 0-2-2m2 2 2-2" />
          </svg>
        </span>
      </div>
      <Skeleton />
    </Window>
  )
}

function DesktopDialog() {
  const { t } = useI18n()
  const m = t.install.mock
  return (
    <Window>
      <div className="mk__wintop">
        <span className="mk__dot" /><span className="mk__dot" /><span className="mk__dot" />
        <span className="mk__url mk__url--flex">{m.url}</span>
      </div>
      <div className="mk__dim mk__dim--sm"><Skeleton /></div>
      <div className="mk__ddialog">
        <img src="/icon-192.png" alt="" width="30" height="30" className="mk__appicon" />
        <div className="mk__dtext">
          <p className="mk__atitle">{m.desktop.dialog}</p>
          <p className="mk__aurl">{m.app}</p>
        </div>
        <div className="mk__abtns">
          <span>{m.desktop.cancel}</span>
          <span className="mk__hi">{m.desktop.confirm}</span>
        </div>
      </div>
    </Window>
  )
}

function DesktopApp() {
  const { t } = useI18n()
  return (
    <Window>
      <div className="mk__wintop mk__wintop--app">
        <span className="mk__dot" /><span className="mk__dot" /><span className="mk__dot" />
        <img src="/icon-192.png" alt="" width="14" height="14" className="mk__appicon" />
        <span className="mk__winname">{t.install.mock.app}</span>
      </div>
      <Skeleton />
      <p className="mk__caption">{t.install.mock.desktop.window}</p>
    </Window>
  )
}

const MOCKS: Record<Platform, Array<() => ReactElement>> = {
  ios: [IosSafari, IosSheet, IosDialog],
  android: [AndroidBar, AndroidMenu, AndroidDialog],
  desktop: [DesktopBar, DesktopDialog, DesktopApp],
}

export function InstallMock({ platform, step }: { platform: Platform; step: number }) {
  const Comp = MOCKS[platform][step]
  return Comp ? <Comp /> : null
}
