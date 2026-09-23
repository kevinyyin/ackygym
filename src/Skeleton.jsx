// First-load placeholder only — shaped like the content it stands in for so
// nothing shifts when data lands. Never shown on refetch (see pageCache).
// `tone` must contrast with what it sits on: surface-2 inside a Card or
// Sheet (both bg-surface), surface on the bare page.
const TONES = { surface: 'bg-surface', 'surface-2': 'bg-surface-2' }

function Skeleton({ tone = 'surface', className = '' }) {
  return <div aria-hidden="true" className={`skeleton rounded-card ${TONES[tone]} ${className}`} />
}

export default Skeleton
