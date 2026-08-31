import { useI18n } from '../hooks/useI18n'

export function NotFound({ onBack }: { onBack: () => void }) {
  const { t } = useI18n()

  return (
    <div className="notfound">
      <p className="notfound__code num">{t.notFound.code}</p>
      <h1 className="notfound__title">{t.notFound.title}</h1>
      <p className="notfound__sub">{t.notFound.sub}</p>
      <button className="btn btn--primary" onClick={onBack}>
        {t.notFound.cta}
      </button>
    </div>
  )
}
