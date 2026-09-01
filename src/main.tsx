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

// Πριν από την πρώτη απόδοση: το `data-theme` πρέπει να υπάρχει ήδη, αλλιώς
// όποιος έχει διαλέξει φωτεινό βλέπει μια μαύρη αναλαμπή.
applyTheme(readTheme())
watchSystemTheme()

// Ο service worker κάνει την εφαρμογή εγκαταστάσιμη και της δίνει offline
// λειτουργία. Καταχωρείται μετά το load ώστε να μη διεκδικεί εύρος ζώνης
// από την πρώτη απόδοση.
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
