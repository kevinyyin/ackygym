# Ackygym

A mobile-first gym tracker for a household or a small group of friends. Everyone logs their own workouts, and everyone sees everyone's progress.

It's a React single-page app with Supabase as the whole backend (Postgres, Auth, Storage). There is no server code in this repo. Add it to your phone's home screen and it opens full-screen like an app.

## Features

**Today**
- Today's scheduled routine with a one-tap Start, and your set count for the day
- Log a set: searchable exercise picker (optionally filtered to a routine), weight and reps prefilled from your last set and kept between sets, built-in plate calculator
- Active routine: every exercise in the routine on one card, each with its own Log button
- Today's sets for everyone, grouped by person and exercise; your own sets get notes, repeat, and delete with Undo (single or bulk)
- New personal records are flagged with a trophy
- Optional water tracker (ml or bottles, daily goal) and creatine check-in

**Train**
- Routines: create, rename, reorder (drag or buttons), assign to weekdays, start, and duplicate (including other people's routines, as your own copy)
- Exercises: each exercise's all-time best set per person, a leaderboard grouped into upper and lower body, plus search
- Add exercises tagged with primary and secondary muscle groups, with suggestions from a shared catalog
- Exercise detail: muscle map, estimated one-rep max, a progression chart, and edit or delete any of your past sets

**Progress**
- Streaks that skip your scheduled rest days
- A year-long heatmap or a month calendar per person; tap one of your days to see it or repeat that whole workout
- Muscle volume: sets per muscle group over 7 days, 2 weeks, or 1 month, with a body map
- History: search your sets by exercise and date range

**Body**
- Body weight with an inline trend chart, plus everyone's history (tap a name for their chart)
- Calorie calculator (Mifflin-St Jeor: BMR, maintenance, goal target) and a calorie tracker that adds up over the day
- Progress photos: private by default, with sharing per photo

**Everywhere**
- Rest timer on every tab: presets or custom length, auto-starts after you log a set, sound and vibration alert, keeps running across tabs
- kg or lb (weights are stored in kg), dark or light theme, optional cards you can hide
- Offline banner; add to home screen (web app manifest)

## Tech stack

| | |
|---|---|
| UI | React 19, React Router 7, Tailwind CSS v4, Motion |
| Charts | Recharts, react-body-highlighter |
| Build | Vite 8, ESLint |
| Backend | Supabase (`@supabase/supabase-js` v2), called directly from the browser |
| Hosting | Vercel (static SPA) |

## Getting started

Requirements: Node 20.19+ or 22.12+ (Vite 8's minimum) and a Supabase project.

```bash
git clone https://github.com/kevinyyin/ackygym.git
cd ackygym
npm install
```

Create `.env` in the project root (it's git-ignored):

```bash
VITE_SUPABASE_URL=https://<your-project>.supabase.co
VITE_SUPABASE_ANON_KEY=<your-anon-key>
```

Then:

```bash
npm run dev
```

Open http://localhost:5173 and sign up with email and password (confirm by email if your Supabase project requires it).

## Supabase setup

The schema isn't checked in (there are no migrations in this repo). The app expects these tables:

| Table | Columns the app uses | Notes |
|---|---|---|
| `profiles` | `id`, `email`, `username` | One row per auth user, created on signup (e.g. a trigger on `auth.users`); the app only updates `username`, which must be unique |
| `exercises` | `id`, `name` | Shared exercise library |
| `exercise_muscles` | `exercise_id`, `muscle`, `role` | `role` is `primary` or `secondary` |
| `muscle_groups` | `name`, `label` | Lookup for `muscle` |
| `exercise_catalog` | `id`, `name` | Suggestions when adding an exercise; grows as people add new ones |
| `exercise_catalog_muscles` | `catalog_id`, `muscle`, `role` | |
| `workouts` | `id`, `user_id`, `date` | One per user per day |
| `sets` | `id`, `workout_id`, `exercise_id`, `user_id`, `weight`, `reps`, `note`, `is_pr` | `weight` in kg |
| `routines` | `id`, `user_id`, `name` | `user_id` defaults to the signed-in user |
| `routine_exercises` | `id`, `routine_id`, `exercise_id`, `position` | |
| `schedule` | `id`, `user_id`, `day_of_week`, `label`, `routine_id` | Unique on `(user_id, day_of_week)`; `0` = Sunday |
| `body_weights` | `id`, `user_id`, `date`, `weight_kg` | Unique on `(user_id, date)` |
| `calorie_logs` | `id`, `user_id`, `date`, `calories` | Unique on `(user_id, date)` |
| `water_logs` | `id`, `user_id`, `date`, `amount_ml`, `created_at` | Many per day |
| `creatine_logs` | `user_id`, `date` | A row means "taken that day" |
| `progress_photos` | `id`, `user_id`, `path`, `date`, `created_at`, `shared` | Files live in Storage |

Storage: a private bucket named `progress-photos`. Files are uploaded under `<user_id>/` and shown through signed URLs.

Access model (enforce it with row-level security): signed-in users can read everyone's rows, but can only write their own. Progress photos are readable by their owner, or by anyone once `shared` is true. Foreign keys block deleting an exercise that still has sets or routine entries; the app shows a friendly message for that case.

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Start the Vite dev server |
| `npm run build` | Production build to `dist/` |
| `npm run preview` | Serve the production build locally |
| `npm run lint` | ESLint over the repo |

There's no test suite. A few pure modules have plain-Node assert checks:

```bash
node src/legacyRoutes.check.js && node src/pageCache.check.js && node src/streak.check.js
```

## Deployment

Deploys to Vercel as a static SPA. `vercel.json` rewrites every path to `index.html` so client-side routes work on refresh. Set `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` in the Vercel project's environment variables.

## Project layout

```
src/
  App.jsx                 Session, tab shell, routes, rest timer, settings
  Home.jsx                Today
  RoutinesPage.jsx        Train → Routines (editing lives in Routines.jsx)
  LiftsPage.jsx           Train → Exercises
  CalendarPage.jsx        Progress → Calendar, streaks, muscle volume
  SetsHistoryPage.jsx     Progress → History
  BodyWeightPage.jsx      Body → Weight and calories
  ProgressPhotosPage.jsx  Body → Photos
  Sheet.jsx, Button.jsx, Card.jsx, SegmentedControl.jsx
                          Shared UI primitives
  logSet.js, lastSet.js, library.js
                          Supabase queries shared across pages
  index.css               Tailwind theme tokens (dark and light)
public/                   Web app manifest and icons
```

