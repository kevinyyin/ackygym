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
