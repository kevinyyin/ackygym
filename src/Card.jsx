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

export default Card
