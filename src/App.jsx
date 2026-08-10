import { useEffect, useState } from 'react'
import { Routes, Route, NavLink, useLocation } from 'react-router-dom'
import { supabase } from './supabaseClient'
import Auth from './Auth'
import Home from './Home'
import CalendarPage from './CalendarPage'
import LiftsPage from './LiftsPage'
import BodyWeightPage from './BodyWeightPage'
import UsernameField from './UsernameField'
import { GridIcon, CalendarIcon, ChartIcon, ScaleIcon, LogOutIcon } from './icons'

const PAGE_TITLES = {
  '/': 'Home',
  '/calendar': 'Calendar',
  '/lifts': 'Lifts',
  '/weight': 'Weight',
}

const TABS = [
  { to: '/', label: 'Home', icon: GridIcon, end: true },
  { to: '/calendar', label: 'Calendar', icon: CalendarIcon },
  { to: '/lifts', label: 'Lifts', icon: ChartIcon },
  { to: '/weight', label: 'Weight', icon: ScaleIcon },
]

function App() {
  const [session, setSession] = useState(null)
  const [profiles, setProfiles] = useState([])
  const [schedule, setSchedule] = useState([])
  const [error, setError] = useState('')
  const [scheduleVersion, setScheduleVersion] = useState(0)
  const [profilesVersion, setProfilesVersion] = useState(0)
  const location = useLocation()

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
        .select('id, user_id, day_of_week, label')

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
    <div className="min-h-svh bg-neutral-950 text-neutral-100">
      <div className="mx-auto flex min-h-svh max-w-md flex-col gap-5 px-4 pb-28 pt-6">
        <header className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-2xl font-bold text-white">{pageTitle}</h1>
            <UsernameField
              profile={profiles.find((p) => p.id === session.user.id)}
              userId={session.user.id}
              onSaved={() => setProfilesVersion((v) => v + 1)}
              onError={setError}
            />
          </div>
          <button
            onClick={() => supabase.auth.signOut()}
            aria-label="Sign out"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-neutral-900 text-neutral-400 active:bg-neutral-800"
          >
            <LogOutIcon className="h-5 w-5" />
          </button>
        </header>

        {error && (
          <p className="rounded-2xl bg-red-500/10 px-4 py-3 text-sm text-red-400">
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
        </Routes>
      </div>

      <nav className="fixed inset-x-0 bottom-0 border-t border-neutral-800 bg-neutral-950/95 backdrop-blur">
        <div className="mx-auto flex max-w-md items-center justify-around px-2 pb-[calc(env(safe-area-inset-bottom)+0.5rem)] pt-2">
          {TABS.map(({ to, label, icon: Icon, end }) => (
            <NavLink key={to} to={to} end={end} aria-label={label} className="px-4 py-1.5">
              {({ isActive }) => (
                <span
                  className={`flex flex-col items-center gap-1.5 ${
                    isActive ? 'text-blue-400' : 'text-neutral-500'
                  }`}
                >
                  <Icon className="h-6 w-6" />
                  <span
                    className={`h-1 w-1 rounded-full ${isActive ? 'bg-blue-400' : 'bg-transparent'}`}
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
