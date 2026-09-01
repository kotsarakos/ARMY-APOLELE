import { useEffect, useMemo, useState } from 'react'
import { useProfile } from './hooks/useProfile'
import { useToday } from './hooks/useToday'
import { useI18n } from './hooks/useI18n'
import { useToast } from './hooks/useToast'
import { useAuth } from './hooks/useAuth'
import { useRoute } from './hooks/useRoute'
import { computeService, milestones } from './lib/service'
import { wipeDevice } from './lib/wipe'
import { Onboarding } from './components/Onboarding'
import { Countdown } from './components/Countdown'
import { Stats } from './components/Stats'
import { Leave } from './components/Leave'
import { Timeline } from './components/Timeline'
import { Agenda } from './components/Agenda'
import { Settings } from './components/Settings'
import { Account } from './components/Account'
import { Welcome } from './components/Welcome'
import { Money } from './components/Money'
import { Duty } from './components/Duty'
import { ShareCard } from './components/ShareCard'
import { Notifications } from './components/Notifications'
import { ProfileCard } from './components/ProfileCard'
import { InstallBanner } from './components/InstallBanner'
import { InstallGuide } from './components/InstallGuide'
import { Privacy } from './components/Privacy'
import { NotFound } from './components/NotFound'
import { upperGreek as caps } from './lib/greek'
import { TAB_ICONS } from './components/icons'
import { focusSection } from './lib/scroll'
import { NOTIFY_HOUR_EVENT, buildPlan, flushDue, savePlan, setBadge } from './lib/notify'

type Tab = 'clock' | 'leave' | 'duty' | 'money' | 'profile'

export default function App() {
  const { t, lang, setLang } = useI18n()
  const { route, navigate } = useRoute()
  const { profile, setProfile, update, updateWith, loading, syncing } = useProfile()
  const toast = useToast()
  const now = useToday()
  const [tab, setTab] = useState<Tab>('clock')
  const { user, ready: authReady, enabled: authEnabled } = useAuth()
  const [skippedAuth, setSkippedAuth] = useState(false)

  // Οι συντομεύσεις του εικονιδίου (long-press στο Android) ανοίγουν την
  // εφαρμογή σε `/?add=duty`. Διαβάζονται μία φορά και η παράμετρος
  // αφαιρείται, ώστε ένα refresh να μη σε ξαναπετάει στη φόρμα.
  useEffect(() => {
    const wanted = new URLSearchParams(window.location.search).get('add')
    const map: Record<string, Tab> = { duty: 'duty', leave: 'leave', money: 'money' }
    const target = wanted ? map[wanted] : undefined
    if (!target) return
    setTab(target)
    window.history.replaceState(null, '', window.location.pathname)
    // Η φόρμα υπάρχει μόλις αποδοθεί η καρτέλα.
    const id = setTimeout(() => focusSection(`add-${target}`), 120)
    return () => clearTimeout(id)
  }, [])

  const state = useMemo(
    () => (profile?.enlistDate ? computeService(profile, now) : null),
    [profile, now],
  )
  const ms = useMemo(() => (state ? milestones(state) : []), [state])

  // Η ώρα των ειδοποιήσεων είναι προτίμηση συσκευής και ζει εκτός React·
  // αυτός ο μετρητής ξαναχτίζει το πρόγραμμα όταν αλλάξει.
  const [hourTick, setHourTick] = useState(0)
  useEffect(() => {
    const bump = () => setHourTick((n) => n + 1)
    window.addEventListener(NOTIFY_HOUR_EVENT, bump)
    return () => window.removeEventListener(NOTIFY_HOUR_EVENT, bump)
  }, [])

  // Το εικονίδιο δείχνει τις μέρες που μένουν, και ό,τι ειδοποίηση ωρίμασε
  // εμφανίζεται τώρα. Το πρόγραμμα γράφεται ώστε να το βρει και ο service
  // worker όταν ξυπνήσει μόνος του, με την εφαρμογή κλειστή.
  useEffect(() => {
    if (!profile || !state) return
    setBadge(state.daysLeft)
    const plan = buildPlan(profile, state, t)
    void savePlan(plan)
    void flushDue(plan, now)
  }, [profile, state, t, now, hourTick])

  const header = (
    <header className="topbar">
      <button className="topbar__mark" onClick={() => navigate('/')}>
        {t.app.mark}
      </button>
      <div className="topbar__right">
        {profile?.unit && route === 'home' && (
          <span className="topbar__unit">{caps(profile.unit)}</span>
        )}
        {/* Και οι δύο γλώσσες φαίνονται πάντα: ένα κουμπί που δείχνει μόνο
            την άλλη δεν λέει ποτέ ξεκάθαρα αν είναι κατάσταση ή ενέργεια. */}
        <div className="langsw" role="group" aria-label={t.settings.language}>
          <button
            type="button"
            className={`langsw__b ${lang === 'el' ? 'langsw__b--on' : ''}`}
            aria-pressed={lang === 'el'}
            onClick={() => setLang('el')}
          >ΕΛ</button>
          <button
            type="button"
            className={`langsw__b ${lang === 'en' ? 'langsw__b--on' : ''}`}
            aria-pressed={lang === 'en'}
            onClick={() => setLang('en')}
          >EN</button>
        </div>
      </div>
    </header>
  )

  const footer = (
    <footer className="foot">
      <p>{t.app.disclaimer}</p>
      <div className="foot__links">
        <button className="foot__link" onClick={() => navigate('/privacy')}>
          {t.app.privacyLink}
        </button>
        <button className="foot__link" onClick={() => navigate('/install')}>
          {t.install.label}
        </button>
      </div>
    </footer>
  )

  if (route === 'notfound') {
    return (
      <main className="shell shell--center">
        {header}
        <NotFound onBack={() => navigate('/')} />
      </main>
    )
  }

  if (route === 'install') {
    return (
      <main className="shell">
        {header}
        <InstallGuide onBack={() => navigate('/')} />
      </main>
    )
  }

  if (route === 'privacy') {
    return (
      <main className="shell">
        {header}
        <Privacy onBack={() => navigate('/')} />
      </main>
    )
  }

  if (loading || (authEnabled && !authReady && !profile)) return <div className="boot" />

  if (!profile || !profile.enlistDate || !state) {
    // Νέος χρήστης, μη συνδεδεμένος: πρώτα η επιλογή σύνδεσης.
    if (authEnabled && !user && !skippedAuth) {
      return (
        <main className="shell">
          {header}
          <Welcome onSkip={() => setSkippedAuth(true)} />
          {footer}
        </main>
      )
    }
    return (
      <main className="shell">
        {header}
        <Onboarding onDone={setProfile} />
        {footer}
      </main>
    )
  }

  const reset = () => {
    // Καθαρίζει και τις ειδοποιήσεις: το πρόγραμμά τους κρατά ημερομηνίες
    // αδειών και υπηρεσιών, που είναι εξίσου προσωπικά με το προφίλ.
    void wipeDevice().then((ok) => {
      if (!ok) {
        toast.error(t.errors.storage)
        return
      }
      toast.success(t.settings.okReset)
      setTimeout(() => window.location.reload(), 700)
    })
  }

  return (
    <main className="shell">
      {header}

      {tab === 'clock' && (
        <>
          <Countdown state={state} name={profile.name} />
          <Stats state={state} />
          <Agenda profile={profile} state={state} />
          <Timeline items={ms} months={profile.months} state={state} />
          <ShareCard profile={profile} state={state} />
        </>
      )}

      {tab === 'leave' && (
        <Leave state={state} profile={profile} update={update} updateWith={updateWith} />
      )}

      {tab === 'duty' && (
        <Duty profile={profile} service={state} update={update} updateWith={updateWith} />
      )}

      {tab === 'money' && (
        <Money profile={profile} service={state} update={update} updateWith={updateWith} />
      )}

      {tab === 'profile' && (
        <>
          <ProfileCard
            profile={profile} service={state}
            update={update} updateWith={updateWith}
          />
          <Notifications />
          <Account syncing={syncing} profile={profile} />
          <Settings
            profile={profile}
            service={state}
            update={update}
            onReset={reset}
            onRestore={setProfile}
          />
        </>
      )}

      <nav className="tabs" aria-label={t.tabsNav}>
        {(['clock', 'leave', 'duty', 'money', 'profile'] as Tab[]).map((k) => {
          const Icon = TAB_ICONS[k]
          return (
            <button
              key={k}
              data-tab={k}
              className={tab === k ? 'tabs__b tabs__b--on' : 'tabs__b'}
              aria-current={tab === k ? 'page' : undefined}
              onClick={() => setTab(k)}
            >
              <Icon />
              <span className="tabs__t">{caps(t.tabs[k])}</span>
            </button>
          )
        })}
      </nav>

      {footer}
      <InstallBanner onOpenGuide={() => navigate('/install')} />
    </main>
  )
}
