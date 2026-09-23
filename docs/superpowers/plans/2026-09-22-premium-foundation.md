# Premium Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give Ackygym an apple.com/iOS-grade foundation:
- new visual tokens
- a motion system
- sheet-based modals
- a 4-tab shell with a floating rest timer
- no loading flashes

**Architecture:**
- Token values change under the existing Tailwind token names in `src/index.css`, so every page restyles for free.
- A small set of primitives (`Sheet`, `Button`, `Card`, `SegmentedControl`, `Skeleton`, `TimerPill`) built on `motion/react` replaces hand-rolled modals and buttons.
- `App.jsx` becomes a viewport-fixed shell with an inner scroll container, so the background can scale behind open sheets.

**Tech Stack:** Vite 8, React 19, react-router-dom 7, Tailwind v4 (`@theme` in CSS, no config file), Supabase JS, `motion` (new).

**Spec:** `docs/superpowers/specs/2026-09-22-premium-foundation-design.md`

## Global Constraints

- No TypeScript, no test framework. Plain `.js`/`.jsx`. Verification is `npm run lint`, `npm run build`, `node` assert scripts, and a browser pass.
- Keep existing Tailwind token **names**: `ink`, `surface`, `surface-2`, `line`, `chalk`, `chalk-dim`, `danger`, `onblue`, `blue-*`, `amber`, `emerald`, `purple`, `heat-0..4`. Only values change.
- One font family: **Inter Tight** (400/500/600/700). Remove Big Shoulders Display, Manrope, JetBrains Mono.
- Radii: cards 26px, inputs 16px, buttons fully rounded. Gutters 20px. Touch targets ≥ 44px; primary CTAs 52px tall.
- Motion only through `motion/react`, wrapped in `<MotionConfig reducedMotion="user">`. Springs come only from `src/motionPresets.js`.
- Don't use `.order(col, { foreignTable })` (see CLAUDE.md). No Supabase schema or query changes.
- Follow the repo's flat `src/` layout and comment style: comments explain *why*, not *what*.
- Each task ends with `npm run lint && npm run build` passing and a commit.

## Deviations from the spec (decided while planning)

1. **`NumberField`, `List`/`ListRow`, `AnimatedNumber` move to the Today plan.** Nothing in this plan consumes them. Building them now would be speculative, and their first consumer (the Today redesign) should shape their API. The `numberStep` self-check moves with `NumberField`.
2. **Background recede uses a CSS attribute, not a React context.** `Sheet` sets `html[data-sheet-open]` via a module-level open-count, and CSS scales `#app-shell`. Same behavior, no provider.
3. **New: fix the `onError` refetch storm (Task 1).** `App.jsx`'s `handleError` is a new function every render. Pages list `onError` in their fetch-effect deps, so every `App` re-render refetches them. The rest timer re-renders `App` every 250ms while running, so pages refetch ~4×/s during rest. This is a root cause of "not smooth" and a one-line fix.
4. **New: remount cache (Task 10).** Tab switches unmount pages, so every switch re-shows "Loading…". A tiny module-level `useCachedState` shows the last data instantly and refetches in the background. This is the spec's "refetch never clears existing data" rule applied across remounts.
5. **`TimerPage.jsx` is renamed `TimerPanel.jsx`** (content unchanged apart from restyling) and wrapped by `TimerSheet.jsx`.
6. **`PlateCalculatorModal` gets an enter animation only.** Its parents mount it conditionally, so the exit animation can't run without restructuring two forms. That happens in the Today plan.
7. **Skeleton-to-content 150ms fade is deferred to the per-page redesigns.** Spec §5 asks for content replacing a skeleton to fade in over 150ms. Each page's loaded content is rebuilt in its own redesign plan; a generic fade wrapper now would touch every page twice.

## File Structure

| File | Status | Responsibility |
|---|---|---|
| `index.html` | modify | Inter Tight font link, theme-color, title |
| `src/index.css` | modify | New token values, type-scale tokens, heatmap, global overrides, sheet-recede CSS, skeleton shimmer |
| `src/App.jsx` | modify | `useCallback` onError, viewport shell, header, tabs, nested routes, timer, banners |
| `src/main.jsx` | modify | `MotionConfig` wrapper |
| `src/motionPresets.js` | create | `snappy`, `smooth` spring presets |
| `src/Button.jsx` | create | Pill button primitive |
| `src/Card.jsx` | modify | Restyle, `onPress` tile mode; remove `SectionLabel` |
| `src/Sheet.jsx` | create | Bottom sheet with drag-dismiss, a11y, background recede |
| `src/ConfirmModal.jsx` | modify | Reimplemented on `Sheet` |
| `src/SettingsModal.jsx` | modify | On `Sheet`; theme + auto-rest controls |
| `src/WorkoutDayModal.jsx` | modify | On `Sheet` |
| `src/ExerciseDetailModal.jsx` | modify | On `Sheet` |
| `src/PlateCalculatorModal.jsx` | modify | On `Sheet` |
| `src/HistoryChartModal.jsx` | modify | On `Sheet` |
| `src/ProgressPhotosPage.jsx` | modify | Lightbox restyle + fade; `SectionLabel` swap; cache |
| `src/SegmentedControl.jsx` | create | iOS segmented control (NavLink or button segments) |
| `src/TabSection.jsx` | create | Segmented control + `<Outlet/>` for a tab |
| `src/legacyRoutes.js` | create | `ROUTE_PATHS`, `LEGACY_REDIRECTS` |
| `src/legacyRoutes.check.js` | create | Assert script for the redirect map |
| `src/TimerPage.jsx` → `src/TimerPanel.jsx` | rename + modify | Timer content, restyled |
| `src/TimerSheet.jsx` | create | `TimerPanel` inside a `Sheet` |
| `src/TimerPill.jsx` | create | Floating countdown pill |
| `src/useRestTimer.js` | modify | `restart()`, audio unlock on first pointerdown |
| `src/autoRestSettings.js` | create | Persisted auto-rest boolean |
| `src/Home.jsx` | modify | Route link, `onSetLogged`, `SectionLabel` swap, cache, skeleton |
| `src/CalendarPage.jsx` | modify | Route link, cache, skeleton |
| `src/Skeleton.jsx` | create | Shimmer placeholder |
| `src/pageCache.js` | create | `useCachedState`, `clearPageCache` |
| `src/UndoToast.jsx` | modify | Restyle + spring |
| `src/HistoryLogSection.jsx`, `src/Routines.jsx`, `src/RoutinesPage.jsx`, `src/WaterTracker.jsx`, `src/LiftsPage.jsx`, `src/BodyWeightPage.jsx` | modify | `SectionLabel` swap, cache, skeleton |

---

### Task 1: Stop the `onError` refetch storm

**Files:**
- Modify: `src/App.jsx` (the `handleError` function, ~lines 100–116)

**Interfaces:**
- Produces: `handleError` with a stable identity across renders. Every page's `[onError]` effect then runs once per mount.

- [ ] **Step 1: Reproduce.** Run `npm run dev`, sign in, open the Lifts tab, open DevTools → Network filtered to `rest/v1`. Go to Timer, press Start, go back to Lifts. Expected before fix: repeated `exercises`/`sets` requests roughly every 250ms.

- [ ] **Step 2: Wrap `handleError` in `useCallback`**

In `src/App.jsx`, change the import line:

```jsx
import { useCallback, useEffect, useRef, useState } from 'react'
```

Replace the `function handleError(message) { ... }` declaration with:

```jsx
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
```

It must be declared before the `useEffect`s that call it. Move the block above the `fetchProfiles` effect if lint's `react-hooks` rules complain about use-before-define.

- [ ] **Step 3: Verify.** Repeat Step 1. Expected: one burst of requests on entering Lifts, then silence while the timer runs.

- [ ] **Step 4: Lint, build, commit**

```bash
npm run lint && npm run build
git add src/App.jsx
git commit -m "Stop pages refetching on every App render"
```

---

### Task 2: Tokens, type scale, and font

**Files:**
- Modify: `index.html`
- Modify: `src/index.css` (the `@theme` block, `:root`, `html[data-theme="light"]` blocks, `@layer base`)

**Interfaces:**
- Produces Tailwind utilities used by later tasks: `text-hero`, `text-display`, `text-large-title`, `text-title`, `text-headline`, `text-caption` (each carrying size, line-height, letter-spacing, and weight), `rounded-card` (26px), `rounded-field` (16px).

- [ ] **Step 1: Swap the font link in `index.html`**

Replace the Google Fonts `<link href=...>` with:

```html
    <link
      href="https://fonts.googleapis.com/css2?family=Inter+Tight:wght@400;500;600;700&display=swap"
      rel="stylesheet"
    />
```

Change `<meta name="theme-color" content="#0a0a0c" />` to `content="#000000"`, and `<title>gym-tracker</title>` to `<title>Ackygym</title>`.

- [ ] **Step 2: Replace the `@theme` block in `src/index.css`**

```css
@theme {
  /* Dark is the hero theme; values mirror apple.com's dark surfaces. Names
     are the app's long-standing tokens so every existing class restyles
     without a sweep. */
  --color-ink: #000000;
  --color-surface: #111114;
  --color-surface-2: #1c1c20;
  --color-line: rgba(255, 255, 255, 0.08);

  --color-chalk: #f5f5f7;
  --color-chalk-dim: #86868b;

  /* blue-500 is the fill behind white (onblue) text, so it's #0071e3 in
     both themes — ~4.6:1 with white. blue-400 is accent *text* on black
     and can be much brighter. */
  --color-blue-300: #64b5ff;
  --color-blue-400: #2997ff;
  --color-blue-500: #0071e3;
  --color-blue-600: #005bb5;

  --color-danger: #ff453a;
  --color-onblue: #ffffff;

  --color-amber: #ff9f0a;
  --color-emerald: #30d158;
  --color-purple: #bf5af2;

  --font-display: "Inter Tight", -apple-system, system-ui, sans-serif;
  --font-body: "Inter Tight", -apple-system, system-ui, sans-serif;
  --font-mono: "Inter Tight", -apple-system, system-ui, sans-serif;

  --radius-card: 26px;
  --radius-field: 16px;

  --text-hero: 76px;
  --text-hero--line-height: 0.95;
  --text-hero--letter-spacing: -0.045em;
  --text-hero--font-weight: 700;
  --text-display: 40px;
  --text-display--line-height: 1.05;
  --text-display--letter-spacing: -0.035em;
  --text-display--font-weight: 700;
  --text-large-title: 34px;
  --text-large-title--line-height: 1.1;
  --text-large-title--letter-spacing: -0.03em;
  --text-large-title--font-weight: 700;
  --text-title: 28px;
  --text-title--line-height: 1.15;
  --text-title--letter-spacing: -0.025em;
  --text-title--font-weight: 700;
  --text-headline: 20px;
  --text-headline--line-height: 1.25;
  --text-headline--letter-spacing: -0.015em;
  --text-headline--font-weight: 600;
  --text-caption: 13px;
  --text-caption--line-height: 1.35;
  --text-caption--font-weight: 500;
}
```

- [ ] **Step 3: Replace the `:root` and `html[data-theme="light"]` variable blocks (above `@layer base`)**

```css
:root {
  --shadow-tint: rgba(0, 0, 0, 0.6);
  /* Cards no longer carry an inset highlight; kept as a variable because
     not-yet-redesigned pages still reference it in arbitrary shadows. */
  --card-highlight: transparent;

  --color-heat-0: #1c1c20;
  --color-heat-1: color-mix(in oklab, #2997ff 30%, #1c1c20);
  --color-heat-2: color-mix(in oklab, #2997ff 55%, #1c1c20);
  --color-heat-3: color-mix(in oklab, #2997ff 80%, #1c1c20);
  --color-heat-4: #2997ff;
}

html[data-theme="light"] {
  --shadow-tint: rgba(0, 0, 0, 0.12);

  --color-heat-0: #e8e8ed;
  --color-heat-1: color-mix(in oklab, #0071e3 30%, #e8e8ed);
  --color-heat-2: color-mix(in oklab, #0071e3 55%, #e8e8ed);
  --color-heat-3: color-mix(in oklab, #0071e3 80%, #e8e8ed);
  --color-heat-4: #0071e3;
}
```

- [ ] **Step 4: Replace the light-theme token overrides inside `@layer base`**

Replace the whole `html[data-theme="light"] { color-scheme: light; ... }` rule inside `@layer base` with:

```css
  html[data-theme="light"] {
    color-scheme: light;
    --color-ink: #ffffff;
    --color-surface: #f5f5f7;
    --color-surface-2: #e8e8ed;
    --color-line: rgba(0, 0, 0, 0.08);
    --color-chalk: #1d1d1f;
    --color-chalk-dim: #6e6e73;
    /* Accent text on white needs a darker blue than dark mode's #2997ff to
       clear 4.5:1; #0066cc is apple.com's own link color. blue-300 is only
       used for TimerPanel's large finished-state digits (3:1 bar). */
    --color-blue-400: #0066cc;
    --color-blue-300: #0071e3;
    --color-danger: #d70015;
    --color-amber: #c93400;
    --color-emerald: #248a3d;
    --color-purple: #8944ab;
  }
```

- [ ] **Step 5: Update `body` and `.font-display` in `@layer base`; add neutralizing overrides**

Replace:

```css
  body {
    @apply bg-ink text-chalk font-body;
    -webkit-tap-highlight-color: transparent;
  }

  .font-display {
    font-weight: 700;
  }
```

with:

```css
  body {
    @apply bg-ink text-chalk font-body;
    -webkit-tap-highlight-color: transparent;
    -webkit-font-smoothing: antialiased;
    -moz-osx-font-smoothing: grayscale;
  }

  /* Pages not yet redesigned still use `font-display uppercase` and
     `font-mono` for numbers. Neutralize the old condensed/shouty look here
     (0,2,0 specificity beats the 0,1,0 `uppercase` utility) rather than
     sweeping 120+ class strings that the per-page redesigns rewrite anyway. */
  .font-display {
    font-weight: 700;
    letter-spacing: -0.02em;
  }
  .font-display.uppercase {
    text-transform: none;
  }
  .font-mono {
    font-variant-numeric: tabular-nums;
  }
```

- [ ] **Step 6: Verify contrast.** Run this in Node (it computes WCAG ratios for the pairs the spec requires):

```bash
node -e '
const L=h=>{const c=[1,3,5].map(i=>parseInt(h.slice(i,i+2),16)/255).map(v=>v<=.03928?v/12.92:((v+.055)/1.055)**2.4);return .2126*c[0]+.7152*c[1]+.0722*c[2]};
const R=(a,b)=>{const[x,y]=[L(a),L(b)].sort((p,q)=>q-p);return ((x+.05)/(y+.05)).toFixed(2)};
const pairs=[["dark dim/surface","#86868b","#111114"],["dark accent/ink","#2997ff","#000000"],["white/blue-500","#ffffff","#0071e3"],["light dim/surface","#6e6e73","#f5f5f7"],["light accent/ink","#0066cc","#ffffff"],["light dim/ink","#6e6e73","#ffffff"]];
for(const[n,a,b]of pairs)console.log(n,R(a,b));'
```

Expected: every value ≥ 4.5. If `light dim/surface` is below 4.5, change the light `--color-chalk-dim` to `#636366` and re-run.

- [ ] **Step 7: Visual check.** Run `npm run dev` and load `/` in the preview at 375×812 in both themes. Expected: Inter Tight everywhere, black/white backgrounds, no uppercase condensed headings, heatmap on `/calendar` in blue shades.

- [ ] **Step 8: Lint, build, commit**

```bash
npm run lint && npm run build
git add index.html src/index.css
git commit -m "Switch to Inter Tight and apple.com-style monochrome tokens"
```

---

### Task 3: Motion setup, `Button`, and `Card` restyle

**Files:**
- Create: `src/motionPresets.js`, `src/Button.jsx`
- Modify: `src/main.jsx`, `src/Card.jsx`, `src/index.css` (press-scale rule)
- Modify (`SectionLabel` removal): `src/HistoryLogSection.jsx`, `src/Home.jsx`, `src/Routines.jsx`, `src/ProgressPhotosPage.jsx`, `src/RoutinesPage.jsx`, `src/WaterTracker.jsx`

**Interfaces:**
- Produces:
  - `export const snappy`, `export const smooth` (motion transition objects) from `src/motionPresets.js`.
  - `Button({ variant = 'primary' | 'secondary' | 'destructive' | 'plain', size = 'md' | 'lg', loading = false, type = 'button', className, ...buttonProps })` (default export).
  - `Card({ className, onPress?, chevron = false, children, ...rest })` (default export). With `onPress`, it renders a pressable `<motion.button>`. `SectionLabel` no longer exists.

- [ ] **Step 1: Install motion**

```bash
npm install motion
```

Expected: `motion` added to `dependencies` in `package.json`.

- [ ] **Step 2: Create `src/motionPresets.js`**

```js
// The app's only two springs — every animation picks one of these so
// motion feels like one system. Both are critically damped (no overshoot),
// matching iOS's default UI springs.
export const snappy = { type: 'spring', stiffness: 520, damping: 42, mass: 0.8 }
export const smooth = { type: 'spring', stiffness: 300, damping: 34, mass: 1 }
```

- [ ] **Step 3: Wrap the app in `MotionConfig` in `src/main.jsx`**

```jsx
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { MotionConfig } from 'motion/react'
import './index.css'
import App from './App.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <MotionConfig reducedMotion="user">
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </MotionConfig>
  </StrictMode>,
)
```

- [ ] **Step 4: Create `src/Button.jsx`**

```jsx
import { motion } from 'motion/react'
import { snappy } from './motionPresets'

const VARIANTS = {
  primary: 'bg-chalk text-ink',
  secondary: 'bg-surface-2 text-chalk',
  destructive: 'bg-surface-2 text-danger',
  plain: 'bg-transparent text-blue-400',
}

const SIZES = {
  lg: 'h-[52px] w-full px-6 text-[17px]',
  md: 'h-11 px-5 text-[15px]',
}

// data-press opts out of index.css's global CSS :active scale so the spring
// below isn't fighting a second transform.
function Button({
  variant = 'primary',
  size = 'md',
  loading = false,
  type = 'button',
  disabled,
  className = '',
  children,
  ...rest
}) {
  return (
    <motion.button
      data-press
      type={type}
      whileTap={{ scale: 0.97 }}
      transition={snappy}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={`relative inline-flex shrink-0 items-center justify-center rounded-full font-semibold disabled:opacity-40 ${VARIANTS[variant]} ${SIZES[size]} ${className}`}
      {...rest}
    >
      <span className={loading ? 'invisible' : ''}>{children}</span>
      {loading && (
        <span className="absolute inset-0 flex items-center justify-center">
          <span className="h-5 w-5 animate-spin rounded-full border-2 border-current border-t-transparent" />
        </span>
      )}
    </motion.button>
  )
}

export default Button
```

- [ ] **Step 5: Exclude `data-press` elements from the global CSS press scale in `src/index.css`**

Replace:

```css
  @media (prefers-reduced-motion: no-preference) {
    button:active,
    a:active {
      transform: scale(0.97);
    }
  }
```

with:

```css
  @media (prefers-reduced-motion: no-preference) {
    button:not([data-press]):active,
    a:not([data-press]):active {
      transform: scale(0.97);
    }
  }
```

- [ ] **Step 6: Rewrite `src/Card.jsx`**

```jsx
import { motion } from 'motion/react'
import { snappy } from './motionPresets'
import { ChevronRightIcon } from './icons'

// `onPress` (not onClick) makes the card a pressable tile — onClick is
// still passed through untouched for the existing callers that use it to
// stop propagation inside overlays.
function Card({ className = '', onPress, chevron = false, children, ...rest }) {
  const base = `rounded-card bg-surface ${className}`

  if (!onPress) {
    return (
      <div className={base} {...rest}>
        {children}
      </div>
    )
  }

  return (
    <motion.button
      data-press
      type="button"
      onClick={onPress}
      whileTap={{ scale: 0.98 }}
      transition={snappy}
      className={`flex w-full items-center gap-3 text-left ${base}`}
      {...rest}
    >
      <span className="min-w-0 flex-1">{children}</span>
      {chevron && <ChevronRightIcon className="h-4 w-4 shrink-0 text-chalk-dim" />}
    </motion.button>
  )
}

export default Card
```

- [ ] **Step 7: Replace every `SectionLabel` usage**

For each file below:
- Remove `SectionLabel` from the `./Card` import. Change `import Card, { SectionLabel } from './Card'` to `import Card from './Card'`; in `Routines.jsx`, delete the line `import { SectionLabel } from './Card'`.
- Replace each `<SectionLabel>X</SectionLabel>` with:

```jsx
<h2 className="text-headline text-chalk">X</h2>
```

Call sites (from `grep -n SectionLabel src/*.jsx`):
- `src/HistoryLogSection.jsx` — `{logLabel}`, `History`
- `src/Home.jsx` — `Log a set`, `Today&apos;s sets`
- `src/Routines.jsx` — `Exercises`, `Schedule`
- `src/ProgressPhotosPage.jsx` — `Progress photos`
- `src/RoutinesPage.jsx` — `Routines`, `Exercises`
- `src/WaterTracker.jsx` — `Water`

Run `grep -rn SectionLabel src` afterwards. Expected: no output.

- [ ] **Step 8: Visual check.** On `/`, cards have 26px corners and no border, and section headers read as 20px semibold sentence case.

- [ ] **Step 9: Lint, build, commit**

```bash
npm run lint && npm run build
git add package.json package-lock.json src/motionPresets.js src/Button.jsx src/main.jsx src/Card.jsx src/index.css src/HistoryLogSection.jsx src/Home.jsx src/Routines.jsx src/ProgressPhotosPage.jsx src/RoutinesPage.jsx src/WaterTracker.jsx
git commit -m "Add motion presets, Button, and borderless Card; drop SectionLabel"
```

---

### Task 4: `Sheet` primitive and `ConfirmModal` on it

**Files:**
- Create: `src/Sheet.jsx`
- Modify: `src/ConfirmModal.jsx`, `src/index.css` (sheet-recede CSS)

**Interfaces:**
- Consumes: `smooth` from `motionPresets.js`, `useModalFocusTrap(active) → ref`, `useEscapeToClose(active, onClose)`, `Button`.
- Produces: `Sheet({ open, onClose, title?, size = 'auto' | 'large', children })` (default export).
  - Callers must keep rendering `<Sheet open={false}>` when closed, not `return null`, so `AnimatePresence` can play the exit using the last-rendered children.
  - Sets `html[data-sheet-open]` while any sheet is open.
- Produces: the root shell element id `app-shell` is scaled by CSS. Task 6 adds that id; until then the recede CSS matches nothing, which is harmless.

- [ ] **Step 1: Create `src/Sheet.jsx`**

```jsx
import { useEffect, useId } from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence, motion, useDragControls } from 'motion/react'
import { useEscapeToClose } from './useEscapeToClose'
import { useModalFocusTrap } from './useModalFocusTrap'
import { smooth } from './motionPresets'
import { CloseIcon } from './icons'

// Counted, not a boolean, because sheets nest (e.g. WorkoutDayModal opens a
// ConfirmModal on top of itself) and the background must stay receded until
// the last one closes. index.css keys the scale-down off this attribute.
let openSheetCount = 0

function useBackgroundRecede(open) {
  useEffect(() => {
    if (!open) return
    openSheetCount += 1
    document.documentElement.setAttribute('data-sheet-open', '')
    return () => {
      openSheetCount -= 1
      if (openSheetCount === 0) document.documentElement.removeAttribute('data-sheet-open')
    }
  }, [open])
}

const DISMISS_DISTANCE_RATIO = 0.3
const DISMISS_VELOCITY = 500

// Always render this (with open={false} when closed) rather than returning
// null from the caller — AnimatePresence needs the element to stay in the
// tree to play the exit, and it keeps the last-rendered children for it.
function Sheet({ open, onClose, title, size = 'auto', children }) {
  const titleId = useId()
  const dragControls = useDragControls()
  const containerRef = useModalFocusTrap(open)
  useEscapeToClose(open, onClose)
  useBackgroundRecede(open)

  function handleDragEnd(_event, info) {
    const height = containerRef.current?.offsetHeight ?? 0
    if (info.offset.y > height * DISMISS_DISTANCE_RATIO || info.velocity.y > DISMISS_VELOCITY) {
      onClose()
    }
  }

  return createPortal(
    <AnimatePresence>
      {open && (
        <div key="sheet" className="fixed inset-0 z-40 flex items-end justify-center">
          <motion.div
            aria-hidden="true"
            className="absolute inset-0 bg-black/40"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={smooth}
            onClick={onClose}
          />
          <motion.div
            ref={containerRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby={title ? titleId : undefined}
            aria-label={title ? undefined : 'Dialog'}
            tabIndex={-1}
            className={`relative flex w-full max-w-md flex-col rounded-t-card bg-surface pb-[env(safe-area-inset-bottom)] text-chalk shadow-[0_-20px_60px_var(--shadow-tint)] focus:outline-none ${
              size === 'large' ? 'h-[92svh]' : 'max-h-[92svh]'
            }`}
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={smooth}
            drag="y"
            dragListener={false}
            dragControls={dragControls}
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={{ top: 0, bottom: 0.7 }}
            onDragEnd={handleDragEnd}
          >
            {/* Only this header starts a drag, so scrolling the body never
                gets hijacked into a dismiss. */}
            <div
              className="shrink-0 cursor-grab touch-none px-5 pt-2 pb-3 active:cursor-grabbing"
              onPointerDown={(e) => dragControls.start(e)}
            >
              <div className="mx-auto h-1.5 w-10 rounded-full bg-chalk-dim/40" />
              <div className="mt-3 flex min-h-8 items-center justify-between gap-3">
                {title ? (
                  <h2 id={titleId} className="min-w-0 truncate text-headline">
                    {title}
                  </h2>
                ) : (
                  <span />
                )}
                <button
                  type="button"
                  onClick={onClose}
                  aria-label="Close"
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-surface-2 text-chalk-dim"
                >
                  <CloseIcon className="h-4 w-4" />
                </button>
              </div>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 pb-6">
              {children}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body
  )
}

export default Sheet
```

- [ ] **Step 2: Add sheet-recede CSS to `src/index.css`** (append inside `@layer base`, before its closing brace)

```css
  /* iOS card-sheet effect: the app behind an open Sheet shrinks, rounds,
     and darkens. #app-shell is App.jsx's viewport-sized root, so scaling it
     doesn't disturb any fixed-position children. */
  #app-shell {
    transform-origin: 50% 50%;
    transition:
      transform 420ms cubic-bezier(0.32, 0.72, 0, 1),
      border-radius 420ms cubic-bezier(0.32, 0.72, 0, 1),
      filter 420ms ease;
  }

  html[data-sheet-open] body {
    background-color: #000;
  }

  html[data-sheet-open] #app-shell {
    transform: scale(0.94);
    border-radius: 16px;
    overflow: hidden;
    filter: brightness(0.7);
  }

  @media (prefers-reduced-motion: reduce) {
    #app-shell {
      transition: none;
    }
    html[data-sheet-open] #app-shell {
      transform: none;
      border-radius: 0;
    }
  }
```

- [ ] **Step 3: Rewrite `src/ConfirmModal.jsx` on `Sheet`**

```jsx
import Sheet from './Sheet'
import Button from './Button'

// A real confirmation for hard-to-reverse deletes (a whole routine, a
// library exercise, a photo) — as opposed to ConfirmDeleteButton's
// tap-to-arm pattern, still used for low-blast-radius deletes. Shaped like
// an iOS action sheet: message, destructive action, cancel.
function ConfirmModal({ open, title, message, confirmLabel = 'Delete', onConfirm, onCancel }) {
  return (
    <Sheet open={open} onClose={onCancel} title={title}>
      <p className="text-[15px] text-chalk-dim">{message}</p>
      <div className="mt-6 flex flex-col gap-2">
        <Button variant="destructive" size="lg" onClick={onConfirm}>
          {confirmLabel}
        </Button>
        <Button variant="secondary" size="lg" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </Sheet>
  )
}

export default ConfirmModal
```

- [ ] **Step 4: Verify in the browser** (preview, 375×812):
  - On `/train` (or `/routines` before Task 6), delete a routine. The sheet springs up.
  - Dragging it down past ~30% dismisses it; a short drag springs back.
  - Escape closes it; a backdrop tap closes it; focus returns to the trigger.
  - Confirm still deletes the routine.

- [ ] **Step 5: Lint, build, commit**

```bash
npm run lint && npm run build
git add src/Sheet.jsx src/ConfirmModal.jsx src/index.css
git commit -m "Add drag-to-dismiss Sheet and move ConfirmModal onto it"
```

---

### Task 5: Migrate the remaining modals onto `Sheet`

**Files:**
- Modify: `src/SettingsModal.jsx`, `src/WorkoutDayModal.jsx`, `src/ExerciseDetailModal.jsx`, `src/PlateCalculatorModal.jsx`, `src/HistoryChartModal.jsx`, `src/ProgressPhotosPage.jsx` (lightbox only)

**Interfaces:**
- Consumes: `Sheet({ open, onClose, title, size, children })`, `Button`.
- Produces: unchanged public props for every modal. Callers aren't touched.

The pattern for every modal:
1. Delete the `useEscapeToClose` / `useModalFocusTrap` calls, their imports, the `titleId` / `useId`, and the `CloseIcon` import if it's no longer used.
2. Delete the `if (!x) return null` early return.
3. Replace the outer `<div className="fixed inset-0 ...">` and inner `<Card ...>` wrapper, plus the title/close header row, with `<Sheet>`.
4. Any content that dereferences the nullable prop gets guarded with `x && (...)`.

- [ ] **Step 1: `src/HistoryChartModal.jsx`**
  - Remove the `useEscapeToClose` call and import, the `CloseIcon` import, and the `Card` import if unused.
  - Move the derived data and body into an inner component so nothing dereferences a null `group`.

The resulting shape:

```jsx
function HistoryChartModal({ group, valueKey, getValue, formatTooltip, emptyLabel, referenceValue, onClose }) {
  return (
    <Sheet open={!!group} onClose={onClose} title={group?.name}>
      {group && (
        <HistoryChartBody
          group={group}
          valueKey={valueKey}
          getValue={getValue}
          formatTooltip={formatTooltip}
          emptyLabel={emptyLabel}
          referenceValue={referenceValue}
        />
      )}
    </Sheet>
  )
}

function HistoryChartBody({ group, valueKey, getValue, formatTooltip, emptyLabel, referenceValue }) {
  const sorted = [...group.entries].sort((a, b) => (a.date < b.date ? -1 : 1))
  const chartData = sorted.map((entry) => ({
    date: formatDate(entry.date),
    [valueKey]: getValue(entry),
  }))

  return (
    <>
      {/* everything that was inside the old <Card> AFTER the title/close
          header row, starting at `<div className="mt-4">`, moved here
          verbatim */}
    </>
  )
}
```

Implementer note: the comment above is the one place this plan points at existing JSX rather than repeating it. Move the existing lines verbatim, from `<div className="mt-4">` down to just before `</Card>`. Add `import Sheet from './Sheet'`.

- [ ] **Step 2: `src/ExerciseDetailModal.jsx`**

```jsx
import Sheet from './Sheet'
import MuscleTags from './MuscleTags'
import MuscleBodyMap from './MuscleBodyMap'
import ExerciseProgression from './ExerciseProgression'

function ExerciseDetailModal({ exercise, userId, weightUnit, onClose, onError, onChanged }) {
  return (
    <Sheet open={!!exercise} onClose={onClose} title={exercise?.name} size="large">
      {exercise && (
        <>
          <MuscleTags muscles={exercise.exercise_muscles} />

          <div className="mt-4">
            <MuscleBodyMap muscles={exercise.exercise_muscles} />
          </div>

          <div className="mt-8">
            <h3 className="text-headline">Progression</h3>
            <ExerciseProgression
              exerciseId={exercise.id}
              userId={userId}
              weightUnit={weightUnit}
              onError={onError}
              onChanged={onChanged}
            />
          </div>
        </>
      )}
    </Sheet>
  )
}

export default ExerciseDetailModal
```

Keep the existing import paths for `MuscleTags` / `MuscleBodyMap` / `ExerciseProgression` exactly as the file had them; check the top of the file before replacing.

- [ ] **Step 3: `src/WorkoutDayModal.jsx`**
  - Remove the focus/escape hooks, `titleId`, `CloseIcon`, and the `if (!date) return null`. The effects above it already guard on `date`.
  - Replace the returned JSX with the version below.
  - Add imports `Sheet` and `Button`. Remove `Card` if unused.

```jsx
  return (
    <>
      <Sheet
        open={!!date}
        onClose={onClose}
        title={date ? formatDate(date, { year: true }) : ''}
      >
        {exerciseGroups === null ? (
          <p className="text-[15px] text-chalk-dim">Loading…</p>
        ) : exerciseGroups.length === 0 ? (
          <p className="text-[15px] text-chalk-dim">No sets logged this day.</p>
        ) : (
          <ul className="flex flex-col gap-4">
            {exerciseGroups.map((group) => (
              <li key={group.exerciseId}>
                <p className="text-[17px] font-semibold text-chalk">{group.name}</p>
                <p className="mt-1 text-[15px] text-chalk-dim tabular-nums">
                  {group.sets
                    .map((s) => `${toDisplayWeight(s.weight, weightUnit)}${weightUnit}×${s.reps}`)
                    .join(', ')}
                </p>
              </li>
            ))}
          </ul>
        )}

        {exerciseGroups && exerciseGroups.length > 0 && (
          <Button
            size="lg"
            className="mt-6"
            onClick={() => setConfirmRepeat(true)}
            loading={repeating}
          >
            Repeat this workout
          </Button>
        )}
      </Sheet>

      <ConfirmModal
        open={confirmRepeat}
        title="Repeat this workout?"
        message={`${sets?.length ?? 0} set${sets?.length === 1 ? '' : 's'} will be logged as part of today's workout.`}
        confirmLabel="Repeat"
        onConfirm={handleRepeat}
        onCancel={() => setConfirmRepeat(false)}
      />
    </>
  )
```

Before replacing, check the `exerciseGroups` derivation above the old early return. If it dereferences `date` or `sets` without a null guard, wrap it: `const exerciseGroups = sets === null ? null : groupByExercise(sets)`, keeping whatever function name the file uses.

- [ ] **Step 4: `src/PlateCalculatorModal.jsx`**
  - Remove `useModalFocusTrap`, `titleId`, `useId` (if unused), and the `CloseIcon` import.
  - Replace the outer overlay `<div>` + `<Card>` + header row with `<Sheet open onClose={onClose} title="Plate calculator">`, and close with `</Sheet>`.
  - Everything that was between the header row and `</Card>` stays verbatim as Sheet children.
  - Add `import Sheet from './Sheet'`.

(Parents mount this conditionally, so it animates in but not out; see Deviations #6.)

- [ ] **Step 5: `src/SettingsModal.jsx`**
  - Remove `useEscapeToClose`, `useModalFocusTrap`, `titleId`, the `CloseIcon` import, and `if (!open) return null`.
  - Replace the outer overlay `<div>` + `<Card ...>` + the header row (`<div className="flex items-start justify-between gap-3">…</div>`) with `<Sheet open={open} onClose={onClose} title="Settings" size="large">`.
  - Replace the closing `</Card></div>` with `</Sheet>`.
  - Add `import Sheet from './Sheet'`.
  - The `wasOpen` re-seed logic stays as-is. It runs during render and works whether or not the sheet is visible.

- [ ] **Step 6: Photo lightbox fade in `src/ProgressPhotosPage.jsx`**
  - Add `import { AnimatePresence, motion } from 'motion/react'` and `import { smooth } from './motionPresets'`.
  - Replace `{viewingPhoto && (<div onClick=... className="fixed inset-0 z-50 ... bg-ink/90 p-4">` … `</div>)}` with the version below.
  - The close button, `<img>`, and caption `<p>` inside stay verbatim.

```jsx
      <AnimatePresence>
        {viewingPhoto && (
          <motion.div
            key="lightbox"
            onClick={() => setViewingPhoto(null)}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={smooth}
            className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-3 bg-black/95 p-4"
          >
            {/* existing close button, <img>, and caption <p>, unchanged */}
          </motion.div>
        )}
      </AnimatePresence>
```

- [ ] **Step 7: Confirm no hand-rolled overlays remain**

```bash
grep -n "fixed inset-0" src/*.jsx
```

Expected: only `src/Sheet.jsx` and `src/ProgressPhotosPage.jsx` (the lightbox).

- [ ] **Step 8: Browser pass.** For each of these, open it, drag-dismiss it, Escape it, backdrop-tap it, and confirm its function still works:
  - Settings: save a username, toggle a card.
  - WorkoutDay: from `/calendar` tap a day, then Repeat → confirm sheet stacks on top.
  - Exercise detail: `/lifts` → tap an exercise.
  - Plate calculator: from the Log a set form.
  - Weight history chart: `/weight` → tap a user's history.
  - Photo lightbox: fades in and out.

- [ ] **Step 9: Lint, build, commit**

```bash
npm run lint && npm run build
git add src/SettingsModal.jsx src/WorkoutDayModal.jsx src/ExerciseDetailModal.jsx src/PlateCalculatorModal.jsx src/HistoryChartModal.jsx src/ProgressPhotosPage.jsx
git commit -m "Move every modal onto Sheet"
```

---

### Task 6: App shell — viewport layout, header, 4 tabs, nested routes

**Files:**
- Create: `src/legacyRoutes.js`, `src/legacyRoutes.check.js`, `src/SegmentedControl.jsx`, `src/TabSection.jsx`
- Modify: `src/App.jsx`, `src/Home.jsx:300-310`, `src/CalendarPage.jsx:543-551`, `src/SettingsModal.jsx`

**Interfaces:**
- Consumes: `Sheet`, `smooth`, `snappy`.
- Produces:
  - `ROUTE_PATHS: string[]` and `LEGACY_REDIRECTS: Record<string,string>` from `src/legacyRoutes.js`.
  - `SegmentedControl({ segments: { key, label, to?, end? }[], value?, onChange?, layoutId })`. With `to`, segments are `NavLink`s; otherwise buttons driven by `value`/`onChange`.
  - `TabSection({ segments })`: segmented control + `<Outlet/>`.
  - `SettingsModal` gains props `theme: 'dark'|'light'` and `onThemeChange(theme)`.
  - `#app-shell` element and `data-scroll-root` main element in `App.jsx`.

- [ ] **Step 1: Write the failing check `src/legacyRoutes.check.js`**

```js
// Run: node src/legacyRoutes.check.js
import assert from 'node:assert/strict'
import { ROUTE_PATHS, LEGACY_REDIRECTS } from './legacyRoutes.js'

const expected = {
  '/routines': '/train',
  '/lifts': '/train/exercises',
  '/calendar': '/progress',
  '/history': '/progress/history',
  '/weight': '/body',
  '/photos': '/body/photos',
  '/timer': '/',
}
assert.deepEqual(LEGACY_REDIRECTS, expected)

for (const [from, to] of Object.entries(LEGACY_REDIRECTS)) {
  assert.ok(ROUTE_PATHS.includes(to), `${from} → ${to} targets a route that doesn't exist`)
  assert.ok(!(to in LEGACY_REDIRECTS), `${from} → ${to} is a redirect chain`)
  assert.ok(!ROUTE_PATHS.includes(from), `${from} is both legacy and live`)
}

console.log('legacyRoutes: ok')
```

- [ ] **Step 2: Run it to verify it fails**

Run: `node src/legacyRoutes.check.js`
Expected: FAIL with `Cannot find module ... legacyRoutes.js`.

- [ ] **Step 3: Create `src/legacyRoutes.js`**

```js
// Every live path the router serves. Kept here (not only as JSX in App)
// so legacyRoutes.check.js can prove each redirect lands somewhere real.
export const ROUTE_PATHS = [
  '/',
  '/train',
  '/train/exercises',
  '/progress',
  '/progress/history',
  '/body',
  '/body/photos',
]

// Pre-revamp URLs — bookmarks and the installed PWA's last-visited page
// still point at these.
export const LEGACY_REDIRECTS = {
  '/routines': '/train',
  '/lifts': '/train/exercises',
  '/calendar': '/progress',
  '/history': '/progress/history',
  '/weight': '/body',
  '/photos': '/body/photos',
  '/timer': '/',
}
```

- [ ] **Step 4: Run the check to verify it passes**

Run: `node src/legacyRoutes.check.js`
Expected: `legacyRoutes: ok`

- [ ] **Step 5: Create `src/SegmentedControl.jsx`**

```jsx
import { NavLink } from 'react-router-dom'
import { motion } from 'motion/react'
import { snappy } from './motionPresets'

// iOS segmented control. The thumb is a shared-layout element, so switching
// segments slides it rather than blinking it. layoutId must be unique per
// control on screen.
function SegmentedControl({ segments, value, onChange, layoutId }) {
  const thumb = (
    <motion.span
      layoutId={layoutId}
      transition={snappy}
      className="absolute inset-0 rounded-full bg-surface-2 shadow-[0_1px_4px_var(--shadow-tint)] [html[data-theme=light]_&]:bg-ink"
    />
  )
  const segmentClass = (active) =>
    `relative flex h-8 flex-1 items-center justify-center rounded-full text-[13px] font-semibold ${
      active ? 'text-chalk' : 'text-chalk-dim'
    }`

  return (
    <div className="flex rounded-full bg-surface p-0.5">
      {segments.map((segment) =>
        segment.to ? (
          <NavLink key={segment.key} to={segment.to} end={segment.end} data-press className={({ isActive }) => segmentClass(isActive)}>
            {({ isActive }) => (
              <>
                {isActive && thumb}
                <span className="relative">{segment.label}</span>
              </>
            )}
          </NavLink>
        ) : (
          <button
            key={segment.key}
            type="button"
            data-press
            aria-pressed={value === segment.key}
            onClick={() => onChange(segment.key)}
            className={segmentClass(value === segment.key)}
          >
            {value === segment.key && thumb}
            <span className="relative">{segment.label}</span>
          </button>
        )
      )}
    </div>
  )
}

export default SegmentedControl
```

- [ ] **Step 6: Create `src/TabSection.jsx`**

```jsx
import { Outlet } from 'react-router-dom'
import SegmentedControl from './SegmentedControl'

function TabSection({ segments, layoutId }) {
  return (
    <div className="flex flex-col gap-6">
      <SegmentedControl segments={segments} layoutId={layoutId} />
      <Outlet />
    </div>
  )
}

export default TabSection
```

- [ ] **Step 7: Add theme control to `src/SettingsModal.jsx`**
  - Add props `theme` and `onThemeChange` to the destructured props.
  - Import `SegmentedControl`.
  - As the first child of `<Sheet>`, before the Username label, insert:

```jsx
        <h3 className="text-headline">Appearance</h3>
        <div className="mt-3">
          <SegmentedControl
            layoutId="settings-theme"
            value={theme}
            onChange={onThemeChange}
            segments={[
              { key: 'dark', label: 'Dark' },
              { key: 'light', label: 'Light' },
            ]}
          />
        </div>
```

Change the Username label's `mt-4` to `mt-8`.

- [ ] **Step 8: Rewrite the shell in `src/App.jsx`**

Imports:
- Replace the `react-router-dom` import with: `import { Routes, Route, NavLink, Link, Navigate, useLocation } from 'react-router-dom'`
- Add: `import { AnimatePresence, motion } from 'motion/react'`, `import { smooth } from './motionPresets'`, `import TabSection from './TabSection'`, `import { LEGACY_REDIRECTS } from './legacyRoutes'`
- From `./icons` import only `GridIcon, BarbellIcon, CalendarIcon, ScaleIcon, TimerIcon`.
- Remove the `TimerPage` import for now; Task 7 adds `TimerSheet`.

Replace `PAGE_TITLES` and `TABS` with:

```jsx
const TABS = [
  { to: '/', label: 'Today', icon: GridIcon, end: true },
  { to: '/train', label: 'Train', icon: BarbellIcon },
  { to: '/progress', label: 'Progress', icon: CalendarIcon },
  { to: '/body', label: 'Body', icon: ScaleIcon },
]

const PAGE_TITLES = Object.fromEntries(TABS.map((tab) => [tab.to, tab.label]))

const TRAIN_SEGMENTS = [
  { key: 'routines', label: 'Routines', to: '/train', end: true },
  { key: 'exercises', label: 'Exercises', to: '/train/exercises' },
]
const PROGRESS_SEGMENTS = [
  { key: 'calendar', label: 'Calendar', to: '/progress', end: true },
  { key: 'history', label: 'History', to: '/progress/history' },
]
const BODY_SEGMENTS = [
  { key: 'weight', label: 'Weight', to: '/body', end: true },
  { key: 'photos', label: 'Photos', to: '/body/photos' },
]

function initials(profile) {
  if (!profile) return ''
  return displayName(profile).slice(0, 2).toUpperCase()
}
```

In the `App` body, add these after `const restTimer = useRestTimer()`:

```jsx
  const scrollRootRef = useRef(null)
  const titleSentinelRef = useRef(null)
  const [titleCollapsed, setTitleCollapsed] = useState(false)
```

After the existing effects, and before the `if (!sessionChecked)` early return, add the two effects below. Hooks must stay above early returns.

```jsx
  const tabKey = '/' + location.pathname.split('/')[1]

  // Each tab starts at the top — the scroll container persists across tab
  // switches now that the page itself no longer scrolls.
  useEffect(() => {
    scrollRootRef.current?.scrollTo(0, 0)
  }, [tabKey])

  // iOS large-title collapse: when the sentinel under the big title scrolls
  // out of view, the compact frosted bar fades in.
  useEffect(() => {
    const sentinel = titleSentinelRef.current
    if (!sentinel) return
    const observer = new IntersectionObserver(
      ([entry]) => setTitleCollapsed(!entry.isIntersecting),
      { root: scrollRootRef.current, threshold: 0 }
    )
    observer.observe(sentinel)
    return () => observer.disconnect()
  }, [session])
```

Replace the whole post-auth `return (...)`, from `const pageTitle = ...` through the end of the `return`, with the code below. The existing route `element` props for each page stay identical; only their paths and nesting change.

```jsx
  const pageTitle = PAGE_TITLES[tabKey] ?? 'Ackygym'
  const currentProfile = profiles.find((p) => p.id === session.user.id)
  const todayCaption = new Date().toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  })

  return (
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
        <div className="mx-auto flex max-w-md flex-col gap-10 px-5 pt-[calc(env(safe-area-inset-top)+3.5rem)] pb-[calc(env(safe-area-inset-bottom)+9rem)]">
          <header className="flex items-end justify-between gap-3">
            <div className="min-w-0">
              <p className="h-5 text-caption text-chalk-dim">{tabKey === '/' ? todayCaption : ''}</p>
              <h1 className="text-large-title">{pageTitle}</h1>
            </div>
            <button
              type="button"
              onClick={() => setSettingsOpen(true)}
              aria-label="Settings"
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-surface-2 text-[13px] font-semibold text-chalk"
            >
              {initials(currentProfile)}
            </button>
          </header>
          <div ref={titleSentinelRef} aria-hidden="true" className="-mt-10 h-0" />

          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={tabKey}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ ...smooth, opacity: { duration: 0.18 } }}
            >
              <Routes location={location}>
                <Route path="/" element={/* existing <Home .../> element, plus onSetLogged in Task 7 */} />
                <Route path="/train" element={<TabSection segments={TRAIN_SEGMENTS} layoutId="seg-train" />}>
                  <Route index element={/* existing <RoutinesPage .../> element */} />
                  <Route path="exercises" element={/* existing <LiftsPage .../> element */} />
                </Route>
                <Route path="/progress" element={<TabSection segments={PROGRESS_SEGMENTS} layoutId="seg-progress" />}>
                  <Route index element={/* existing <CalendarPage .../> element */} />
                  <Route path="history" element={/* existing <SetsHistoryPage .../> element */} />
                </Route>
                <Route path="/body" element={<TabSection segments={BODY_SEGMENTS} layoutId="seg-body" />}>
                  <Route index element={/* existing <BodyWeightPage .../> element */} />
                  <Route path="photos" element={/* existing <ProgressPhotosPage .../> element */} />
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
          </AnimatePresence>
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

      {/* existing offline/error <p> banners, TEMPORARILY placed here; Task 8 restyles them */}

      <SettingsModal
        open={settingsOpen}
        theme={theme}
        onThemeChange={setTheme}
        /* every other existing SettingsModal prop unchanged */
      />
    </div>
  )
```

Implementer notes for this step:
- Where the snippet says `/* existing <X .../> element */`, paste that route's current `element={...}` JSX from the old `<Routes>` block, byte for byte.
- Delete the old `/timer` route (the `/timer` legacy redirect replaces it) and the old header's Settings and theme-toggle buttons.
- Move the offline and error `<p>` banners to the marked spot unchanged, and add `className` positioning `absolute inset-x-5 top-[calc(env(safe-area-inset-top)+0.5rem)] z-20` so they stay visible. Also delete the `errorRef` scroll-into-view effect and `errorRef` itself.
- `useEffect` placement: all hooks must stay above `if (!sessionChecked)` and `if (!session)`. Compute `tabKey` above them too.

- [ ] **Step 9: Update in-page links**
  - `src/Home.jsx`, around line 301: `to="/routines"` → `to="/train"`.
  - `src/CalendarPage.jsx`, around line 544: `to="/history"` → `to="/progress/history"`.

Then run:

```bash
grep -rn "to=\"/\(routines\|history\|lifts\|calendar\|weight\|photos\|timer\)\"\|navigate('/\(routines\|history\|lifts\|calendar\|weight\|photos\|timer\)" src
```

Expected: no output. (`RoutinesPage`'s `navigate('/')` is still correct.)

- [ ] **Step 10: Browser pass (375×812, both themes)**
  - Each tab crossfades. Switching Routines↔Exercises slides only the segmented thumb; the page doesn't fade.
  - Scrolling past the large title fades in the frosted compact bar.
  - The avatar opens Settings; the Dark/Light segment switches the theme live.
  - Reloading on `/train/exercises` works.
  - Visiting each legacy URL (`/lifts`, `/history`, `/timer`, ...) lands on the mapped route.
  - Opening any sheet scales and darkens the app behind it.

- [ ] **Step 11: Lint, build, check, commit**

```bash
npm run lint && npm run build && node src/legacyRoutes.check.js
git add src/legacyRoutes.js src/legacyRoutes.check.js src/SegmentedControl.jsx src/TabSection.jsx src/App.jsx src/Home.jsx src/CalendarPage.jsx src/SettingsModal.jsx
git commit -m "Rebuild the shell around four tabs with large titles and segmented sub-pages"
```

---

### Task 7: Rest timer — sheet, floating pill, auto-rest

**Files:**
- Rename: `src/TimerPage.jsx` → `src/TimerPanel.jsx`
- Create: `src/TimerSheet.jsx`, `src/TimerPill.jsx`, `src/autoRestSettings.js`
- Modify: `src/useRestTimer.js`, `src/App.jsx`, `src/Home.jsx`, `src/SettingsModal.jsx`

**Interfaces:**
- Consumes: `Sheet`, `Button`, `smooth`, `snappy`. The `useRestTimer()` return shape is `{ duration, remaining, status, selectDuration, start, pause, reset }`.
- Produces:
  - `useRestTimer()` also returns `restart()`: starts a fresh countdown of `duration`, regardless of current status.
  - `loadAutoRest(): boolean` (default `true`) and `saveAutoRest(bool)` from `src/autoRestSettings.js`.
  - `TimerSheet({ open, onClose, timer })`, where `timer` is the whole `useRestTimer()` object.
  - `TimerPill({ timer, onOpen })`.
  - `Home` gains the prop `onSetLogged()`.
  - `SettingsModal` gains the props `autoRest: boolean` and `onAutoRestChange(bool)`.

- [ ] **Step 1: Add `restart()` and a first-gesture audio unlock to `src/useRestTimer.js`**

Add after `reset()`:

```js
  // For auto-rest after logging a set: always a fresh full countdown, even
  // mid-rest or paused. start() can't do this — it resumes from `remaining`
  // when paused, and reads `status` from this render's closure.
  function restart() {
    unlockAudio()
    endTimeRef.current = Date.now() + duration * 1000
    setRemaining(duration)
    setStatus('running')
  }
```

Change the return to:

```js
  return { duration, remaining, status, selectDuration, start, pause, reset, restart }
```

Add this effect after the existing `useEffect`:

```js
  // restart() usually runs after an awaited Supabase insert — no longer
  // inside a user gesture, so iOS Safari won't let it create/resume the
  // AudioContext. Unlocking on the app's first tap means the alert can
  // still play when an auto-started rest finishes.
  useEffect(() => {
    window.addEventListener('pointerdown', unlockAudio, { once: true })
    return () => window.removeEventListener('pointerdown', unlockAudio)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- unlockAudio only touches refs
  }, [])
```

If lint flags `unlockAudio` as used before definition, move this effect below the `unlockAudio` function.

- [ ] **Step 2: Create `src/autoRestSettings.js`**

```js
const STORAGE_KEY = 'gym-tracker:auto-rest'

export function loadAutoRest() {
  return localStorage.getItem(STORAGE_KEY) !== 'false'
}

export function saveAutoRest(enabled) {
  localStorage.setItem(STORAGE_KEY, String(enabled))
}
```

- [ ] **Step 3: Rename and restyle the panel**

```bash
git mv src/TimerPage.jsx src/TimerPanel.jsx
```

In `src/TimerPanel.jsx`:
- Rename the function to `TimerPanel`, and the default export too.
- Import `Button` and `SegmentedControl`.
- Replace the presets grid (`<div className="grid grid-cols-4 gap-2">…</div>`) with:

```jsx
      <SegmentedControl
        layoutId="timer-presets"
        value={duration}
        onChange={selectDuration}
        segments={PRESETS.map((p) => ({ key: p.seconds, label: p.label }))}
      />
```

- Replace the three-button controls grid at the bottom with:

```jsx
      <div className="grid grid-cols-3 gap-2">
        <Button size="lg" onClick={onStart} disabled={status === 'running'}>
          {status === 'paused' ? 'Resume' : 'Start'}
        </Button>
        <Button size="lg" variant="secondary" onClick={onPause} disabled={status !== 'running'}>
          Pause
        </Button>
        <Button size="lg" variant="secondary" onClick={onReset}>
          Reset
        </Button>
      </div>
```

- In the dial, change the time `<p>` classes from `font-mono text-6xl font-bold` to `text-hero tabular-nums`, and the status `<p>` from `font-mono text-xs tracking-[0.3em] uppercase` to `text-caption`.
- The custom-seconds form stays.

- [ ] **Step 4: Create `src/TimerSheet.jsx`**

```jsx
import Sheet from './Sheet'
import TimerPanel from './TimerPanel'

function TimerSheet({ open, onClose, timer }) {
  return (
    <Sheet open={open} onClose={onClose} title="Rest">
      <TimerPanel
        duration={timer.duration}
        remaining={timer.remaining}
        status={timer.status}
        selectDuration={timer.selectDuration}
        onStart={timer.start}
        onPause={timer.pause}
        onReset={timer.reset}
      />
    </Sheet>
  )
}

export default TimerSheet
```

- [ ] **Step 5: Create `src/TimerPill.jsx`**

```jsx
import { AnimatePresence, motion } from 'motion/react'
import { smooth } from './motionPresets'

const RING_RADIUS = 9
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS

function formatTime(totalSeconds) {
  const clamped = Math.max(0, Math.round(totalSeconds))
  return `${Math.floor(clamped / 60)}:${String(clamped % 60).padStart(2, '0')}`
}

// Floats above the tab bar on every tab whenever a rest is in progress, so
// the countdown is never more than a glance away mid-workout.
function TimerPill({ timer, onOpen }) {
  const { status, remaining, duration } = timer
  const visible = status !== 'idle'
  const finished = status === 'finished'
  const fraction = duration > 0 ? remaining / duration : 0

  return (
    <AnimatePresence>
      {visible && (
        <motion.button
          key="timer-pill"
          type="button"
          data-press
          onClick={onOpen}
          aria-label={finished ? 'Rest finished — open timer' : `Rest timer, ${formatTime(remaining)} left — open timer`}
          initial={{ opacity: 0, y: 16, scale: 0.9 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 16, scale: 0.9 }}
          whileTap={{ scale: 0.96 }}
          transition={smooth}
          className="absolute bottom-[calc(env(safe-area-inset-bottom)+4.25rem)] left-1/2 z-20 flex -translate-x-1/2 items-center gap-2.5 rounded-full bg-surface-2 py-2.5 pr-4 pl-3 text-[15px] font-semibold shadow-[0_10px_30px_var(--shadow-tint)]"
        >
          <svg viewBox="0 0 22 22" className="h-[22px] w-[22px] -rotate-90">
            <circle cx="11" cy="11" r={RING_RADIUS} fill="none" stroke="var(--color-line)" strokeWidth="3" />
            <circle
              cx="11"
              cy="11"
              r={RING_RADIUS}
              fill="none"
              stroke="var(--color-blue-400)"
              strokeWidth="3"
              strokeLinecap="round"
              strokeDasharray={RING_CIRCUMFERENCE}
              strokeDashoffset={finished ? 0 : RING_CIRCUMFERENCE * (1 - fraction)}
              className="transition-[stroke-dashoffset] duration-200 ease-linear"
            />
          </svg>
          <span className="tabular-nums">{finished ? 'Done' : formatTime(remaining)}</span>
          <span className="font-medium text-chalk-dim">{status === 'paused' ? 'Paused' : 'Rest'}</span>
        </motion.button>
      )}
    </AnimatePresence>
  )
}

export default TimerPill
```

Note: `-translate-x-1/2` and motion's `x`/`scale` transforms would conflict. motion writes `transform` inline, overriding Tailwind's translate. If the pill renders off-center, wrap it in a `<div className="absolute inset-x-0 bottom-[...] z-20 flex justify-center">` and drop `absolute left-1/2 -translate-x-1/2` and the bottom offset from the button.

- [ ] **Step 6: Wire the timer into `src/App.jsx`**
  - Add imports: `TimerSheet`, `TimerPill`, `{ loadAutoRest, saveAutoRest } from './autoRestSettings'`, and `TimerIcon` is already imported.
  - Add state:

```jsx
  const [timerOpen, setTimerOpen] = useState(false)
  const [autoRest, setAutoRestState] = useState(loadAutoRest)

  function setAutoRest(next) {
    setAutoRestState(next)
    saveAutoRest(next)
  }

  function handleSetLogged() {
    if (autoRest) restTimer.restart()
  }
```

  - In the header, before the avatar button, add a timer button shown on the Train tab. That's the idle entry point:

```jsx
            <div className="flex shrink-0 items-center gap-2">
              {tabKey === '/train' && (
                <button
                  type="button"
                  onClick={() => setTimerOpen(true)}
                  aria-label="Rest timer"
                  className="flex h-9 w-9 items-center justify-center rounded-full bg-surface-2 text-chalk"
                >
                  <TimerIcon className="h-5 w-5" />
                </button>
              )}
              {/* existing avatar button */}
            </div>
```

  - Pass `onSetLogged={handleSetLogged}` to the `<Home>` element.
  - Pass `autoRest={autoRest}` and `onAutoRestChange={setAutoRest}` to `<SettingsModal>`.
  - Render these just before `<SettingsModal>`:

```jsx
      <TimerPill timer={restTimer} onOpen={() => setTimerOpen(true)} />
      <TimerSheet open={timerOpen} onClose={() => setTimerOpen(false)} timer={restTimer} />
```

- [ ] **Step 7: Call `onSetLogged` from `src/Home.jsx`**
  - Add `onSetLogged` to Home's destructured props.
  - Call `onSetLogged()` in three places, each right after the existing `setShowTodaysSets(true)`:
    1. `handleRepeatSet` (around line 175)
    2. the `WorkoutForm` `onLogged` arrow (around line 332)
    3. the `ActiveRoutine` `onLogged` arrow (around line 346)
  - `WorkoutDayModal`'s bulk "Repeat this workout" is intentionally excluded. It logs a whole past workout at once, which isn't a set followed by rest.

- [ ] **Step 8: Add the auto-rest toggle to `src/SettingsModal.jsx`**
  - Add `autoRest` and `onAutoRestChange` to the props.
  - After the Weight unit block, insert:

```jsx
        <h3 className="mt-8 text-headline">Workout</h3>
        <label className="mt-3 flex items-center justify-between gap-3 rounded-field bg-surface-2 px-4 py-3.5">
          <span className="text-[15px] text-chalk">
            Auto-start rest after logging a set
          </span>
          <input
            type="checkbox"
            checked={autoRest}
            onChange={(e) => onAutoRestChange(e.target.checked)}
            className="h-5 w-5 accent-blue-500"
          />
        </label>
```

- [ ] **Step 9: Browser pass**
  - On Today, log a set. The pill springs in and counts down from the last-used duration.
  - Log another mid-rest; the countdown restarts at the full duration.
  - Tap the pill; the timer sheet opens with the dial; Pause shows "Paused" in the pill.
  - At zero, the pill shows "Done".
  - Reset in the sheet: the pill springs out.
  - Turn Auto-rest off in Settings, log a set: no pill.
  - On Train, the header timer button opens the sheet while idle.

- [ ] **Step 10: Lint, build, commit**

```bash
npm run lint && npm run build
git add src/TimerPanel.jsx src/TimerSheet.jsx src/TimerPill.jsx src/autoRestSettings.js src/useRestTimer.js src/App.jsx src/Home.jsx src/SettingsModal.jsx
git commit -m "Move the rest timer into a sheet with a floating pill and auto-rest"
```

---

### Task 8: Floating banners and `UndoToast` restyle

**Files:**
- Modify: `src/App.jsx` (banners), `src/UndoToast.jsx`

**Interfaces:**
- Consumes: `smooth`.
- Produces: `UndoToast({ message, onUndo })`, same props.

- [ ] **Step 1: Replace the temporary banners in `src/App.jsx`**

Delete the two `<p>` banners placed in Task 6. Put this in their spot:

```jsx
      <div className="pointer-events-none absolute inset-x-0 top-[calc(env(safe-area-inset-top)+0.5rem)] z-30 flex flex-col items-center gap-2 px-5">
        <AnimatePresence>
          {!isOnline && (
            <motion.p
              key="offline"
              initial={{ opacity: 0, y: -12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              transition={smooth}
              className="rounded-full bg-surface-2 px-4 py-2 text-[13px] font-semibold text-amber shadow-[0_10px_30px_var(--shadow-tint)]"
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
              className="pointer-events-auto flex max-w-full items-center gap-3 rounded-full bg-surface-2 py-2 pr-2 pl-4 text-[13px] font-semibold text-danger shadow-[0_10px_30px_var(--shadow-tint)]"
            >
              <span className="min-w-0">{error}</span>
              <button
                type="button"
                onClick={() => handleError('')}
                aria-label="Dismiss"
                className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-surface text-chalk-dim"
              >
                <CloseIcon className="h-3.5 w-3.5" />
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
```

Add `CloseIcon` to the `./icons` import. Add the auto-dismiss effect alongside the other hooks, above the early returns:

```jsx
  // Errors used to sit in the page flow until the next action cleared them;
  // as a floating pill it would cover the header forever, so it times out.
  useEffect(() => {
    if (!error) return
    const id = setTimeout(() => setError(''), 6000)
    return () => clearTimeout(id)
  }, [error])
```

- [ ] **Step 2: Rewrite `src/UndoToast.jsx`**

```jsx
import { AnimatePresence, motion } from 'motion/react'
import { smooth } from './motionPresets'

// Purely presentational — the timing lives in useDeferredDelete. Sits above
// the tab bar and the timer pill's slot. z-30 keeps it under open sheets
// (z-40), which is fine: every deferred delete is triggered from a page,
// not from inside a sheet.
function UndoToast({ message, onUndo }) {
  return (
    <AnimatePresence>
      {message && (
        <motion.div
          key="undo"
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 16 }}
          transition={smooth}
          className="fixed inset-x-0 bottom-[calc(env(safe-area-inset-bottom)+8rem)] z-30 flex justify-center px-5"
        >
          <div className="flex items-center gap-4 rounded-full bg-surface-2 py-2.5 pr-3 pl-5 shadow-[0_10px_30px_var(--shadow-tint)]">
            <span role="status" aria-live="polite" className="text-[15px] text-chalk">
              {message}
            </span>
            <button type="button" onClick={onUndo} className="shrink-0 text-[15px] font-semibold text-blue-400">
              Undo
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

export default UndoToast
```

Note: `UndoToast` renders inside pages, which now sit in `#app-shell`. `fixed` still resolves to the viewport because `#app-shell` has no transform unless a sheet is open.

- [ ] **Step 3: Browser pass**
  - Toggle DevTools offline: the amber pill slides in at the top; back online, it slides out.
  - Force an error (e.g. log a set while offline): the red pill appears, × dismisses it, and it auto-hides after 6s.
  - Delete a set on Today: the undo pill springs up above the timer-pill slot; Undo restores the set.

- [ ] **Step 4: Lint, build, commit**

```bash
npm run lint && npm run build
git add src/App.jsx src/UndoToast.jsx
git commit -m "Float offline/error banners and the undo toast as animated pills"
```

---

### Task 9: `Skeleton` and first-load placeholders

**Files:**
- Create: `src/Skeleton.jsx`
- Modify: `src/index.css` (shimmer keyframes)
- Modify (replace "Loading…" placeholders): `src/Home.jsx:385-388`, `src/CalendarPage.jsx:394-399`, `src/LiftsPage.jsx:213-216`, `src/RoutinesPage.jsx:226-227`, `src/Routines.jsx:423-424`, `src/ProgressPhotosPage.jsx:299-302`, `src/HistoryLogSection.jsx:172-175`, `src/ActiveRoutine.jsx:130-131`, `src/MuscleVolume.jsx:125-126`

**Interfaces:**
- Produces: `Skeleton({ className })` (default export): a tone-on-tone block. `className` sets its size and shape.

- [ ] **Step 1: Add the shimmer to `src/index.css`** (inside `@layer utilities`)

```css
  @keyframes skeleton-shimmer {
    from {
      background-position: 150% 0;
    }
    to {
      background-position: -50% 0;
    }
  }

  .skeleton {
    background-color: var(--color-surface);
    background-image: linear-gradient(
      90deg,
      transparent 0%,
      color-mix(in oklab, var(--color-chalk) 6%, transparent) 50%,
      transparent 100%
    );
    background-size: 200% 100%;
    animation: skeleton-shimmer 1.4s ease-in-out infinite;
  }

  @media (prefers-reduced-motion: reduce) {
    .skeleton {
      animation: none;
    }
  }
```

- [ ] **Step 2: Create `src/Skeleton.jsx`**

```jsx
// First-load placeholder only — shaped like the content it stands in for so
// nothing shifts when data lands. Never shown on refetch (see pageCache).
function Skeleton({ className = '' }) {
  return <div aria-hidden="true" className={`skeleton rounded-card ${className}`} />
}

export default Skeleton
```

- [ ] **Step 3: Replace each "Loading…" placeholder**

Import `Skeleton` in each file, and wrap every replacement in an element with `aria-busy="true"` and an `sr-only` "Loading" label so screen readers still hear it.

`src/Home.jsx` (today's sets). Replace the `<Card className="p-4"><p ...>Loading…</p></Card>` with:

```jsx
          <div aria-busy="true" className="flex flex-col gap-3">
            <span className="sr-only">Loading</span>
            <Skeleton className="h-24" />
            <Skeleton className="h-24" />
          </div>
```

`src/CalendarPage.jsx` (whole page). Replace the early-return Card with:

```jsx
    return (
      <div aria-busy="true" className="flex flex-col gap-3">
        <span className="sr-only">Loading</span>
        <Skeleton className="h-56" />
        <Skeleton className="h-32" />
      </div>
    )
```

`src/LiftsPage.jsx`, `src/ProgressPhotosPage.jsx`, `src/HistoryLogSection.jsx`: replace the Loading Card with:

```jsx
        <div aria-busy="true" className="flex flex-col gap-3">
          <span className="sr-only">Loading</span>
          <Skeleton className="h-16" />
          <Skeleton className="h-16" />
          <Skeleton className="h-16" />
        </div>
```

`src/RoutinesPage.jsx`, `src/Routines.jsx`, `src/ActiveRoutine.jsx`, `src/MuscleVolume.jsx`: these sit inside a card already, so use flatter bars. Replace the `<p ...>Loading…</p>` with:

```jsx
        <div aria-busy="true" className="mt-3 flex flex-col gap-2">
          <span className="sr-only">Loading</span>
          <Skeleton className="h-11 rounded-field bg-surface-2" />
          <Skeleton className="h-11 rounded-field bg-surface-2" />
        </div>
```

Leave `BodyWeightPage.jsx:50` and `CalorieTracker.jsx:31` alone. They're inline "Loading…" captions under a number, not blocks. Also leave `ExerciseProgression.jsx:134` and `WorkoutDayModal.jsx`; those are inside sheets and are redesigned with their pages.

- [ ] **Step 4: Verify**
  - `grep -n "Loading…" src/*.jsx`: only `BodyWeightPage`, `CalorieTracker`, `ExerciseProgression`, and `WorkoutDayModal` remain.
  - With DevTools → Network throttled to "Slow 4G", load each tab: shimmering blocks, then content, with no layout jump.

- [ ] **Step 5: Lint, build, commit**

```bash
npm run lint && npm run build
git add src/Skeleton.jsx src/index.css src/Home.jsx src/CalendarPage.jsx src/LiftsPage.jsx src/RoutinesPage.jsx src/Routines.jsx src/ProgressPhotosPage.jsx src/HistoryLogSection.jsx src/ActiveRoutine.jsx src/MuscleVolume.jsx
git commit -m "Replace Loading text with shaped skeletons"
```

---

### Task 10: Remount cache, so tab switches show data instantly

**Files:**
- Create: `src/pageCache.js`, `src/pageCache.check.js`
- Modify: `src/App.jsx` (clear on sign-out), `src/Home.jsx`, `src/CalendarPage.jsx`, `src/LiftsPage.jsx`, `src/RoutinesPage.jsx`, `src/BodyWeightPage.jsx`, `src/ProgressPhotosPage.jsx`, `src/HistoryLogSection.jsx`

**Interfaces:**
- Produces:
  - `useCachedState(key: string, initial) → [value, setValue]`: same contract as `useState`, but seeded from, and written through to, a module-level `Map` that survives unmounts.
  - `clearPageCache()`.
  - `cacheWrite(key, value)` / `cacheRead(key)`, the pure core, exported for the check.

- [ ] **Step 1: Write the failing check `src/pageCache.check.js`**

```js
// Run: node src/pageCache.check.js
import assert from 'node:assert/strict'
import { cacheRead, cacheWrite, clearPageCache } from './pageCache.js'

assert.deepEqual(cacheRead('a', 'fallback'), { hit: false, value: 'fallback' })
cacheWrite('a', [1, 2])
assert.deepEqual(cacheRead('a', 'fallback'), { hit: true, value: [1, 2] })
cacheWrite('a', [])
assert.deepEqual(cacheRead('a', 'fallback'), { hit: true, value: [] }, 'empty results are still a hit')
clearPageCache()
assert.deepEqual(cacheRead('a', 'fallback'), { hit: false, value: 'fallback' })

console.log('pageCache: ok')
```

- [ ] **Step 2: Run it to verify it fails**

Run: `node src/pageCache.check.js`
Expected: FAIL with `Cannot find module ... pageCache.js`.

- [ ] **Step 3: Create `src/pageCache.js`**

```js
import { useCallback, useState } from 'react'

// Tab switches unmount pages, and each page's first render used to show
// "Loading…" again while it refetched. This keeps each page's last data in
// memory so a remount paints instantly; the page's own fetch effect still
// runs and swaps in fresh data (stale-while-revalidate). In-memory only —
// a reload starts clean, and sign-out clears it (App.jsx).
const cache = new Map()

export function cacheRead(key, initial) {
  return cache.has(key) ? { hit: true, value: cache.get(key) } : { hit: false, value: initial }
}

export function cacheWrite(key, value) {
  cache.set(key, value)
}

export function clearPageCache() {
  cache.clear()
}

export function useCachedState(key, initial) {
  const [value, setValue] = useState(() => cacheRead(key, initial).value)

  const setCached = useCallback(
    (next) => {
      setValue((prev) => {
        const resolved = typeof next === 'function' ? next(prev) : next
        cacheWrite(key, resolved)
        return resolved
      })
    },
    [key]
  )

  return [value, setCached]
}
```

- [ ] **Step 4: Run the check to verify it passes**

Run: `node src/pageCache.check.js`
Expected: `pageCache: ok`

- [ ] **Step 5: Clear on sign-out in `src/App.jsx`**

Import `clearPageCache` from `./pageCache`. In the `onAuthStateChange` callback, before `setSession(session)`, add:

```jsx
        // A different user signing in on this device must never see the
        // previous user's cached page data.
        if (!session) clearPageCache()
```

- [ ] **Step 6: Swap page-level `useState` for `useCachedState`**

Import `useCachedState` from `./pageCache` in each file and replace exactly these declarations. Keys are namespaced by file. Only primary fetched data and its `Loaded` flag change; UI state stays `useState`.

`src/Home.jsx`:

```jsx
  const [exercises, setExercises] = useCachedState('home:exercises', [])
  const [todaysSets, setTodaysSets] = useCachedState('home:todaysSets', [])
  const [todaysSetsLoaded, setTodaysSetsLoaded] = useCachedState('home:todaysSetsLoaded', false)
  const [routines, setRoutines] = useCachedState('home:routines', [])
```

`src/CalendarPage.jsx`:

```jsx
  const [dayDataByUser, setDayDataByUser] = useCachedState('calendar:dayDataByUser', new Map())
  const [setsLoaded, setSetsLoaded] = useCachedState('calendar:setsLoaded', false)
  const [scheduleMap, setScheduleMap] = useCachedState('calendar:scheduleMap', new Map())
```

`src/LiftsPage.jsx`:

```jsx
  const [exercises, setExercises] = useCachedState('lifts:exercises', [])
  const [exercisesLoaded, setExercisesLoaded] = useCachedState('lifts:exercisesLoaded', false)
```

`src/RoutinesPage.jsx`:

```jsx
  const [exercises, setExercises] = useCachedState('routinesPage:exercises', [])
  const [exercisesLoaded, setExercisesLoaded] = useCachedState('routinesPage:exercisesLoaded', false)
  const [routines, setRoutines] = useCachedState('routinesPage:routines', [])
  const [routinesLoaded, setRoutinesLoaded] = useCachedState('routinesPage:routinesLoaded', false)
```

`src/BodyWeightPage.jsx`:

```jsx
  const [entries, setEntries] = useCachedState('bodyWeight:entries', [])
  const [entriesLoaded, setEntriesLoaded] = useCachedState('bodyWeight:entriesLoaded', false)
```

`src/ProgressPhotosPage.jsx`:

```jsx
  const [photos, setPhotos] = useCachedState('photos:photos', [])
  const [photosLoaded, setPhotosLoaded] = useCachedState('photos:photosLoaded', false)
```

`src/HistoryLogSection.jsx` is shared by body weight and calories, so key by its `tableName` prop:

```jsx
  const [entries, setEntries] = useCachedState(`history:${tableName}:entries`, [])
  const [entriesLoaded, setEntriesLoaded] = useCachedState(`history:${tableName}:entriesLoaded`, false)
```

Check that `tableName` is in `HistoryLogSection`'s destructured props; it's passed by `BodyWeightPage` and `CalorieTracker`.

If a file no longer uses `useState` after the swap, remove it from the React import so lint passes.

- [ ] **Step 7: Verify**
  - `node src/pageCache.check.js` passes.
  - In the browser, visit Progress, then Today, then Progress. The second visit shows the calendar immediately with no skeleton, and a background request still fires (Network tab).
  - Sign out, then sign in as another user: no stale data from the first user appears.

- [ ] **Step 8: Lint, build, commit**

```bash
npm run lint && npm run build && node src/pageCache.check.js
git add src/pageCache.js src/pageCache.check.js src/App.jsx src/Home.jsx src/CalendarPage.jsx src/LiftsPage.jsx src/RoutinesPage.jsx src/BodyWeightPage.jsx src/ProgressPhotosPage.jsx src/HistoryLogSection.jsx
git commit -m "Cache page data across tab switches so remounts paint instantly"
```

---

### Task 11: Full verification pass

**Files:** none modified unless a check fails. Fix inline in the file at fault and commit as `Fix <thing> found in foundation QA`.

- [ ] **Step 1: Static checks**

```bash
npm run lint && npm run build && node src/legacyRoutes.check.js && node src/pageCache.check.js
```

Expected: all pass. Build output has no warnings about unresolved imports.

- [ ] **Step 2: Browser matrix.** Preview at 375×812. Run the whole list once with `resize_window colorScheme: dark` and once with light (toggle via Settings):
  1. All 4 tabs and all 6 segments render. Tab switches crossfade; segment switches slide only the thumb.
  2. The large title collapses into the frosted bar on scroll, on every tab.
  3. Every sheet: Settings, Exercise detail, Workout day (+ its nested Confirm), Plate calculator, Weight chart, Calorie chart, Timer, delete-routine Confirm. Each opens with a spring, the background recedes, drag >30% dismisses, a short drag snaps back, Escape and backdrop close it, and focus returns to its trigger.
  4. Log a set on Today: the pill starts, a second log restarts it, and the pill opens the timer sheet. With Auto-rest off: no pill.
  5. Legacy URLs `/routines /lifts /calendar /history /weight /photos /timer` redirect. Reloading on `/body/photos` works. `/nope` shows "Page not found".
  6. Offline pill, error pill (dismiss + auto-hide), and undo toast all animate.
  7. Tab away and back: no skeleton on the return visit.
  8. With the timer running on Lifts, the Network tab shows no repeated requests (Task 1 regression check).

- [ ] **Step 3: Reduced motion.** In DevTools → Rendering → "Emulate CSS prefers-reduced-motion: reduce", repeat items 1 and 3:
  - Sheets and tabs appear without sliding or scaling.
  - The background doesn't scale.
  - Skeletons don't shimmer.

- [ ] **Step 4: Screenshot proof.** Take screenshots of Today (dark), Train with a sheet open (dark), and Progress (light) for the user.

---

## Self-Review Notes

- **Spec coverage:**
  - §1 → Tasks 2, 3
  - §2 → Tasks 3, 4, 6, 7, 8. Hero count-up moves with `AnimatedNumber` to Today (Deviation #1). Page first-mount stagger is covered by the tab crossfade; a per-section stagger is deferred to the page redesigns, where sections get rebuilt.
  - §3 → Tasks 3, 4, 5, 8, 9, with deferrals listed.
  - §4 → Tasks 6, 7, 8.
  - §5 → Tasks 1, 9, 10.
  - §6 → no behavior change; sheets keep each modal's existing close handling.
  - §7 → Task 11 plus the checks.
- **Names used across tasks:**
  - `Sheet({open,onClose,title,size})`, `Button({variant,size,loading})`, `Card({onPress,chevron})`
  - `SegmentedControl({segments,value,onChange,layoutId})`, `TabSection({segments,layoutId})`
  - `TimerSheet({open,onClose,timer})`, `TimerPill({timer,onOpen})`, `restart()`
  - `useCachedState(key, initial)`, `clearPageCache()`
  - `onSetLogged`, `autoRest` / `onAutoRestChange`, `theme` / `onThemeChange`
