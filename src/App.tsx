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
import { Announcements } from './components/Announcements'
import { ProfileCard } from './components/ProfileCard'
import { InstallBanner } from './components/InstallBanner'
import { InstallGuide } from './components/InstallGuide'
import { Privacy } from './components/Privacy'
import { NotFound } from './components/NotFound'
import { upperGreek as caps } from './lib/greek'
import { TAB_ICONS } from './components/icons'
import { focusSection } from './lib/scroll'
import { localAnnouncements, unreadCount } from './lib/announcements'
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

  // The home-screen shortcuts (long-press on Android) open the app at
  // `/?add=duty`. They are read once and the parameter removed, so a refresh
  // does not throw you back into the form.
  useEffect(() => {
    const wanted = new URLSearchParams(window.location.search).get('add')
    const map: Record<string, Tab> = { duty: 'duty', leave: 'leave', money: 'money' }
    const target = wanted ? map[wanted] : undefined
    if (!target) return
    setTab(target)
    window.history.replaceState(null, '', window.location.pathname)
    // The form exists as soon as the tab has rendered.
    const id = setTimeout(() => focusSection(`add-${target}`), 120)
    return () => clearTimeout(id)
  }, [])

  const state = useMemo(
    () => (profile?.enlistDate ? computeService(profile, now) : null),
    [profile, now],
  )
  const ms = useMemo(() => (state ? milestones(state) : []), [state])

  // How many announcements have appeared since the last visit. Read from the
  // file shipped with the build only — same origin, no outbound request; the
  // network refresh happens only when the section is opened.
  const [unread, setUnread] = useState(0)
  useEffect(() => {
    let cancelled = false
    void localAnnouncements().then((feed) => {
      if (!cancelled && feed) setUnread(unreadCount(feed.items))
    })
    return () => { cancelled = true }
  }, [])

  // The notification hour is a device preference and lives outside React;
  // this counter rebuilds the plan whenever it changes.
  const [hourTick, setHourTick] = useState(0)
  useEffect(() => {
    const bump = () => setHourTick((n) => n + 1)
    window.addEventListener(NOTIFY_HOUR_EVENT, bump)
    return () => window.removeEventListener(NOTIFY_HOUR_EVENT, bump)
  }, [])

  // The icon shows the days remaining, and anything due appears now. The plan
  // is written where the service worker can find it when it wakes on its own,
  // with the app closed.
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
        {/* Both languages are always visible: a single button showing only
            the other one never makes clear whether it is a state or an
            action. */}
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
    // A new visitor, not signed in: the sign-in choice comes first.
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
    // Notifications are cleared too: their plan holds leave and duty dates,
    // which are every bit as personal as the profile.
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
          <Announcements />
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
              {k === 'profile' && unread > 0 && (
                <span className="tabs__dot" title={t.news.unread(unread)}>
                  <span className="visually-hidden">{t.news.unread(unread)}</span>
                </span>
              )}
            </button>
          )
        })}
      </nav>

      {footer}
      <InstallBanner onOpenGuide={() => navigate('/install')} />
    </main>
  )
}
