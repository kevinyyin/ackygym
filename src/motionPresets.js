// The app's only two springs — every animation picks one of these so
// motion feels like one system. Both are critically damped (no overshoot),
// matching iOS's default UI springs.
export const snappy = { type: 'spring', stiffness: 520, damping: 42, mass: 0.8 }
export const smooth = { type: 'spring', stiffness: 300, damping: 34, mass: 1 }
