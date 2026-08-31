import type { Milestone } from '../lib/service'
import { formatDate } from '../lib/dates'
import { useI18n } from '../hooks/useI18n'
import { upperGreek as caps } from '../lib/greek'

export function Milestones({ items, months }: { items: Milestone[]; months: number }) {
  const { t } = useI18n()

  return (
    <section className="band">
      <p className="eyebrow band__label">{caps(t.milestones.label)}</p>
      <ol className="ms">
        {items.map((m) => {
          const entry = t.milestones.items[m.key]
          const detail = typeof entry.detail === 'function'
            ? entry.detail(months)
            : entry.detail
          const when = m.done
            ? t.milestones.done
            : m.daysAway === 0
              ? t.milestones.today
              : t.milestones.inDays(m.daysAway)

          return (
            <li key={m.key} className={`ms__item ${m.done ? 'ms__item--done' : ''}`}>
              <span className="ms__dot" aria-hidden="true" />
              <div className="ms__body">
                <div className="ms__line">
                  <span className="ms__label">{entry.label}</span>
                  <span className="ms__when num">{when}</span>
                </div>
                <p className="ms__detail">
                  {detail} · <span className="num">{formatDate(m.date, t)}</span>
                </p>
              </div>
            </li>
          )
        })}
      </ol>
    </section>
  )
}
