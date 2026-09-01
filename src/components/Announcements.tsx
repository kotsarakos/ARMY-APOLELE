import { useEffect, useState } from 'react'
import type { AnnouncementFeed } from '../lib/announcements'
import {
  OFFICIAL_LINKS, lastSeen, localAnnouncements, markSeen, refreshAnnouncements,
} from '../lib/announcements'
import { formatDate, parseISO } from '../lib/dates'
import { useI18n } from '../hooks/useI18n'
import { upperGreek as caps } from '../lib/greek'

/** Πόσες δείχνουμε. Παραπάνω γίνεται αρχείο, και δεν είμαστε αρχείο. */
const SHOWN = 4

/**
 * Ανακοινώσεις της Στρατολογίας.
 *
 * Είναι αντίγραφο, όχι πηγή: κάθε τίτλος οδηγεί στην επίσημη σελίδα, και η
 * ημερομηνία τελευταίου ελέγχου φαίνεται πάντα. Η εφαρμογή δεν σχετίζεται με
 * το ΓΕΕΘΑ, οπότε δεν επιτρέπεται να μοιάζει με επίσημο κανάλι — ειδικά όταν
 * το περιεχόμενο αφορά προθεσμίες.
 */
export function Announcements() {
  const { t } = useI18n()
  const [feed, setFeed] = useState<AnnouncementFeed | null>(null)
  const [seen] = useState(lastSeen)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false

    void (async () => {
      // Πρώτα ό,τι υπάρχει ήδη εδώ: η οθόνη γεμίζει χωρίς να περιμένει δίκτυο.
      const local = await localAnnouncements()
      if (cancelled) return
      if (local) setFeed(local)
      setLoading(false)

      // Μετά, και μόνο αν άνοιξε η ενότητα, ένας έλεγχος για κάτι νεότερο.
      const fresh = await refreshAnnouncements(local)
      if (!cancelled && fresh) setFeed(fresh)
    })()

    return () => { cancelled = true }
  }, [])

  // Η σήμανση γίνεται αφού δει ο χρήστης τη λίστα, όχι τη στιγμή που φορτώνει:
  // αλλιώς το «νέο» θα έσβηνε πριν προλάβει να το διαβάσει.
  useEffect(() => {
    if (!feed) return
    const id = setTimeout(() => markSeen(feed.items), 1500)
    return () => clearTimeout(id)
  }, [feed])

  const items = feed?.items.slice(0, SHOWN) ?? []

  return (
    <section className="band">
      <p className="eyebrow band__label">{caps(t.news.label)}</p>

      <div className="panel nw">
        <p className="nw__intro">{t.news.intro}</p>

        {loading ? (
          <p className="mn__empty">{t.news.loading}</p>
        ) : items.length === 0 ? (
          <p className="mn__empty">{t.news.empty}</p>
        ) : (
          <ul className="nw__list">
            {items.map((i) => (
              <li key={i.id} className="nw__item">
                <a
                  className="nw__title"
                  href={i.link}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {i.title}
                </a>
                {/* Το σήμα μπαίνει στη γραμμή της ημερομηνίας και όχι μέσα στον
                    τίτλο: με τίτλο δύο σειρών έπεφτε άλλοτε δίπλα του και
                    άλλοτε από κάτω, ανάλογα με το πού τύχαινε να σπάσει. */}
                <p className="nw__meta">
                  {seen && i.date > seen && (
                    <span className="tag tag--live">{t.news.fresh}</span>
                  )}
                  {i.date && (
                    <span className="nw__date num">{formatDate(parseISO(i.date), t)}</span>
                  )}
                </p>
                {i.summary && <p className="nw__sum">{i.summary}</p>}
              </li>
            ))}
          </ul>
        )}

        {feed?.checkedAt && (
          <p className="nw__checked">
            {t.news.checked(formatDate(new Date(feed.checkedAt), t))}
          </p>
        )}

        <p className="nw__official">{t.news.official}</p>
        <div className="nw__links">
          {OFFICIAL_LINKS.map((l) => (
            <a
              key={l.key}
              className="btn btn--secondary btn--sm"
              href={l.url}
              target="_blank"
              rel="noopener noreferrer"
            >
              {t.news.links[l.key]}
            </a>
          ))}
        </div>

        <p className="nw__note">{t.news.disclaimer}</p>
      </div>
    </section>
  )
}
