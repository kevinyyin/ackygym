function Card({ className = '', children, ...rest }) {
  return (
    <div className={`rounded-3xl bg-neutral-900 ${className}`} {...rest}>
      {children}
    </div>
  )
}

export default Card
