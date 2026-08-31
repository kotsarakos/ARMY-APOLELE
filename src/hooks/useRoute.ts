import { useCallback, useEffect, useState } from 'react'

export type Route = 'home' | 'privacy' | 'install' | 'notfound'

function parse(pathname: string): Route {
  const p = pathname.replace(/\/+$/, '') || '/'
  if (p === '/' || p === '/index.html') return 'home'
  if (p === '/privacy') return 'privacy'
  if (p === '/install') return 'install'
  return 'notfound'
}

/** Ελάχιστος router. Το Firebase Hosting κάνει rewrite τα πάντα στο
 *  index.html, οπότε οι άγνωστες διαδρομές φτάνουν εδώ και γίνονται 404. */
export function useRoute() {
  const [route, setRoute] = useState<Route>(() => parse(window.location.pathname))

  useEffect(() => {
    const onPop = () => setRoute(parse(window.location.pathname))
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  }, [])

  const navigate = useCallback((to: string) => {
    window.history.pushState({}, '', to)
    setRoute(parse(to))
    window.scrollTo(0, 0)
  }, [])

  return { route, navigate }
}
