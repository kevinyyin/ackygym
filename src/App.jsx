import { useEffect, useState } from 'react'
import { Routes, Route, NavLink, useLocation } from 'react-router-dom'
import { supabase } from './supabaseClient'
import Auth from './Auth'
import Home from './Home'
import CalendarPage from './CalendarPage'
import LiftsPage from './LiftsPage'
import BodyWeightPage from './BodyWeightPage'
import ProgressPhotosPage from './ProgressPhotosPage'
import TimerPage from './TimerPage'
import SettingsModal from './SettingsModal'
import { displayName } from './displayName'
import { loadCardVisibility, saveCardVisibility } from './cardVisibility'
import { useRestTimer } from './useRestTimer'
import {
  GridIcon,
  CalendarIcon,
  BarbellIcon,
  ScaleIcon,
  CameraIcon,
  TimerIcon,
  LogOutIcon,
  SunIcon,
  MoonIcon,
  SettingsIcon,
} from './icons'

const PAGE_TITLES = {
  '/': 'Home',
  '/calendar': 'Calendar',
  '/lifts': 'Lifts',
  '/weight': 'Weight',
  '/photos': 'Photos',
  '/timer': 'Timer',
}

const TABS = [
  { to: '/', label: 'Home', icon: GridIcon, end: true },
  { to: '/calendar', label: 'Calendar', icon: CalendarIcon },
  { to: '/lifts', label: 'Lifts', icon: BarbellIcon },
  { to: '/weight', label: 'Weight', icon: ScaleIcon },
  { to: '/photos', label: 'Photos', icon: CameraIcon },
  { to: '/timer', label: 'Timer', icon: TimerIcon },
]

function App() {
  const [session, setSession] = useState(null)
  const [profiles, setProfiles] = useState([])
  const [schedule, setSchedule] = useState([])
  const [error, setError] = useState('')
  const [scheduleVersion, setScheduleVersion] = useState(0)
  const [profilesVersion, setProfilesVersion] = useState(0)
  const [theme, setTheme] = useState(() => localStorage.getItem('theme') || 'dark')
  const [cardVisibility, setCardVisibility] = useState(loadCardVisibility)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [isOnline, setIsOnline] = useState(() => navigator.onLine)
  const location = useLocation()
  const restTimer = useRestTimer()

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
    localStorage.setItem('theme', theme)
  }, [theme])

  useEffect(() => {
    function handleOnline() {
      setIsOnline(true)
    }
    function handleOffline() {
      setIsOnline(false)
    }
    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)
    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])

  // Route every page's onError through here so a dropped connection reads
  // as "you're offline," not as whatever raw fetch/Supabase error surfaces —
  // `navigator.onLine` catches a device with no network at all, and the
  // message pattern catches the common case of a flaky connection where the
  // browser still thinks it's online but the request itself failed to reach
  // the server.
  function handleError(message) {
    if (!message) {
      setError('')
      return
    }
    const looksLikeNetworkFailure = /failed to fetch|network ?error|load failed/i.test(message)
    setError(
      !navigator.onLine || looksLikeNetworkFailure
        ? "You're offline — check your connection and try again."
        : message
    )
  }

  function toggleCardVisibility(key) {
    setCardVisibility((current) => {
      const next = { ...current, [key]: !current[key] }
      saveCardVisibility(next)
      return next
    })
  }

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setSession(session)
      }
    )

    return () => subscription.unsubscribe()
  }, [])

  useEffect(() => {
    if (!session) return

    async function fetchProfiles() {
      const { data, error } = await supabase.from('profiles').select('id, email, username')
      if (error) {
        handleError(error.message)
        return
      }
      setProfiles(data)
    }

    fetchProfiles()
  }, [session, profilesVersion])

  useEffect(() => {
    if (!session) return

    async function fetchSchedule() {
      const { data, error } = await supabase
        .from('schedule')
        .select('id, user_id, day_of_week, routine_id, routines(name)')

      if (error) {
        handleError(error.message)
        return
      }
      setSchedule(data)
    }

    fetchSchedule()
  }, [session, scheduleVersion])

  if (!session) {
    return <Auth />
  }

  const pageTitle = PAGE_TITLES[location.pathname] ?? 'Gym Tracker'
  const currentProfile = profiles.find((p) => p.id === session.user.id)

  return (
    <div className="min-h-svh bg-ink text-chalk">
      <div className="mx-auto flex min-h-svh max-w-md flex-col gap-6 px-4 pb-28 pt-6">
        <header className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="mb-1 text-[11px] font-semibold tracking-[0.3em] text-blue-400 uppercase">
              Ackygym
            </p>
            <h1 className="font-display text-4xl leading-none tracking-tight text-chalk uppercase">
              {pageTitle}
            </h1>
            <p className="truncate font-mono text-xs text-chalk-dim">
              {currentProfile ? displayName(currentProfile) : ''}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <button
              onClick={() => setSettingsOpen(true)}
              aria-label="Settings"
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md border border-line bg-surface text-chalk-dim active:border-blue-500 active:text-blue-400"
            >
              <SettingsIcon className="h-5 w-5" />
            </button>
            <button
              onClick={() => setTheme((t) => (t === 'dark' ? 'light' : 'dark'))}
              aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md border border-line bg-surface text-chalk-dim active:border-blue-500 active:text-blue-400"
            >
              {theme === 'dark' ? <SunIcon className="h-5 w-5" /> : <MoonIcon className="h-5 w-5" />}
            </button>
            <button
              onClick={() => supabase.auth.signOut()}
              aria-label="Sign out"
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md border border-line bg-surface text-chalk-dim active:border-blue-500 active:text-blue-400"
            >
              <LogOutIcon className="h-5 w-5" />
            </button>
          </div>
        </header>

        {!isOnline && (
          <p className="rounded-md border border-amber/40 bg-amber/10 px-4 py-3 text-sm text-amber">
            You're offline. Changes won't save until your connection is back.
          </p>
        )}

        {error && (
          <p className="rounded-md border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-danger">
            {error}
          </p>
        )}

        <Routes>
          <Route
            path="/"
            element={
              <Home
                session={session}
                profiles={profiles}
                schedule={schedule}
                onScheduleSaved={() => setScheduleVersion((v) => v + 1)}
                onError={handleError}
                showWaterTracker={cardVisibility.water}
              />
            }
          />
          <Route
            path="/calendar"
            element={
              <CalendarPage
                profiles={profiles}
                userId={session.user.id}
                onError={handleError}
              />
            }
          />
          <Route
            path="/lifts"
            element={
              <LiftsPage
                profiles={profiles}
                userId={session.user.id}
                onError={handleError}
              />
            }
          />
          <Route
            path="/weight"
            element={
              <BodyWeightPage
                profiles={profiles}
                userId={session.user.id}
                onError={handleError}
                showCalorieTracker={cardVisibility.calorie}
                showCalorieTracking={cardVisibility.calorieTracker}
              />
            }
          />
          <Route
            path="/photos"
            element={
              <ProgressPhotosPage
                profiles={profiles}
                userId={session.user.id}
                onError={handleError}
              />
            }
          />
          <Route
            path="/timer"
            element={
              <TimerPage
                duration={restTimer.duration}
                remaining={restTimer.remaining}
                status={restTimer.status}
                selectDuration={restTimer.selectDuration}
                onStart={restTimer.start}
                onPause={restTimer.pause}
                onReset={restTimer.reset}
              />
            }
          />
        </Routes>
      </div>

      <nav className="fixed inset-x-0 bottom-0 border-t border-line bg-surface/95 shadow-[0_-12px_28px_-18px_var(--shadow-tint)] backdrop-blur">
        <div className="mx-auto flex max-w-md items-stretch justify-around px-2 pb-[calc(env(safe-area-inset-bottom)+0.625rem)]">
          {TABS.map(({ to, label, icon: Icon, end }) => (
            <NavLink key={to} to={to} end={end} aria-label={label} className="px-3 pt-2.5 pb-3">
              {({ isActive }) => (
                <span
                  className={`relative flex flex-col items-center gap-2 transition-colors ${
                    isActive ? 'text-blue-400' : 'text-chalk-dim'
                  }`}
                >
                  <Icon className="h-5 w-5" />
                  {to === '/timer' && restTimer.status === 'running' && !isActive && (
                    <span
                      aria-hidden="true"
                      className="absolute -top-0.5 -right-1 h-1.5 w-1.5 rounded-full bg-blue-500 motion-safe:animate-pulse"
                    />
                  )}
                  <span
                    className={`h-[2px] w-4 rounded-full transition-colors ${isActive ? 'bg-blue-500' : 'bg-transparent'}`}
                  />
                </span>
              )}
            </NavLink>
          ))}
        </div>
      </nav>

      <SettingsModal
        open={settingsOpen}
        visibility={cardVisibility}
        onToggle={toggleCardVisibility}
        onClose={() => setSettingsOpen(false)}
        profile={currentProfile}
        userId={session.user.id}
        onProfileSaved={() => setProfilesVersion((v) => v + 1)}
        onError={handleError}
      />
    </div>
  )
}

export default App
