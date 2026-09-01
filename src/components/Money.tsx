import { useState } from 'react'
import type { Expense, Profile, ExpenseCategory } from '../lib/types'
import type { ServiceState } from '../lib/service'
import {
  CATEGORIES, computeMoney, formatMoney, isFromRecurring, newExpense,
  newRecurring, parseAmount, recentFirst,
} from '../lib/money'
import { deletion } from '../lib/merge'
import { formatShort, parseISO, toISO, today } from '../lib/dates'
import { focusSection } from '../lib/scroll'
import { DateField } from './DateField'
import { upperGreek as caps } from '../lib/greek'
import { useI18n } from '../hooks/useI18n'
import { useToast } from '../hooks/useToast'

/** A payday within three days is worth setting apart. */
const SOON_DAYS = 3

export function Money({
  profile, service, update, updateWith,
}: {
  profile: Profile
  service: ServiceState
  update: (patch: Partial<Profile>) => void
  updateWith: (build: (prev: Profile) => Partial<Profile>) => void
}) {
  const { t, lang } = useI18n()
  const toast = useToast()
  const m = computeMoney(profile, service)
  const iso = toISO(today())

  const [amount, setAmount] = useState('')
  const [category, setCategory] = useState<ExpenseCategory>('canteen')
  const [note, setNote] = useState('')
  const [date, setDate] = useState(iso)
  const [startingDraft, setStartingDraft] = useState('')
  const [budgetDraft, setBudgetDraft] = useState('')

  // Editing an existing expense, one at a time.
  const [editing, setEditing] = useState<string | null>(null)
  const [draft, setDraft] = useState({ amount: '', category: 'canteen' as ExpenseCategory, date: iso, note: '' })

  const [recOpen, setRecOpen] = useState(false)
  const [recAmount, setRecAmount] = useState('')
  const [recCategory, setRecCategory] = useState<ExpenseCategory>('phone')
  const [recDay, setRecDay] = useState('1')
  const [recNote, setRecNote] = useState('')

  const money = (c: number) => formatMoney(c, lang)

  const addExpense = () => {
    const cents = parseAmount(amount)
    if (cents === null) return toast.error(t.money.errAmount)
    if (cents === 0) return toast.error(t.money.errZero)
    if (!date) return toast.error(t.money.errDate)
    update({ expenses: [...profile.expenses, newExpense(cents, category, note, date)] })
    setAmount(''); setNote(''); setDate(iso)
    toast.success(t.money.okAdded)
  }

  const removeExpense = (id: string) => {
    const del = deletion(profile, [id])
    update(del.patch)
    toast.undoable(t.money.okDeleted, t.common.undo, () => updateWith(del.restore))
  }

  const startEdit = (e: Expense) => {
    setEditing(e.id)
    setDraft({
      amount: (e.amount / 100).toFixed(2).replace('.', lang === 'el' ? ',' : '.'),
      category: e.category,
      date: e.date,
      note: e.note ?? '',
    })
  }

  const saveEdit = (id: string) => {
    const cents = parseAmount(draft.amount)
    if (cents === null) return toast.error(t.money.errAmount)
    if (cents === 0) return toast.error(t.money.errZero)
    if (!draft.date) return toast.error(t.money.errDate)
    update({
      expenses: profile.expenses.map((e) =>
        e.id === id
          ? { ...e, amount: cents, category: draft.category, date: draft.date, note: draft.note.trim() || undefined }
          : e),
    })
    setEditing(null)
    toast.success(t.money.okEdited)
  }

  const saveStarting = () => {
    const cents = parseAmount(startingDraft)
    if (cents === null) return toast.error(t.money.errAmount)
    update({ startingBalance: cents })
    setStartingDraft('')
    toast.success(t.money.okStarting)
  }

  const addRecurring = () => {
    const cents = parseAmount(recAmount)
    if (cents === null) return toast.error(t.money.errAmount)
    if (cents === 0) return toast.error(t.money.errZero)
    const day = Number(recDay)
    if (!Number.isInteger(day) || day < 1 || day > 28) return toast.error(t.money.errDay)
    update({ recurring: [...profile.recurring, newRecurring(cents, recCategory, day, recNote)] })
    setRecAmount(''); setRecNote('')
    toast.success(t.money.okRecurringAdded)
  }

  /** A recurring charge leaves with everything it charged, or orphans remain. */
  const removeRecurring = (id: string) => {
    const ids = [id, ...profile.expenses.filter((e) => isFromRecurring(e, id)).map((e) => e.id)]
    const del = deletion(profile, ids)
    update(del.patch)
    toast.undoable(t.money.okRecurringDeleted, t.common.undo, () => updateWith(del.restore))
  }

  const saveBudget = () => {
    const cents = parseAmount(budgetDraft)
    if (cents === null) return toast.error(t.money.errAmount)
    update({ monthlyBudget: cents })
    setBudgetDraft('')
    toast.success(cents > 0 ? t.money.okBudget : t.money.okBudgetCleared)
  }

  const clearBudget = () => {
    update({ monthlyBudget: 0 })
    setBudgetDraft('')
    toast.success(t.money.okBudgetCleared)
  }

  return (
    <>
      {/* The balance plays the part of the "clock" on this screen. */}
      <section className={`clock ${m.balance < 0 ? 'clock--signal' : 'clock--olive'}`}>
        <p className="eyebrow">{caps(t.money.balance)}</p>
        <div className="clock__figure">
          <span className="clock__num num">{money(m.balance)}</span>
        </div>
        <div className="mn__split">
          <span><em>{caps(t.money.starting)}</em><strong className="num">{money(m.starting)}</strong></span>
          <span><em>{caps(t.money.earned)}</em><strong className="num">{money(m.earned)}</strong></span>
          <span><em>{caps(t.money.spent)}</em><strong className="num">{m.spent > 0 ? '−' : ''}{money(m.spent)}</strong></span>
        </div>
      </section>

      {m.willRunOut && (
        <div className="mn__warn" role="alert">
          <p className="mn__warnt">{t.money.warnTitle}</p>
          <p className="mn__warnb">{t.money.warnBody}</p>
        </div>
      )}

      <section className="band">
        <p className="eyebrow band__label">{caps(t.money.label)}</p>
        <div className="tiles">
          <div className="tile">
            <p className="eyebrow">{caps(t.money.projected)}</p>
            <p className={`tile__value num ${m.projected < 0 ? 'tile__value--warn' : ''}`}>
              {money(m.projected)}
            </p>
            <p className="tile__hint">{t.money.projectedHint}</p>
          </div>
          <div className="tile">
            <p className="eyebrow">{caps(t.money.allowance)}</p>
            <p className="tile__value num">{money(m.dailyAllowance)}</p>
            <p className="tile__hint">{t.money.allowanceHint}</p>
          </div>
          <div className="tile">
            <p className="eyebrow">{caps(t.money.dailyBurn)}</p>
            <p className="tile__value num">{money(m.dailyBurn)}</p>
            <p className="tile__hint">{t.money.monthlyBurn}: {money(m.monthlyBurn)}</p>
          </div>
          <div className={`tile ${service.pay.daysToPay <= SOON_DAYS ? 'tile--soon' : ''}`}>
            <p className="eyebrow">{caps(t.money.payday)}</p>
            <p className="tile__value num">{money(service.pay.perMonth * 100)}</p>
            <p className="tile__hint">
              {t.money.paydayIn(service.pay.daysToPay)} · {formatShort(service.pay.nextPayDate)}
            </p>
          </div>
        </div>
      </section>

      {/* Their own money */}
      <section className="band">
        <p className="eyebrow band__label">{caps(t.money.starting)}</p>
        <div className="panel mn__start">
          <p className="mn__starthint">{t.money.startingHint}</p>
          <p className="mn__startnow num">{money(m.starting)}</p>
          <div className="mn__startrow">
            <input
              className="input input--sm"
              type="text" inputMode="decimal"
              placeholder={t.money.amountPlaceholder}
              value={startingDraft}
              onChange={(e) => setStartingDraft(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && saveStarting()}
              aria-label={t.money.setStarting}
            />
            <button className="btn btn--secondary btn--sm" onClick={saveStarting}>
              {t.money.setStartingCta}
            </button>
          </div>
        </div>
      </section>

      {/* Monthly limit — their decision, not an army rule. */}
      <section className="band">
        <p className="eyebrow band__label">{caps(t.money.budgetTitle)}</p>
        <div className={`panel bd ${m.budget.over ? 'bd--over' : ''}`}>
          <p className="mn__starthint">{t.money.budgetHint}</p>

          {m.budget.set ? (
            <>
              <div className="bd__nums">
                <div>
                  <p className="eyebrow">{caps(t.money.budgetSpent)}</p>
                  <p className="bd__big num">{money(m.budget.spent)}</p>
                </div>
                <div className="bd__right">
                  <p className="eyebrow">
                    {caps(m.budget.over ? t.money.budgetOver : t.money.budgetLeft)}
                  </p>
                  <p className={`bd__big num ${m.budget.over ? 'bd__big--over' : ''}`}>
                    {money(Math.abs(m.budget.left))}
                  </p>
                </div>
              </div>

              <div className="progress__track" role="presentation">
                <div
                  className={`progress__fill ${m.budget.over ? 'progress__fill--over' : 'progress__fill--signal'}`}
                  style={{ width: `${Math.round(m.budget.share * 100)}%` }}
                />
              </div>

              <p className="bd__note">
                {m.budget.over
                  ? t.money.budgetOverBody(money(-m.budget.left))
                  : t.money.budgetPerDay(money(m.budget.perDay), m.budget.daysLeftInMonth)}
              </p>
            </>
          ) : (
            <p className="mn__empty">{t.money.budgetNone}</p>
          )}

          <div className="mn__startrow">
            <input
              className="input input--sm"
              type="text" inputMode="decimal"
              placeholder={t.money.amountPlaceholder}
              value={budgetDraft}
              onChange={(e) => setBudgetDraft(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && saveBudget()}
              aria-label={t.money.budgetSet}
            />
            <button className="btn btn--secondary btn--sm" onClick={saveBudget}>
              {t.money.budgetSet}
            </button>
            {m.budget.set && (
              <button className="btn btn--ghost btn--sm" onClick={clearBudget}>
                {t.money.budgetClear}
              </button>
            )}
          </div>
        </div>
      </section>

      {/* New expense */}
      <section className="band" id="add-money">
        <p className="eyebrow band__label">{caps(t.money.addTitle)}</p>
        <div className="panel mn__add">
          <div className="mn__addrow">
            <label className="mn__f mn__f--amt">
              <span className="eyebrow">{caps(t.money.amount)}</span>
              <input
                className="input" type="text" inputMode="decimal"
                placeholder={t.money.amountPlaceholder}
                value={amount} onChange={(e) => setAmount(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && addExpense()}
              />
            </label>
            <label className="mn__f">
              <span className="eyebrow">{caps(t.money.category)}</span>
              <select
                className="input"
                value={category}
                onChange={(e) => setCategory(e.target.value as ExpenseCategory)}
              >
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>{t.money.categories[c]}</option>
                ))}
              </select>
            </label>
          </div>
          <div className="mn__f">
            <span className="eyebrow">{caps(t.money.date)}</span>
            <DateField label={t.money.date} value={date} onChange={setDate} />
            <span className="mn__fhint">{t.money.dateHint}</span>
          </div>
          <label className="mn__f">
            <span className="eyebrow">{caps(t.money.note)}</span>
            <input
              className="input" type="text"
              placeholder={t.money.notePlaceholder}
              value={note} onChange={(e) => setNote(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && addExpense()}
            />
          </label>
          <button className="btn btn--primary btn--block" onClick={addExpense}>
            {t.money.add}
          </button>
        </div>
      </section>

      {/* Recurring charges — they post themselves */}
      <section className="band">
        <p className="eyebrow band__label">{caps(t.money.recurringTitle)}</p>
        <div className="panel mn__rec">
          <p className="mn__starthint">{t.money.recurringHint}</p>

          {profile.recurring.length === 0 ? (
            <p className="mn__empty">{t.money.recurringEmpty}</p>
          ) : (
            <>
              <ul className="mn__reclist">
                {profile.recurring.map((r) => (
                  <li key={r.id} className="mn__recitem">
                    <div className="mn__itext">
                      <p className="mn__icat">{t.money.categories[r.category]}</p>
                      <p className="mn__imeta">
                        {t.money.recurringEvery(r.day)}{r.note && <> · {r.note}</>}
                      </p>
                    </div>
                    <span className="mn__iamt num">−{money(r.amount)}</span>
                    <button className="mn__idel" onClick={() => removeRecurring(r.id)}
                            aria-label={`${t.money.delete}: ${t.money.categories[r.category]}`}>×</button>
                  </li>
                ))}
              </ul>
              <p className="mn__rectotal">
                <span>{t.money.recurringTotal}</span>
                <strong className="num">−{money(m.recurringMonthly)}</strong>
              </p>
            </>
          )}

          {recOpen ? (
            <div className="mn__recform">
              <div className="mn__addrow">
                <label className="mn__f mn__f--amt">
                  <span className="eyebrow">{caps(t.money.amount)}</span>
                  <input className="input" type="text" inputMode="decimal"
                         placeholder={t.money.amountPlaceholder}
                         value={recAmount} onChange={(e) => setRecAmount(e.target.value)} />
                </label>
                <label className="mn__f">
                  <span className="eyebrow">{caps(t.money.recurringDay)}</span>
                  <input className="input" type="number" min={1} max={28} inputMode="numeric"
                         value={recDay} onChange={(e) => setRecDay(e.target.value)} />
                </label>
              </div>
              <div className="mn__addrow">
                <label className="mn__f">
                  <span className="eyebrow">{caps(t.money.category)}</span>
                  <select className="input" value={recCategory}
                          onChange={(e) => setRecCategory(e.target.value as ExpenseCategory)}>
                    {CATEGORIES.map((c) => (
                      <option key={c} value={c}>{t.money.categories[c]}</option>
                    ))}
                  </select>
                </label>
                <label className="mn__f">
                  <span className="eyebrow">{caps(t.money.note)}</span>
                  <input className="input" type="text" value={recNote}
                         onChange={(e) => setRecNote(e.target.value)}
                         onKeyDown={(e) => e.key === 'Enter' && addRecurring()} />
                </label>
              </div>
              <div className="mn__recbtns">
                <button className="btn btn--primary btn--sm" onClick={addRecurring}>
                  {t.money.add}
                </button>
                <button className="btn btn--ghost btn--sm" onClick={() => setRecOpen(false)}>
                  {t.money.cancel}
                </button>
              </div>
            </div>
          ) : (
            <button className="btn btn--secondary btn--sm" onClick={() => setRecOpen(true)}>
              {t.money.recurringAdd}
            </button>
          )}
        </div>
      </section>

      {/* Breakdown by category */}
      {m.byCategory.length > 0 && (
        <section className="band">
          <p className="eyebrow band__label">{caps(t.money.breakdown)}</p>
          <div className="panel mn__cats">
            {m.byCategory.map((c) => (
              <div key={c.category} className="mn__cat">
                <div className="mn__catrow">
                  <span>{t.money.categories[c.category]}</span>
                  <strong className="num">{money(c.total)}</strong>
                </div>
                <div className="progress__track">
                  <div className="progress__fill" style={{ width: `${Math.round(c.share * 100)}%` }} />
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Recent expenses */}
      <section className="band">
        <p className="eyebrow band__label">{caps(t.money.recent)}</p>
        {profile.expenses.length === 0 ? (
          <div className="panel empty">
            <p className="empty__text">{t.money.empty}</p>
            <button className="btn btn--secondary btn--sm"
                    onClick={() => focusSection('add-money')}>
              {t.money.emptyCta}
            </button>
          </div>
        ) : (
          <ul className="mn__list">
            {recentFirst(profile.expenses).slice(0, 20).map((e) => (
              <li key={e.id} className="panel mn__item">
                {editing === e.id ? (
                  <div className="mn__edit">
                    <div className="mn__addrow">
                      <label className="mn__f mn__f--amt">
                        <span className="eyebrow">{caps(t.money.amount)}</span>
                        <input className="input input--sm" type="text" inputMode="decimal"
                               value={draft.amount}
                               onChange={(ev) => setDraft({ ...draft, amount: ev.target.value })} />
                      </label>
                      <div className="mn__f">
                        <span className="eyebrow">{caps(t.money.date)}</span>
                        <DateField
                          label={t.money.date}
                          value={draft.date}
                          onChange={(v) => setDraft({ ...draft, date: v })}
                        />
                      </div>
                    </div>
                    <div className="mn__addrow">
                      <label className="mn__f">
                        <span className="eyebrow">{caps(t.money.category)}</span>
                        <select className="input input--sm" value={draft.category}
                                onChange={(ev) => setDraft({ ...draft, category: ev.target.value as ExpenseCategory })}>
                          {CATEGORIES.map((c) => (
                            <option key={c} value={c}>{t.money.categories[c]}</option>
                          ))}
                        </select>
                      </label>
                      <label className="mn__f">
                        <span className="eyebrow">{caps(t.money.note)}</span>
                        <input className="input input--sm" type="text" value={draft.note}
                               onChange={(ev) => setDraft({ ...draft, note: ev.target.value })}
                               onKeyDown={(ev) => ev.key === 'Enter' && saveEdit(e.id)} />
                      </label>
                    </div>
                    <div className="mn__recbtns">
                      <button className="btn btn--primary btn--sm" onClick={() => saveEdit(e.id)}>
                        {t.money.save}
                      </button>
                      <button className="btn btn--ghost btn--sm" onClick={() => setEditing(null)}>
                        {t.money.cancel}
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="mn__itext">
                      <p className="mn__icat">{t.money.categories[e.category]}</p>
                      <p className="mn__imeta">
                        <span className="num">{formatShort(parseISO(e.date))}</span>
                        {e.note && <> · {e.note}</>}
                      </p>
                    </div>
                    <span className="mn__iamt num">−{money(e.amount)}</span>
                    <button
                      className="mn__iedit"
                      onClick={() => startEdit(e)}
                      aria-label={`${t.money.edit}: ${t.money.categories[e.category]}`}
                    >✎</button>
                    <button
                      className="mn__idel"
                      onClick={() => removeExpense(e.id)}
                      aria-label={`${t.money.delete}: ${t.money.categories[e.category]}`}
                    >×</button>
                  </>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  )
}
