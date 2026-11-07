// iOS doesn't shrink a fixed layout for the on-screen keyboard: it pans the
// visual viewport instead, dragging #app-shell (tab bar included) and any open
// Sheet up with it and leaving taps misaligned until the keyboard closes.
// Mirroring the visual viewport into --vv-top/--vv-height lets the shell and
// sheets sit exactly in the visible area. index.css hides the tab bar while
// html[data-keyboard-open] is set, as native apps do.
export function trackVisualViewport() {
  const vv = window.visualViewport
  if (!vv) return
  const root = document.documentElement
  let keyboardOpen = false

  function update() {
    // A pinch-zoom also shrinks the visual viewport; following it would shrink
    // the app to the zoomed area, so only track at normal scale.
    if (vv.scale > 1.01) {
      root.style.removeProperty('--vv-top')
      root.style.removeProperty('--vv-height')
      return
    }
    root.style.setProperty('--vv-top', `${vv.offsetTop}px`)
    root.style.setProperty('--vv-height', `${vv.height}px`)

    // shortcut: "much shorter than the layout viewport" stands in for "keyboard
    // up" — no API exposes it on iOS; revisit if a browser bar ever trips it.
    const nowOpen = window.innerHeight - vv.height > 120
    if (nowOpen !== keyboardOpen) {
      keyboardOpen = nowOpen
      root.toggleAttribute('data-keyboard-open', nowOpen)
      // The shell just shrank to end at the keyboard; bring the field being typed in back into view.
      if (nowOpen) requestAnimationFrame(() => document.activeElement?.scrollIntoView?.({ block: 'center' }))
    }
  }

  update()
  vv.addEventListener('resize', update)
  vv.addEventListener('scroll', update)
}
