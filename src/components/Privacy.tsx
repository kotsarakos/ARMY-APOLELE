import { useI18n } from '../hooks/useI18n'
import { upperGreek as caps } from '../lib/greek'

export function Privacy({ onBack }: { onBack: () => void }) {
  const { t } = useI18n()

  return (
    <article className="page">
      <p className="eyebrow">{caps(t.privacy.updated)}</p>
      <h1 className="page__title">{t.privacy.title}</h1>
      <p className="page__intro">{t.privacy.intro}</p>

      <div className="page__body">
        {t.privacy.sections.map((s) => (
          <section key={s.h} className="panel page__section">
            <h2 className="page__h2">{s.h}</h2>
            <p className="page__p">{s.p}</p>
          </section>
        ))}
      </div>

      <button className="btn btn--secondary btn--block" onClick={onBack}>
        {t.app.backHome}
      </button>
    </article>
  )
}
