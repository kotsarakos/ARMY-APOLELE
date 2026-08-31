import { useEffect, useState } from 'react'
import { today } from '../lib/dates'

/** Κρατά τη «σημερινή» ημερομηνία φρέσκια: ελέγχει κάθε λεπτό και όταν η
 *  καρτέλα ξαναγίνεται ορατή, ώστε ο μετρητής να γυρίζει τα μεσάνυχτα
 *  ακόμη κι αν η εφαρμογή έμεινε ανοιχτή. */
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
