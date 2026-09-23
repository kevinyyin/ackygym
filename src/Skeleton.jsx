// First-load placeholder only — shaped like the content it stands in for so
// nothing shifts when data lands. Never shown on refetch (see pageCache).
function Skeleton({ className = '' }) {
  return <div aria-hidden="true" className={`skeleton rounded-card ${className}`} />
}

export default Skeleton
