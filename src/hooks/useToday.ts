import { useEffect, useState } from 'react'
import { today } from '../lib/dates'

/** Keeps "today" fresh: it checks every minute and whenever the tab becomes
 *  visible again, so the counter turns over at midnight even if the app was
 *  left open. */
export function useToday(): Date {
  const [date, setDate] = useState(today)

  useEffect(() => {
    const tick = () => {
      const now = today()
      setDate((prev) => (prev.getTime() === now.getTime() ? prev : now))
    }
    const id = setInterval(tick, 60_000)
    document.addEventListener('visibilitychange', tick)
    return () => {
      clearInterval(id)
      document.removeEventListener('visibilitychange', tick)
    }
  }, [])

  return date
}
