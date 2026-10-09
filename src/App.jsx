import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { Routes, Route, NavLink, Link, Navigate, useLocation } from 'react-router-dom'
import { AnimatePresence, motion } from 'motion/react'
import { supabase } from './supabaseClient'
import { clearPageCache } from './pageCache'
import Auth from './Auth'
import Home from './Home'
import RoutinesPage from './RoutinesPage'
import CalendarPage from './CalendarPage'
import LiftsPage from './LiftsPage'
import BodyWeightPage from './BodyWeightPage'
import ProgressPhotosPage from './ProgressPhotosPage'
import SetsHistoryPage from './SetsHistoryPage'
import SettingsModal from './SettingsModal'
import TabSection from './TabSection'
import { smooth } from './motionPresets'
import { LEGACY_REDIRECTS } from './legacyRoutes'
import { displayName } from './displayName'
import { DEFAULT_CARD_VISIBILITY } from './cardVisibility'
import { usePersistedState } from './usePersistedState'
import { useRestTimer } from './useRestTimer'
import Sheet from './Sheet'
import TimerPanel from './TimerPanel'
import TimerPill from './TimerPill'
import { GridIcon, BarbellIcon, CalendarIcon, ScaleIcon, TimerIcon, CloseIcon } from './icons'

const TABS = [
  { to: '/', label: 'Today', icon: GridIcon, end: true },
  { to: '/train', label: 'Train', icon: BarbellIcon },
  { to: '/progress', label: 'Progress', icon: CalendarIcon },
  { to: '/body', label: 'Body', icon: ScaleIcon },
]

const PAGE_TITLES = Object.fromEntries(TABS.map((tab) => [tab.to, tab.label]))

const TRAIN_SEGMENTS = [
  { key: 'routines', label: 'Routines', to: '/train', end: true },
  { key: 'exercises', label: 'Lifts', to: '/train/exercises' },
]
const PROGRESS_SEGMENTS = [
  { key: 'calendar', label: 'Calendar', to: '/progress', end: true },
  { key: 'history', label: 'History', to: '/progress/history' },
]
const BODY_SEGMENTS = [
  { key: 'weight', label: 'Weight', to: '/body', end: true },
  { key: 'photos', label: 'Photos', to: '/body/photos' },
]

const DEFAULT_WATER_SETTINGS = { mode: 'volume', bottleSizeMl: 750, goalMl: 2000 }

function initials(profile) {
  if (!profile) return ''
  return displayName(profile).slice(0, 2).toUpperCase()
}

// Owns its own open state: opening Settings from App re-rendered the whole
// on-screen page in the same frame the sheet started animating.
function SettingsButton({ profile, ...settingsProps }) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Settings"
        className="relative flex h-9 w-9 items-center justify-center rounded-full bg-surface-2 text-[13px] font-semibold text-chalk after:absolute after:-inset-1 after:content-['']"
      >
        {initials(profile)}
      </button>
      <SettingsModal open={open} onClose={() => setOpen(false)} profile={profile} {...settingsProps} />
    </>
  )
}

function App() {
  const [session, setSession] = useState(null)
  const [sessionChecked, setSessionChecked] = useState(false)
  const [profiles, setProfiles] = useState([])
  const [schedule, setSchedule] = useState([])
  const [error, setError] = useState('')
  const [scheduleVersion, setScheduleVersion] = useState(0)
  const [profilesVersion, setProfilesVersion] = useState(0)
  const [theme, setTheme] = usePersistedState('theme', 'dark', Boolean)
  const [cardVisibility, setCardVisibility] = usePersistedState('gym-tracker:card-visibility', DEFAULT_CARD_VISIBILITY)
  const [waterSettings, setWaterSettings] = usePersistedState('gym-tracker:water-settings', DEFAULT_WATER_SETTINGS)
  const [weightUnit, setWeightUnit] = usePersistedState('gym-tracker:weight-unit', 'kg', (u) => u === 'kg' || u === 'lb')
  const [isOnline, setIsOnline] = useState(() => navigator.onLine)
  // Lifted out of Home so a started routine survives switching tabs — Home
  // unmounts on route change, which would otherwise wipe this like any other
  // component-local state.
  const [activeRoutine, setActiveRoutine] = useState(null)
  const location = useLocation()
  // Kept mounted here (not inside the timer sheet) so a running rest timer
  // survives tab switches.
  const restTimer = useRestTimer()
  const [timerOpen, setTimerOpen] = useState(false)
  const [autoRest, setAutoRest] = usePersistedState('gym-tracker:auto-rest', true)
  const scrollRootRef = useRef(null)
  const titleSentinelRef = useRef(null)
  const [titleCollapsed, setTitleCollapsed] = useState(false)

  function handleSetLogged() {
    if (autoRest) restTimer.restart()
  }

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
  }, [theme])

  useEffect(() => {
    const sync = () => setIsOnline(navigator.onLine)
    window.addEventListener('online', sync)
    window.addEventListener('offline', sync)
    return () => {
      window.removeEventListener('online', sync)
      window.removeEventListener('offline', sync)
    }
  }, [])

  // Stable identity matters: every page lists onError in its fetch effect's
  // deps, so a fresh function per render made every App re-render (the rest
  // timer ticks 4×/s) refetch whatever page was on screen.
  const handleError = useCallback((message) => {
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
  }, [])

  function toggleCardVisibility(key) {
    setCardVisibility((current) => ({ ...current, [key]: !current[key] }))
  }

  function updateWaterSettings(changes) {
    setWaterSettings((current) => ({ ...current, ...changes }))
  }

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        // A different user signing in on this device must never see the
        // previous user's cached page data.
        if (!session) {
          clearPageCache()
          // Nothing opened or started by the previous user may greet the next
          // one. The rest timer's countdown itself isn't reset here: this
          // effect subscribes once, so it would only hold the first render's
          // restTimer — the sheet closing is what matters.
          setTimerOpen(false)
          setActiveRoutine(null)
        }
        setSession(session)
        setSessionChecked(true)
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
  }, [session, profilesVersion, handleError])

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
  }, [session, scheduleVersion, handleError])

  const tabKey = '/' + location.pathname.split('/')[1]

  // iOS large-title collapse: when the sentinel under the big title scrolls
  // out of view, the compact frosted bar fades in.
  useEffect(() => {
    const sentinel = titleSentinelRef.current
    if (!sentinel) return
    const observer = new IntersectionObserver(
      ([entry]) => setTitleCollapsed(!entry.isIntersecting),
      // Offset by the 44px compact bar so the title counts as gone once
      // it slides under the bar, not once it leaves the screen.
      { root: scrollRootRef.current, rootMargin: '-44px 0px 0px 0px', threshold: 0 }
    )
    observer.observe(sentinel)
    return () => observer.disconnect()
  }, [session])

  // Each tab starts at the top — the scroll container persists across tabs.
  useLayoutEffect(() => {
    scrollRootRef.current?.scrollTo(0, 0)
  }, [tabKey])

  // Errors used to sit in the page flow until the next action cleared them;
  // as a floating pill it would cover the header forever, so it times out.
  useEffect(() => {
    if (!error) return
    const id = setTimeout(() => setError(''), 6000)
    return () => clearTimeout(id)
  }, [error])

  if (!sessionChecked) {
    return <div className="min-h-svh bg-ink" />
  }

  if (!session) {
    return <Auth />
  }

  const pageTitle = PAGE_TITLES[tabKey] ?? 'Ackygym'
  const currentProfile = profiles.find((p) => p.id === session.user.id)
  const todayCaption = new Date().toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  })

  return (
    <>
      <div id="app-shell" className="fixed inset-0 bg-ink text-chalk">
        <div
          aria-hidden={!titleCollapsed}
          className={`pointer-events-none absolute inset-x-0 top-0 z-10 border-b border-line bg-ink/75 pt-[env(safe-area-inset-top)] backdrop-blur-xl transition-opacity duration-200 ${
            titleCollapsed ? 'opacity-100' : 'opacity-0'
          }`}
        >
          <p className="flex h-11 items-center justify-center text-[17px] font-semibold">{pageTitle}</p>
        </div>

        <main
          ref={scrollRootRef}
          data-scroll-root
          className="h-full overflow-y-auto overscroll-y-contain"
        >
          <div className="mx-auto flex max-w-md flex-col gap-10 px-6 pt-[calc(env(safe-area-inset-top)+3.5rem)] pb-[calc(env(safe-area-inset-bottom)+9rem)]">
            <header className="flex items-end justify-between gap-3">
              <div className="min-w-0">
                <p className="h-5 text-caption text-chalk-dim">{tabKey === '/' ? todayCaption : ''}</p>
                <h1 className="text-large-title">{pageTitle}</h1>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                {tabKey === '/train' && (
                  <button
                    type="button"
                    onClick={() => setTimerOpen(true)}
                    aria-label="Rest timer"
                    className="relative flex h-9 w-9 items-center justify-center rounded-full bg-surface-2 text-chalk after:absolute after:-inset-1 after:content-['']"
                  >
                    <TimerIcon className="h-5 w-5" />
                  </button>
                )}
                <SettingsButton
                  profile={currentProfile}
                  theme={theme}
                  onThemeChange={setTheme}
                  visibility={cardVisibility}
                  onToggle={toggleCardVisibility}
                  waterSettings={waterSettings}
                  onWaterSettingsChange={updateWaterSettings}
                  weightUnit={weightUnit}
                  onWeightUnitChange={setWeightUnit}
                  autoRest={autoRest}
                  onAutoRestChange={setAutoRest}
                  restDuration={restTimer.duration}
                  onRestDurationChange={restTimer.selectDuration}
                  userId={session.user.id}
                  onProfileSaved={() => setProfilesVersion((v) => v + 1)}
                  onError={handleError}
                />
              </div>
            </header>
            <div ref={titleSentinelRef} aria-hidden="true" className="-mt-10 h-0" />

            {/* No exit animation: waiting for the old page to fade out before
              mounting the new one made every tab tap feel laggy. */}
              <motion.div
                key={tabKey}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ ...smooth, opacity: { duration: 0.18 } }}
              >
                <Routes location={location}>
                  <Route
                    path="/"
                    element={
                      <Home
                        session={session}
                        profiles={profiles}
                        schedule={schedule}
                        onError={handleError}
                        showWaterTracker={cardVisibility.water}
                        showCreatineTracker={cardVisibility.creatine}
                        waterSettings={waterSettings}
                        weightUnit={weightUnit}
                        activeRoutine={activeRoutine}
                        onActiveRoutineChange={setActiveRoutine}
                        onSetLogged={handleSetLogged}
                      />
                    }
                  />
                  <Route path="/train" element={<TabSection segments={TRAIN_SEGMENTS} layoutId="seg-train" />}>
                    <Route
                      index
                      element={
                        <RoutinesPage
                          session={session}
                          schedule={schedule}
                          onScheduleSaved={() => setScheduleVersion((v) => v + 1)}
                          onError={handleError}
                          onActiveRoutineChange={setActiveRoutine}
                          weightUnit={weightUnit}
                        />
                      }
                    />
                    <Route
                      path="exercises"
                      element={
                        <LiftsPage
                          profiles={profiles}
                          userId={session.user.id}
                          onError={handleError}
                          weightUnit={weightUnit}
                        />
                      }
                    />
                  </Route>
                  <Route path="/progress" element={<TabSection segments={PROGRESS_SEGMENTS} layoutId="seg-progress" />}>
                    <Route
                      index
                      element={
                        <CalendarPage
                          profiles={profiles}
                          userId={session.user.id}
                          onError={handleError}
                          weightUnit={weightUnit}
                        />
                      }
                    />
                    <Route
                      path="history"
                      element={
                        <SetsHistoryPage
                          userId={session.user.id}
                          weightUnit={weightUnit}
                          onError={handleError}
                        />
                      }
                    />
                  </Route>
                  <Route path="/body" element={<TabSection segments={BODY_SEGMENTS} layoutId="seg-body" />}>
                    <Route
                      index
                      element={
                        <BodyWeightPage
                          profiles={profiles}
                          userId={session.user.id}
                          onError={handleError}
                          showCalorieTracker={cardVisibility.calorie}
                          showCalorieTracking={cardVisibility.calorieTracker}
                          weightUnit={weightUnit}
                        />
                      }
                    />
                    <Route
                      path="photos"
                      element={
                        <ProgressPhotosPage
                          profiles={profiles}
                          userId={session.user.id}
                          onError={handleError}
                        />
                      }
                    />
                  </Route>
                  {Object.entries(LEGACY_REDIRECTS).map(([from, to]) => (
                    <Route key={from} path={from} element={<Navigate to={to} replace />} />
                  ))}
                  <Route
                    path="*"
                    element={
                      <div className="flex flex-col items-center gap-3 py-16 text-center">
                        <p className="text-title">Page not found</p>
                        <p className="text-[15px] text-chalk-dim">There's nothing at this address.</p>
                        <Link to="/" className="mt-3 rounded-full bg-chalk px-5 py-2.5 text-[15px] font-semibold text-ink">
                          Go to Today
                        </Link>
                      </div>
                    }
                  />
                </Routes>
              </motion.div>
          </div>
        </main>

        <nav className="absolute inset-x-0 bottom-0 z-10 border-t border-line bg-ink/75 backdrop-blur-xl">
          <div className="mx-auto flex max-w-md items-stretch justify-around pb-[env(safe-area-inset-bottom)]">
            {TABS.map(({ to, label, icon: Icon, end }) => (
              <NavLink key={to} to={to} end={end} className="flex min-h-[52px] flex-1 flex-col items-center justify-center gap-1 pt-2 pb-1.5">
                {({ isActive }) => (
                  <>
                    <Icon className={`h-6 w-6 ${isActive ? 'text-chalk' : 'text-chalk-dim'}`} />
                    <span className={`text-[10px] font-medium ${isActive ? 'text-chalk' : 'text-chalk-dim'}`}>{label}</span>
                  </>
                )}
              </NavLink>
            ))}
          </div>
        </nav>

        <TimerPill timer={restTimer} onOpen={() => setTimerOpen(true)} />
        <Sheet open={timerOpen} onClose={() => setTimerOpen(false)} title="Rest">
          <TimerPanel timer={restTimer} />
        </Sheet>
      </div>

      {/* Outside #app-shell on purpose: the shell is fixed, so it forms its own
          stacking context and anything inside it sits under portaled sheets
          (z-40). Errors raised from inside a sheet must still be visible. */}
      <div className="pointer-events-none fixed inset-x-0 top-[calc(env(safe-area-inset-top)+0.5rem)] z-50 flex flex-col items-center gap-2 px-5">
        <AnimatePresence>
          {!isOnline && (
            <motion.p
              key="offline"
              role="status"
              initial={{ opacity: 0, y: -12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              transition={smooth}
              className="rounded-full bg-surface px-4 py-2 text-[13px] font-semibold text-amber shadow-[0_10px_30px_var(--shadow-tint)]"
            >
              You're offline. Changes won't save until you reconnect.
            </motion.p>
          )}
          {error && (
            <motion.div
              key="error"
              role="alert"
              aria-live="assertive"
              initial={{ opacity: 0, y: -12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              transition={smooth}
              className="pointer-events-auto flex max-w-full items-center gap-3 rounded-full bg-surface py-2 pr-2 pl-4 text-[13px] font-semibold text-danger shadow-[0_10px_30px_var(--shadow-tint)]"
            >
              <span className="min-w-0">{error}</span>
              <button
                type="button"
                onClick={() => handleError('')}
                aria-label="Dismiss"
                className="relative flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-surface-2 text-chalk-dim after:absolute after:-inset-2.5 after:content-['']"
              >
                <CloseIcon className="h-3.5 w-3.5" />
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </>
  )
}

export default App
