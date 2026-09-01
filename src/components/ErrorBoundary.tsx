import { Component } from 'react'
import type { ErrorInfo, ReactNode } from 'react'
import { DICT, detectLang } from '../lib/i18n'
import { upperGreek as caps } from '../lib/greek'

interface Props { children: ReactNode }
interface State { hasError: boolean }

/**
 * Catches render errors so a bug does not become a white page.
 * It is a class component because hooks still do not cover error boundaries.
 * It reads the language directly rather than from context, because the context
 * may be exactly what broke.
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false }

  static getDerivedStateFromError(): State {
    return { hasError: true }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[army_app]', error, info.componentStack)
  }

  render() {
    if (!this.state.hasError) return this.props.children

    let lang = detectLang()
    try {
      const stored = localStorage.getItem('army_app.lang.v1')
      if (stored === 'el' || stored === 'en') lang = stored
    } catch { /* ignore */ }
    const t = DICT[lang].errors

    return (
      <main className="shell shell--center">
        <div className="panel notfound">
          <p className="eyebrow">{caps(t.boundaryTitle)}</p>
          <p className="notfound__sub">{t.boundaryBody}</p>
          <button className="btn btn--primary" onClick={() => window.location.reload()}>
            {t.reload}
          </button>
        </div>
      </main>
    )
  }
}
