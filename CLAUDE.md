# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

- `npm run dev` — start Vite dev server
- `npm run build` — production build (outputs to `dist/`)
- `npm run preview` — serve the production build locally
- `npm run lint` — run ESLint over the whole repo

There is no test suite and no `npm test` script. A few pure modules carry plain-`node` assert checks instead: `node src/legacyRoutes.check.js` and `node src/pageCache.check.js`. There is no separate typecheck script (JS + JSDoc-free, no TypeScript build step — `@types/react` is present only for editor IntelliSense).

## Architecture

This is "Ackygym", a mobile-first multi-user gym tracker: a Vite + React 19 SPA with Supabase (Postgres + Auth) as the only backend — there is no server code in this repo. All data access happens client-side via `@supabase/supabase-js` directly from components.

**Auth & session**: `src/App.jsx` owns the top-level session state via `supabase.auth.onAuthStateChange`, and renders `Auth.jsx` when logged out. Once authenticated, `App.jsx` fetches `profiles` and `schedule` once and passes them down as props — most other data (exercises, sets, routines, body weight, water) is fetched inside the page/section component that needs it, following a repeated pattern: a `xVersion` counter in state, bumped to trigger a refetch (`useEffect` depends on it), passed down as an `onXChanged`/`onSaved` callback. There is no global store — refetch-via-version-bump is the app's convention for cache invalidation. Page-level fetched data lives in `useCachedState(key, initial)` (`src/pageCache.js`) rather than `useState`, so a tab switch remounts with the last data instead of a skeleton while the fetch refreshes it; the cache is in-memory only and cleared on sign-out.

**Multi-user model**: The app is shared across a small number of users (household/friends). Nearly every table has a `user_id`, and most pages show cross-user data (e.g. `Home.jsx` groups today's sets by user) but only let the current user edit/delete their own rows (`set.user_id === session.user.id` gating). Routines and schedule entries follow the same "visible to all, editable by owner" pattern (see `isOwn` checks in `Routines.jsx`).

**Data model (Supabase tables, inferred from queries — no migrations live in this repo)**:
- `profiles` (id, email, username) — one row per auth user, referenced by `user_id` FKs elsewhere
- `exercises` (id, name) with `exercise_muscles` (muscle, role, muscle_groups→label) — the user's personal exercise library
- `exercise_catalog` / `exercise_catalog_muscles` — a separate seed/reference catalog (used by `AddExerciseForm.jsx` to prefill muscles when adding a new exercise)
- `muscle_groups` (label) — lookup table, ordered by `src/muscleGroupOrder.js`
- `workouts` (user_id, date) — one per user per day; `sets` belong to a `workout_id`
- `sets` (workout_id, exercise_id, user_id, weight, reps, note)
- `routines` (user_id, name) with `routine_exercises` (routine_id, exercise_id, position)
- `schedule` (user_id, day_of_week, label, routine_id) — upserted on `(user_id, day_of_week)`, links a weekday to a routine
- `body_weights`, `water_logs` — per-user daily logs

**Known PostgREST quirk**: `.order(col, { foreignTable })` is a documented no-op against this project's PostgREST version — it silently emits a query param the server ignores, so rows come back in `id` order instead. `src/lastSet.js` and the routines fetch in `src/Home.jsx` work around this by sorting client-side; follow the same pattern (fetch, then sort in JS) for any new query that needs to order by a joined table's column. Don't "fix" this by switching back to server-side foreign-table ordering.

**Styling**: Tailwind v4 via `@tailwindcss/vite` (no `tailwind.config.js` — theme tokens are defined inline in `src/index.css` under `@theme` and overridden per-theme under `html[data-theme="light"]`). Light/dark mode is a `data-theme` attribute on `<html>`, toggled and persisted to `localStorage` in `App.jsx`. Use the existing semantic color tokens (`ink`, `surface`, `surface-2`, `line`, `chalk`, `chalk-dim`, `danger`, `onblue`, plus Tailwind's default `blue-*`) rather than introducing new raw colors — they're what make both themes work. Pages are `bg-ink`; `Card` and `Sheet` are `bg-surface`, so anything inside them that needs to read as a separate surface uses `surface-2`. Type is a single family, Inter Tight: `font-display` and `font-mono` are now aliases of `font-body` (`.font-display.uppercase` is neutralized in `index.css` until each page is redesigned), and new UI should use the type-scale utilities `text-hero`, `text-display`, `text-large-title`, `text-title`, `text-headline`, `text-caption` plus the radius tokens `rounded-card` / `rounded-field`.

**UI primitives & motion**: reuse `Sheet` (bottom sheet for every modal — always render it with `open`, never return null from the caller, or the exit animation can't play), `Button`, `Card`, `SegmentedControl` (NavLink segments via `to`, or button mode via `value`/`onChange`; `layoutId` must be unique on screen), and `Skeleton` (first-load only; `tone="surface-2"` inside a Card/Sheet). Animation goes through `motion/react` using the two springs in `src/motionPresets.js` — don't add others.

**Routing & shell**: `react-router-dom`, routes declared inline in `App.jsx`. Four tabs — `/` (Today), `/train`, `/progress`, `/body` — each with nested segment routes (`/train/exercises`, `/progress/history`, `/body/photos`) rendered through `TabSection`'s `SegmentedControl`. Pre-revamp URLs redirect via `LEGACY_REDIRECTS` in `src/legacyRoutes.js`; keep its `ROUTE_PATHS` in sync when adding a route and run `node src/legacyRoutes.check.js`. Page titles come from `PAGE_TITLES`, derived from `TABS` and keyed by the top-level path segment. The shell is a fixed `#app-shell` with an inner scrolling `<main>` (the window itself never scrolls — scroll logic targets `scrollRootRef`), a fixed bottom tab bar, and the error/offline banners rendered as a sibling outside the shell so they stay above open sheets.

**Deployment**: Vercel (`vercel.json` is just an SPA rewrite-all-to-`index.html` rule). Env vars (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`) are read via `import.meta.env` in `src/supabaseClient.js` and must be set in the Vercel project as well as a local `.env`.
