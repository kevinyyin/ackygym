function Card({ className = '', children, ...rest }) {
  return (
    <div
      className={`rounded-lg border border-line bg-surface shadow-[inset_0_1px_0_var(--card-highlight),0_10px_28px_-16px_var(--shadow-tint)] ${className}`}
      {...rest}
    >
      {children}
    </div>
  )
}

export function SectionLabel({ children }) {
  return (
    <h2 className="flex items-center gap-2 px-1 text-[11px] font-semibold tracking-[0.2em] text-chalk-dim uppercase">
      <span className="h-2.5 w-0.5 bg-blue-500" />
      {children}
    </h2>
  )
}

export default Card
