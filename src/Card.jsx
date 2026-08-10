function Card({ className = '', children, ...rest }) {
  return (
    <div className={`rounded-lg border border-line bg-surface ${className}`} {...rest}>
      {children}
    </div>
  )
}

export default Card
