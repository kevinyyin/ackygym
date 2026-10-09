function Card({ className = '', children, ...rest }) {
  return (
    <div className={`rounded-card bg-surface ${className}`} {...rest}>
      {children}
    </div>
  )
}

export default Card
