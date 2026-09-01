import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import { I18nProvider } from './hooks/useI18n'
import { ToastProvider } from './hooks/useToast'
import { AuthProvider } from './hooks/useAuth'
import { Toasts } from './components/Toasts'
import { ErrorBoundary } from './components/ErrorBoundary'
import { applyTheme, readTheme, watchSystemTheme } from './lib/theme'
import './styles/global.css'
import './styles/app.css'

// Before the first render: `data-theme` has to be in place already, or anyone
// who chose the light theme sees a flash of black.
applyTheme(readTheme())
watchSystemTheme()

// The service worker makes the app installable and gives it offline support.
// It registers after load, so it does not compete for bandwidth with the first
// render.
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch((err) => {
      console.warn('[army_app] service worker registration failed', err)
    })
  })
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <I18nProvider>
        <ToastProvider>
          <AuthProvider>
            <App />
            <Toasts />
          </AuthProvider>
        </ToastProvider>
      </I18nProvider>
    </ErrorBoundary>
  </StrictMode>,
)
