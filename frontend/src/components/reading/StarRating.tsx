interface StarRatingProps {
  value?: number
  onChange?: (v: number) => void
  readonly?: boolean
  size?: 'sm' | 'md'
}

export function StarRating({ value = 0, onChange, readonly = false, size = 'md' }: StarRatingProps) {
  return (
    <div className="star-rating" style={{ fontSize: size === 'sm' ? '0.85rem' : '1rem' }}>
      {[1, 2, 3, 4, 5].map(n => (
        <span
          key={n}
          className={`star ${n <= value ? 'star--filled' : ''} ${readonly ? 'star--readonly' : ''}`}
          onClick={() => !readonly && onChange?.(n)}
        >
          ★
        </span>
      ))}
    </div>
  )
}
