import { useEffect, useState } from 'react'
import type { AnnouncementFeed } from '../lib/announcements'
import {
  OFFICIAL_LINKS, lastSeen, localAnnouncements, markSeen, refreshAnnouncements,
} from '../lib/announcements'
import { formatDate, parseISO } from '../lib/dates'
import { useI18n } from '../hooks/useI18n'
import { upperGreek as caps } from '../lib/greek'

/** How many to show. More than this becomes an archive, and we are not one. */
const SHOWN = 4

/**
 * Announcements from the recruitment service.
 *
 * This is a copy, not the source: every title leads to the official page, and
 * the date it was last checked is always visible. The app is unaffiliated, so
 * it must not look like an official channel — least of all when the content is
 * about deadlines.
 */
export function Announcements() {
  const { t } = useI18n()
  const [feed, setFeed] = useState<AnnouncementFeed | null>(null)
  const [seen] = useState(lastSeen)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false

    void (async () => {
      // Whatever is already here first: the screen fills without waiting on the network.
      const local = await localAnnouncements()
      if (cancelled) return
      if (local) setFeed(local)
      setLoading(false)

      // Then, and only once the section is open, a check for something newer.
      const fresh = await refreshAnnouncements(local)
      if (!cancelled && fresh) setFeed(fresh)
    })()

    return () => { cancelled = true }
  }, [])

  // Marked as seen after the list has been looked at, not the moment it loads:
  // otherwise "new" would disappear before it could be read.
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
                {/* The badge sits on the date line rather than inside the
                    title: with a two-line title it landed sometimes beside it
                    and sometimes below, depending on where the text broke. */}
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
