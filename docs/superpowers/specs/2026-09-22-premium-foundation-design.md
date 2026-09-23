# Premium Foundation — Design

Date: 2026-09-22
Status: Approved in brainstorming, pending spec review

## Context

Ackygym works but feels "vibe coded": small 11px tracked labels, 1px-bordered
`rounded-lg` cards, cramped spacing, instant (unanimated) modals and page
switches, loading flashes on refetch, fiddly set logging, and 6 tabs plus two
hidden pages (Routines, History).

The goal is a premium feel: a blend of apple.com (big editorial hero moments
for stats) and native iOS (structure and motion for logging flows).

The full revamp is split into sub-projects, each with its own
spec → plan → build cycle:

1. **Foundation** (this spec): tokens, motion, primitives, app shell, loading behavior.
2. **Today**: Home redesign and the set-logging flow.
3. **Train**, then **Progress**, then **Body**: per-page layout redesigns.

## Decisions made in brainstorming

| Topic | Decision |
|---|---|
| Direction | Blend: iOS-native structure and motion, apple.com-style hero moments |
| Visual style | "B. Apple.com editorial": giant gradient hero number, monochrome, white pill CTAs, lots of black space |
| Density | Focus + disclosure: one hero per screen; secondary content becomes tiles that open sheets |
| Friction to fix | Loading flashes, abrupt transitions, fiddly logging, hard-to-find navigation |
| Navigation | 4 tabs: Today / Train / Progress / Body, plus a floating rest-timer pill |
| Themes | Keep both; dark is the hero look, light carefully tuned |
| Motion library | Add `motion` (`motion/react`) |
| Auto rest | Logging a set auto-starts the rest timer (last-used duration); Settings toggle to turn off |

## 1. Visual language

### Type

One family: **Inter Tight** (Google Fonts, weights 400/500/600/700). It
replaces Big Shoulders Display, Manrope, and JetBrains Mono, and those font
links are removed from `index.html`. Numbers use `font-variant-numeric:
tabular-nums` wherever values align or animate.

| Token | Size / weight / tracking | Use |
|---|---|---|
| `hero` | 76px / 700 / -0.045em, line-height 0.95, vertical gradient text fill | At most one per screen |
| `display` | 40px / 700 / -0.035em | Screen-level feature headings |
| `title` | 28px / 700 / -0.025em | Section headers |
| `large-title` | 34px / 700 / -0.03em | Page title in the shell |
| `headline` | 20px / 600 / -0.015em | Card titles, exercise names |
| `body` | 17px / 400 | Default text |
| `caption` | 13px / 500, `chalk-dim` | Metadata, secondary labels |

The 11px uppercase tracked labels and `SectionLabel` are removed. Hero
gradient: dark `#fff → #8a8a92`; light `#1d1d1f → #6e6e73`.

The Tailwind theme tokens `--font-display`, `--font-body`, and `--font-mono`
all point at Inter Tight. Global overrides in `index.css` neutralize the old
look on not-yet-redesigned pages: `.font-display` drops `text-transform`, and
`.font-mono` gains `tabular-nums`. Page code keeps compiling without a
repo-wide class sweep.

### Color

Existing token **names are kept**; only their values change, so every current
component shifts for free.

| Token | Dark | Light |
|---|---|---|
| `ink` (page bg) | `#000000` | `#ffffff` |
| `surface` (cards) | `#111114` | `#f5f5f7` |
| `surface-2` (inputs, secondary buttons) | `#1c1c20` | `#e8e8ed` |
| `line` (hairlines only) | `rgba(255,255,255,.08)` | `rgba(0,0,0,.08)` |
| `chalk` (text) | `#f5f5f7` | `#1d1d1f` |
| `chalk-dim` | `#86868b` | `#6e6e73` |
| accent (`blue-400`/`blue-500` role) | `#2997ff` | `#0071e3` |
| `emerald` (positive / PR) | `#30d158` | `#248a3d` |
| `danger` | `#ff453a` | `#d70015` |
| `onblue` | `#ffffff` | `#ffffff` |

Rules:
- The UI is monochrome. Primary CTAs are pills in the text color (`chalk` bg, `ink` text).
- Color only carries meaning: accent = links/selection, emerald = gains/PRs, danger = destructive/errors, amber = warnings (offline).
- The heatmap scale becomes monochrome-plus-accent (surface → accent at rising opacity) in both themes.
- Contrast: body text and `chalk-dim` on `surface` must meet WCAG AA 4.5:1. Accent text on `ink`/`surface` must meet 4.5:1, and white text on accent-filled buttons must too. The light-theme `#0071e3` passes; if dark-theme accent fills fail with white text, filled accent buttons use `ink` text instead. Verify with a contrast check during implementation.

### Surfaces, radii, spacing

- **No borders on cards.** Depth comes from tone (`ink` → `surface` → `surface-2`). The `--card-highlight` inset is removed.
- Hairlines (0.5px `line`) appear only between list rows, inset from the left edge.
- Radii: cards 26px, inputs 16px, buttons fully rounded pills, small chips fully rounded.
- Spacing: 20px screen gutters, 22px card padding, 40–48px between page sections, 12px between tiles in a group.
- Minimum touch target 44px; primary CTAs 52px tall.

## 2. Motion

- Library: `motion` (`motion/react`). The app root is wrapped in `<MotionConfig reducedMotion="user">`, so Reduce Motion collapses transforms to instant/opacity-only.
- Two spring presets, exported from `src/motionPresets.js`:
  - `snappy`: presses, toggles, small elements; settles in ~200ms, no overshoot.
  - `smooth`: sheets, layout, page content; settles in ~350ms, critically damped (no bounce).

| Moment | Behavior |
|---|---|
| Tab switch | Outgoing page fades out; incoming fades in and rises 8px (~200ms). No horizontal slide. |
| Sheet open/close | Springs up from the bottom (`smooth`); drag down to dismiss, closing when dragged more than 30% of its height or flicked above a velocity threshold. The app root behind scales to 0.94 with rounded corners and dims. |
| List row add/remove | Height expands/collapses with opacity (`AnimatePresence`). |
| Reorder | Rows glide to new positions (`layout` prop). |
| Hero numbers | Count up to the new value with `smooth` when it changes (`AnimatedNumber`). |
| Page first mount | Top-level sections fade up with a 40ms stagger, once per mount. No scroll-triggered reveals. |
| Press feedback | Replace the global CSS `:active` scale with a `snappy` spring on `Button` and pressable `Card`; the CSS rule stays for plain buttons and links. |

## 3. Primitives

All live flat in `src/`, matching the repo convention.

### `Sheet.jsx`
- Props: `open`, `onClose`, `title?`, `size: 'auto' | 'large'` (large ≈ 92svh with an internally scrolling body), `children`.
- Renders into a portal, with a backdrop, a grabber, and an optional title row.
- Owns a11y: uses `useModalFocusTrap` and `useEscapeToClose` internally, sets `role="dialog"`, `aria-modal`, and `aria-labelledby`.
- Drag-to-dismiss via `motion` `drag="y"` on the grabber/header area only, so inner scrolling content isn't hijacked.
- Registers itself in a tiny `SheetStackContext` (an open-count) that the shell reads to scale the background.
- Locks body scroll while open.

### `ConfirmModal.jsx` (kept name, reimplemented)
- Thin `Sheet` preset: title, message, a destructive button, and Cancel.
- Same props as today, so call sites don't change.

### Modal migration
These components move onto `Sheet`, with props unchanged where possible:
`SettingsModal`, `WorkoutDayModal`, `ExerciseDetailModal`,
`PlateCalculatorModal`, `HistoryChartModal`, and `ConfirmModal`.
`WeightHistoryModal` and `CalorieHistoryModal` wrap `HistoryChartModal`, so
they migrate for free.

The full-screen photo viewer in `ProgressPhotosPage.jsx` (~line 392) stays a
full-screen lightbox, not a sheet. It only gets restyled: `ink` backdrop and a
fade-in.

### `Card.jsx` (same API, restyled)
- Adds an optional `onClick` → renders as a `motion.button` with `snappy` press feedback and a trailing chevron when `chevron` is set. This is the "summary tile" pattern.
- `SectionLabel` is removed. Its call sites switch to a plain `<h2 className="text-[28px] font-bold tracking-tight">` or caption. A `SectionHeader` component is added only if three or more call sites need a trailing action link.

### `Button.jsx`
- `variant: 'primary' | 'secondary' | 'destructive' | 'plain'`, `size: 'lg' | 'md'`, `loading`.
- primary = `chalk` bg / `ink` text pill; secondary = `surface-2` pill; destructive = `danger` text on `surface-2`; plain = accent text, no fill.
- `loading` shows an inline spinner, sets `aria-busy`, and disables the button while keeping its width.
- Forwards all other props to `<button>`.

### `NumberField.jsx`
- Props: `value`, `onChange`, `step`, `min = 0`, `unit?`, `label`, `decimals`.
- A 56px-tall `surface-2` field with 28px tabular numbers and 44px − / + buttons on either side.
- `inputMode="decimal"`, select-all on focus.
- Stepping math lives in a pure helper `stepValue(value, step, direction, min, decimals)` in `src/numberStep.js`: it rounds to the step's grid (so 187 + 5 → 190, not 192) and clamps at `min`.
- Step sizes: 5 for lb, 2.5 for kg, 1 for reps, derived by callers from the existing `weightUnit`.

### `List.jsx` / `ListRow`
- `List` is an inset grouped `surface` card with 0.5px hairlines between rows.
- `ListRow` props: `title`, `subtitle?`, `trailing?`, `onClick?` (adds a chevron and press state), min-height 52px.
- `List` wraps children in `AnimatePresence` for row add/remove.

### `AnimatedNumber.jsx`
- Props: `value`, `format?` (defaults to `toLocaleString`).
- Animates via a `motion` spring `MotionValue`, renders tabular figures.
- On first mount it counts from 0 once.

### `Skeleton.jsx`
- A tone-on-tone block with a CSS shimmer; `className` controls its shape.
- The shimmer is disabled under `prefers-reduced-motion`.

### `UndoToast.jsx` (restyled)
- Floating `surface-2` pill above the tab bar; springs in/out via `AnimatePresence`.
- Still driven by `useDeferredDelete`.

## 4. App shell (`App.jsx`)

### Header
- iOS large title (34px) with a caption above it: the formatted date on Today, empty elsewhere.
- An avatar circle on the right (initials from `displayName(currentProfile)`) opens Settings.
- On scroll past the large title, a frosted 44px bar with the centered small title fades in. It's implemented with an `IntersectionObserver` sentinel under the title, no scroll listener.
- The "ACKYGYM" eyebrow, username line, and theme/settings icon buttons are removed.

### Tabs and routes
- `TABS` becomes four entries: Today `/`, Train `/train`, Progress `/progress`, Body `/body`.
- Tab bar: frosted `ink/75` with `backdrop-blur`, icon + 10px label, active tab in `chalk`, inactive in `chalk-dim`. No blue underline.
- Each multi-section tab renders a `SegmentedControl` (new small component: an iOS-style track with a sliding thumb via `layoutId`) under the title. Segments are real child routes:

| Route | Renders |
|---|---|
| `/` | `Home` |
| `/train` (index) | `RoutinesPage` |
| `/train/exercises` | `LiftsPage` |
| `/progress` (index) | `CalendarPage` |
| `/progress/history` | `SetsHistoryPage` |
| `/body` (index) | `BodyWeightPage` |
| `/body/photos` | `ProgressPhotosPage` |

- Legacy redirects (`<Navigate replace>`), defined as a `LEGACY_REDIRECTS` map in `src/legacyRoutes.js`:
  - `/routines` → `/train`
  - `/lifts` → `/train/exercises`
  - `/calendar` → `/progress`
  - `/history` → `/progress/history`
  - `/weight` → `/body`
  - `/photos` → `/body/photos`
  - `/timer` → `/`
- `PAGE_TITLES` is keyed by the top-level tab: Today, Train, Progress, Body.
- Internal links are updated: `Home.jsx`'s `Link` targets, `CalendarPage.jsx`'s `Link`, and `RoutinesPage`'s `navigate('/')`. Grep for any string literal of an old route.
- Tab transitions: `AnimatePresence mode="wait"` keyed on the top-level tab segment, so segment switches inside a tab don't trigger the page fade. The segmented control's thumb animates instead.

### Rest timer
- `TimerPage.jsx` becomes `TimerSheet.jsx`: the same dial/presets/controls content inside a `Sheet`, same props.
- `TimerPill.jsx`: a fixed pill above the tab bar with a mini progress ring and the countdown. It's visible when `restTimer.status !== 'idle'` and springs in/out. Tapping it opens `TimerSheet`. In the `finished` state it shows "Done" with an accent ring.
- The idle timer is opened from Train's header action. Today gets a "Rest" button in the next sub-project.
- **Auto-rest**: after a set is saved successfully, if the `autoRest` setting is on (default on), call `restTimer.reset()` then `restTimer.start()` with the current (last-used) duration.
  - The hook point is a callback passed from `App.jsx` alongside `onError`, called by the set-logging success paths.
  - Before implementing, find every caller of `logSet.js` and every direct `sets` insert.
  - The setting persists in `localStorage` next to the other settings, with a toggle in `SettingsModal`.
- `useRestTimer` itself is unchanged, except for exposing whatever `reset`/`start` sequencing auto-rest needs (verify that `start` after `reset` works in the same tick; if not, add a `restart()` to the hook).

### Settings
- `SettingsModal` moves onto `Sheet` (`size="large"`).
- It gains the theme toggle (a segmented control: Dark / Light) and the Auto-start rest toggle.

### Banners
- The offline and error banners become a single floating pill at the top (below the safe area), in amber or danger. It keeps the current `handleError` logic.
- The error pill has a dismiss (×) that calls `handleError('')`, and auto-dismisses after 6s.
- The `scrollIntoView` effect is removed, since the banner is fixed and always visible.

### Layout
- The content column stays `max-w-md`, with `px-5` (20px) gutters.
- Bottom padding accounts for the tab bar + safe area + timer pill when visible.

## 5. Loading behavior

- Rule: **a refetch never clears existing data.**
  - Pages must not `set*([])` or set a loading flag that hides content before a refetch.
  - They fetch, then replace the data on success.
  - Audit every `xVersion`-driven `useEffect` for pre-fetch clears or loading toggles, and remove them.
- Each page's top-level data gets a `loaded` boolean (true after the first successful fetch).
  - Before it's true, render `Skeleton` blocks shaped like the content.
  - After it's true, never show the skeleton again for that mount.
- Content that replaces a skeleton fades in over 150ms.
- Spinners remain only inside `Button` `loading` states.

## 6. Error handling

- No change to data-layer error handling: every page still routes errors to `onError` → `handleError`.
- The `Sheet` drag/close must never discard unsaved form input silently. Sheets that contain forms (Settings profile edit, add/edit entries) pass `onClose` handlers that already guard their state today; keep that behavior.
- If a sheet currently has no guard, it keeps having none; this spec doesn't add unsaved-change prompts.

## 7. Verification

There's no test suite; `npm run lint` and `npm run build` must pass after every rollout step.

Runnable self-checks (plain `node` scripts with `assert`, no framework):
- `src/numberStep.check.js`: covers `stepValue`:
  - grid snapping up and down: 187 +5 → 190, 187 −5 → 185
  - kg 2.5 steps with decimals
  - clamp at `min`
  - an empty/NaN starting value treated as 0
- `src/legacyRoutes.check.js`: every legacy path maps to a route that exists in the new route table, with no redirect chains.

Browser pass (preview at 375×812, both themes, every tab and segment):
- Tab crossfade works; segment switches animate only the thumb.
- Each migrated sheet opens, drags to dismiss, closes on Escape and backdrop tap, and returns focus to its trigger.
- The background scales while a sheet is open.
- Logging a set starts the timer pill; tapping the pill opens the timer sheet; turning Auto-rest off stops the auto-start.
- Reloading on `/train/exercises` and visiting each legacy URL land correctly.
- Triggering a refetch (e.g. log a set) shows no blank flash.
- With emulated reduced motion, sheets and tabs appear without transforms.
- Contrast is spot-checked for `chalk-dim` on `surface` and for accent buttons in both themes.

## 8. Rollout order

Each step is its own commit, and the app is shippable after each:

1. **Tokens and fonts**: `index.css` values, Inter Tight in `index.html`, global overrides for `.font-display`/`.font-mono`, and the monochrome heatmap scale.
2. **Motion and primitives**: add `motion`, `motionPresets.js`, `Sheet`, `Card` update, `Button`, `NumberField` + `numberStep.js` + check, `List`, `AnimatedNumber`, `Skeleton`, `UndoToast` restyle, `ConfirmModal` on `Sheet`.
3. **Modal migration**: remaining modals onto `Sheet`.
4. **Shell**: header, 4 tabs, `SegmentedControl`, nested routes and legacy redirects + check, internal link updates, `TimerSheet` + `TimerPill`, auto-rest, Settings additions, and banners.
5. **Loading**: keep-previous-data audit and first-load skeletons.

## Out of scope

- Per-page layout redesigns: Home/Today (next sub-project), Train, Progress, Body.
- Swipe-to-delete rows, shared-element transitions between tabs, haptics.
- Replacing `NumberField` into existing forms beyond what the modal migration touches; the forms adopt it in their page's sub-project.
- Any Supabase schema or query changes.
