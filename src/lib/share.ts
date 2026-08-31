import type { Profile } from './types'
import type { ServiceState } from './service'
import type { Dict } from './i18n'
import { upperGreek } from './greek'
import { formatShort } from './dates'

/**
 * Κάρτα κοινοποίησης.
 *
 * Ζωγραφίζεται σε canvas αντί για screenshot, ώστε να βγαίνει πάντα στο ίδιο
 * μέγεθος (1080×1350, η αναλογία 4:5 που δεν κόβει το Instagram) και με τα
 * χρώματα της εφαρμογής, ανεξάρτητα από τη συσκευή.
 */

const W = 1080
const H = 1350

const CANVAS = '#06070A'
const OLIVE = '#7C8B3F'
const INK = '#F4F5F3'
const MUTED = '#84887E'
const HAIRLINE = '#212429'

const DISPLAY = "'Roboto Condensed', 'Arial Narrow', sans-serif"
const BODY = "system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif"

/** Τα γράμματα αραιώνουν με το χέρι — το canvas δεν έχει letter-spacing παντού. */
function tracked(
  ctx: CanvasRenderingContext2D, text: string, x: number, y: number, spacing: number,
): number {
  let cursor = x
  for (const ch of text) {
    ctx.fillText(ch, cursor, y)
    cursor += ctx.measureText(ch).width + spacing
  }
  return cursor - x - spacing
}

function trackedWidth(
  ctx: CanvasRenderingContext2D, text: string, spacing: number,
): number {
  let w = 0
  for (const ch of text) w += ctx.measureText(ch).width + spacing
  return w - spacing
}

export async function renderShareCard(
  profile: Profile, s: ServiceState, t: Dict,
): Promise<Blob> {
  // Χωρίς αυτό η πρώτη κάρτα βγαίνει σε εφεδρική γραμματοσειρά.
  if (typeof document !== 'undefined' && document.fonts) {
    try {
      await Promise.all([
        document.fonts.load("700 240px 'Roboto Condensed'"),
        document.fonts.load("600 28px 'Roboto Condensed'"),
      ])
    } catch { /* συνεχίζουμε με ό,τι υπάρχει */ }
  }

  const canvas = document.createElement('canvas')
  canvas.width = W
  canvas.height = H
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('canvas unavailable')

  ctx.fillStyle = CANVAS
  ctx.fillRect(0, 0, W, H)

  // Λεπτό πλαίσιο, όπως τα panel της εφαρμογής.
  ctx.strokeStyle = HAIRLINE
  ctx.lineWidth = 2
  ctx.strokeRect(56, 56, W - 112, H - 112)

  // Σήμα πάνω αριστερά.
  ctx.fillStyle = OLIVE
  ctx.font = `600 26px ${DISPLAY}`
  ctx.textBaseline = 'alphabetic'
  tracked(ctx, t.app.mark, 108, 148, 5)

  // Ο μεγάλος αριθμός.
  const days = s.hasEnlisted ? s.daysLeft : s.daysUntilEnlist
  const label = s.isDischarged
    ? t.share.done
    : s.hasEnlisted ? t.share.daysLeft : t.share.untilEnlist

  ctx.fillStyle = INK
  ctx.font = `700 380px ${DISPLAY}`
  ctx.textAlign = 'center'
  ctx.fillText(String(days), W / 2, 620)

  ctx.fillStyle = MUTED
  ctx.font = `600 34px ${DISPLAY}`
  ctx.textAlign = 'left'
  const capsLabel = upperGreek(label)
  const lw = trackedWidth(ctx, capsLabel, 8)
  tracked(ctx, capsLabel, (W - lw) / 2, 690, 8)

  // Μπάρα προόδου.
  const barX = 140, barY = 780, barW = W - 280, barH = 10
  ctx.fillStyle = HAIRLINE
  ctx.fillRect(barX, barY, barW, barH)
  ctx.fillStyle = OLIVE
  ctx.fillRect(barX, barY, Math.round(barW * s.progress), barH)

  ctx.fillStyle = MUTED
  ctx.font = `400 30px ${BODY}`
  ctx.textAlign = 'center'
  ctx.fillText(
    `${s.daysServed} / ${s.totalDays} · ${Math.round(s.progress * 100)}%`,
    W / 2, barY + 70,
  )

  // Τρεις στήλες με τα βασικά.
  const cols: Array<[string, string]> = [
    [t.share.enlisted, formatShort(s.enlist)],
    [t.share.discharge, formatShort(s.discharge)],
    [t.share.inCamp, String(s.daysInCamp)],
  ]
  const colY = 990
  const COL_W = 320
  cols.forEach(([k, v], i) => {
    const cx = W / 2 + (i - 1) * 300
    ctx.fillStyle = MUTED
    const kc = upperGreek(k)
    // Οι ετικέτες έχουν διαφορετικό μήκος ανά γλώσσα. Μικραίνουμε όσο χρειάζεται
    // ώστε καμία να μη βγει από τη στήλη της ή να ακουμπήσει το πλαίσιο.
    let size = 24
    ctx.font = `600 ${size}px ${DISPLAY}`
    while (trackedWidth(ctx, kc, 4) > COL_W && size > 15) {
      size -= 1
      ctx.font = `600 ${size}px ${DISPLAY}`
    }
    const kw = trackedWidth(ctx, kc, 4)
    ctx.textAlign = 'left'
    tracked(ctx, kc, cx - kw / 2, colY, 4)
    ctx.fillStyle = INK
    ctx.font = `500 42px ${DISPLAY}`
    ctx.textAlign = 'center'
    ctx.fillText(v, cx, colY + 56)
  })

  if (profile.name.trim()) {
    ctx.fillStyle = MUTED
    ctx.font = `400 30px ${BODY}`
    ctx.textAlign = 'center'
    ctx.fillText(profile.name.trim(), W / 2, 1140)
  }

  ctx.fillStyle = OLIVE
  ctx.font = `600 24px ${DISPLAY}`
  ctx.textAlign = 'left'
  const url = 'army-apolele.web.app'
  const uw = trackedWidth(ctx, url, 4)
  tracked(ctx, url, (W - uw) / 2, 1236, 4)

  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('toBlob failed'))),
      'image/png',
    )
  })
}

export type ShareOutcome = 'shared' | 'downloaded' | 'cancelled'

/**
 * Μοιράζεται την κάρτα. Το Web Share με αρχεία δουλεύει σε κινητά· αλλού
 * κατεβάζει το PNG, που είναι το ίδιο αποτέλεσμα με ένα βήμα παραπάνω.
 */
export async function shareCard(blob: Blob, title: string): Promise<ShareOutcome> {
  const file = new File([blob], 'army-apolele.png', { type: 'image/png' })
  const nav = navigator as Navigator & {
    canShare?: (data: { files?: File[] }) => boolean
  }

  if (nav.canShare?.({ files: [file] }) && navigator.share) {
    try {
      await navigator.share({ files: [file], title })
      return 'shared'
    } catch (err) {
      // AbortError σημαίνει ότι το ακύρωσε ο χρήστης — δεν είναι σφάλμα.
      if (err instanceof DOMException && err.name === 'AbortError') return 'cancelled'
    }
  }

  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = 'army-apolele.png'
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
  return 'downloaded'
}
