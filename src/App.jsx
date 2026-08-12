import { useEffect, useState } from 'react'
import { Routes, Route, NavLink, useLocation } from 'react-router-dom'
import { supabase } from './supabaseClient'
import Auth from './Auth'
import Home from './Home'
import CalendarPage from './CalendarPage'
import LiftsPage from './LiftsPage'
import BodyWeightPage from './BodyWeightPage'
import TimerPage from './TimerPage'
import UsernameField from './UsernameField'
import {
  GridIcon,
  CalendarIcon,
  BarbellIcon,
  ScaleIcon,
  TimerIcon,
  LogOutIcon,
  SunIcon,
  MoonIcon,
} from './icons'

const PAGE_TITLES = {
  '/': 'Home',
  '/calendar': 'Calendar',
  '/lifts': 'Lifts',
  '/weight': 'Weight',
  '/timer': 'Timer',
}

const TABS = [
  { to: '/', label: 'Home', icon: GridIcon, end: true },
  { to: '/calendar', label: 'Calendar', icon: CalendarIcon },
  { to: '/lifts', label: 'Lifts', icon: BarbellIcon },
  { to: '/weight', label: 'Weight', icon: ScaleIcon },
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
  const location = useLocation()

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
    localStorage.setItem('theme', theme)
  }, [theme])

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
        setError(error.message)
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
        .select('id, user_id, day_of_week, label, routine_id')

      if (error) {
        setError(error.message)
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

  return (
    <div className="min-h-svh bg-ink text-chalk">
      <div className="mx-auto flex min-h-svh max-w-md flex-col gap-5 px-4 pb-28 pt-6">
        <header className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[11px] font-semibold tracking-[0.25em] text-blue-400 uppercase">
              Ackygym
            </p>
            <h1 className="font-display text-3xl leading-none tracking-tight text-chalk uppercase">
              {pageTitle}
            </h1>
            <UsernameField
              profile={profiles.find((p) => p.id === session.user.id)}
              userId={session.user.id}
              onSaved={() => setProfilesVersion((v) => v + 1)}
              onError={setError}
            />
          </div>
          <div className="flex shrink-0 items-center gap-2">
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
                onError={setError}
              />
            }
          />
          <Route
            path="/calendar"
            element={
              <CalendarPage
                profiles={profiles}
                schedule={schedule}
                userId={session.user.id}
                onError={setError}
              />
            }
          />
          <Route
            path="/lifts"
            element={
              <LiftsPage
                profiles={profiles}
                userId={session.user.id}
                onError={setError}
              />
            }
          />
          <Route
            path="/weight"
            element={
              <BodyWeightPage
                profiles={profiles}
                userId={session.user.id}
                onError={setError}
              />
            }
          />
          <Route path="/timer" element={<TimerPage />} />
        </Routes>
      </div>

      <nav className="fixed inset-x-0 bottom-0 border-t border-line bg-surface/95 backdrop-blur">
        <div className="mx-auto flex max-w-md items-stretch justify-around px-2 pb-[calc(env(safe-area-inset-bottom)+0.625rem)]">
          {TABS.map(({ to, label, icon: Icon, end }) => (
            <NavLink key={to} to={to} end={end} aria-label={label} className="px-3 pt-2.5 pb-3">
              {({ isActive }) => (
                <span
                  className={`flex flex-col items-center gap-2 ${
                    isActive ? 'text-blue-400' : 'text-chalk-dim'
                  }`}
                >
                  <Icon className="h-5 w-5" />
                  <span
                    className={`h-[2px] w-4 rounded-full ${isActive ? 'bg-blue-500' : 'bg-transparent'}`}
                  />
                </span>
              )}
            </NavLink>
          ))}
        </div>
      </nav>
    </div>
  )
}

export default App
