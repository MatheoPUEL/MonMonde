interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string
  error?: string
}

export function Input({ label, error, id, ...props }: InputProps) {
  return (
    <div className="input-group">
      {label && <label htmlFor={id} className="input-label">{label}</label>}
      <input
        id={id}
        className={`input-field ${error ? 'input-error-field' : ''}`}
        {...props}
      />
      {error && <span className="input-error-msg">{error}</span>}
    </div>
  )
}
