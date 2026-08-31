import { useEffect, useMemo, useRef, useState } from 'react'
import { addDays, addMonths, formatDate, formatShort, toISO, today } from '../lib/dates'
import { clampToRange, monthGrid, safeParse, weekHeader } from '../lib/calendar'
import { useI18n } from '../hooks/useI18n'
import { upperGreek as caps } from '../lib/greek'

/**
 * Επιλογή ημερομηνίας με στρογγυλά κουμπιά.
 *
 * Αντικαθιστά το `<input type="date">`, που σε κάθε browser δείχνει άλλο
 * πράγμα: στο Chrome desktop βγάζει MM/DD/YYYY ανεξάρτητα από τη γλώσσα της
 * σελίδας, και στο κινητό ανοίγει ένα χειριστήριο που δεν ελέγχουμε.
 *
 * Ανοίγει ως φύλλο πάνω από τη σελίδα, όχι ως popover μέσα στη φόρμα: με δύο
 * πεδία δίπλα-δίπλα (Από / Έως) ένα popover θα έσπρωχνε το περιεχόμενο και θα
 * χανόταν το σημείο που κοιτάς. Το φύλλο παίρνει και όλο το πλάτος, οπότε τα
 * κελιά μένουν πάνω από 44px ακόμη και στα 320px.
 */
export function DateField({
  value, onChange, min, max, label, id,
}: {
  value: string
  onChange: (iso: string) => void
  min?: string
  max?: string
  label: string
  id?: string
}) {
  const { t } = useI18n()
  const [open, setOpen] = useState(false)
  const selected = safeParse(value)
  const now = today()

  const [view, setView] = useState<Date>(selected ?? now)
  const sheetRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)

  // Κάθε άνοιγμα ξεκινά από τον μήνα της επιλεγμένης ημερομηνίας, όχι από
  // εκεί που είχε μείνει η προηγούμενη περιήγηση.
  useEffect(() => {
    if (open) setView(safeParse(value) ?? now)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  // Escape κλείνει, και η εστίαση γυρίζει στο κουμπί που το άνοιξε.
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.preventDefault(); close() }
    }
    document.addEventListener('keydown', onKey)
    // Το φύλλο πιάνει όλη την οθόνη· χωρίς αυτό η σελίδα από κάτω κυλάει μαζί.
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = prev
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  const close = () => {
    setOpen(false)
    triggerRef.current?.focus()
  }

  const pick = (iso: string) => {
    onChange(iso)
    setOpen(false)
    triggerRef.current?.focus()
  }

  const cells = useMemo(
    () => monthGrid(view.getFullYear(), view.getMonth()),
    [view],
  )
  const headers = useMemo(() => weekHeader(t.weekdaysShort), [t])

  const todayISO = toISO(now)
  const canGoPrev = !min || toISO(addDays(new Date(view.getFullYear(), view.getMonth(), 1, 12), -1)) >= min
  const canGoNext = !max || toISO(new Date(view.getFullYear(), view.getMonth() + 1, 1, 12)) <= max
  const todayAllowed = clampToRange(todayISO, min, max)

  return (
    <>
      <button
        ref={triggerRef}
        id={id}
        type="button"
        className={`datef ${selected ? '' : 'datef--empty'}`}
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        aria-label={selected ? t.cal.chosen(formatShort(selected)) : `${label}: ${t.cal.open}`}
      >
        <span className="datef__v num">
          {selected ? formatShort(selected) : t.cal.none}
        </span>
        <span className="datef__ico" aria-hidden="true">▾</span>
      </button>

      {open && (
        <div className="calsheet" role="presentation" onMouseDown={(e) => {
          if (e.target === e.currentTarget) close()
        }}>
          <div
            ref={sheetRef}
            className="cal"
            role="dialog"
            aria-modal="true"
            aria-label={label}
          >
            <div className="cal__head">
              <button
                type="button" className="cal__nav"
                onClick={() => setView(addMonths(view, -1))}
                disabled={!canGoPrev}
                aria-label={t.cal.prev}
              >‹</button>
              <p className="cal__month">
                {t.monthsAlone[view.getMonth()]} <span className="num">{view.getFullYear()}</span>
              </p>
              <button
                type="button" className="cal__nav"
                onClick={() => setView(addMonths(view, 1))}
                disabled={!canGoNext}
                aria-label={t.cal.next}
              >›</button>
            </div>

            <div className="cal__week" aria-hidden="true">
              {headers.map((w, i) => <span key={i}>{caps(w)}</span>)}
            </div>

            <div className="cal__grid">
              {cells.map((c) => {
                const disabled = !clampToRange(c.iso, min, max)
                const isSel = c.iso === value
                const isToday = c.iso === todayISO
                return (
                  <button
                    key={c.iso}
                    type="button"
                    data-day={c.iso}
                    className={[
                      'cal__day',
                      c.inMonth ? '' : 'cal__day--out',
                      isSel ? 'cal__day--on' : '',
                      isToday && !isSel ? 'cal__day--today' : '',
                    ].filter(Boolean).join(' ')}
                    disabled={disabled}
                    aria-pressed={isSel}
                    aria-current={isToday ? 'date' : undefined}
                    aria-label={formatDate(c.date, t, true)}
                    onClick={() => pick(c.iso)}
                  >
                    <span className="cal__dot num">{c.date.getDate()}</span>
                  </button>
                )
              })}
            </div>

            <div className="cal__foot">
              <button
                type="button" className="btn btn--secondary btn--sm"
                onClick={() => pick(todayISO)}
                disabled={!todayAllowed}
              >{t.cal.today}</button>
              <button
                type="button" className="btn btn--ghost btn--sm"
                onClick={close}
              >{t.cal.close}</button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
