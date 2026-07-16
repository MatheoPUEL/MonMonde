import { useEffect } from 'react'
import { IconClose } from './icons'

interface Props {
  src: string
  alt: string
  onClose: () => void
}

export function Lightbox({ src, alt, onClose }: Props) {
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [onClose])

  return (
    <div className="lightbox-overlay" onClick={onClose}>
      <button className="lightbox-close" onClick={onClose} aria-label="Fermer">
        <IconClose size={18} />
      </button>
      <img src={src} alt={alt} className="lightbox-image" onClick={e => e.stopPropagation()} />
    </div>
  )
}
