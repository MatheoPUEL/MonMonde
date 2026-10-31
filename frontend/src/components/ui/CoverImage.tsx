import { useEffect, useState, ReactNode, CSSProperties } from 'react'
import { recoverCover, CoverKind } from '../../api/covers'

interface Props {
  kind: CoverKind
  id: string
  src?: string | null
  alt: string
  /** Shown when there is no cover, or it is broken and couldn't be recovered */
  fallback: ReactNode
  className?: string
  style?: CSSProperties
  loading?: 'lazy' | 'eager'
  onRecovered?: (coverUrl: string) => void
}

/** A book or artwork cover that heals itself: if the image fails to load, the server is asked
 *  to download it again (from its source, or the book/museum API) and the new copy is shown. */
export function CoverImage({ kind, id, src, alt, fallback, className, style, loading, onRecovered }: Props) {
  const [current, setCurrent] = useState(src)
  const [broken, setBroken] = useState(false)
  const [retried, setRetried] = useState(false)

  useEffect(() => {
    setCurrent(src)
    setBroken(false)
    setRetried(false)
  }, [src])

  async function handleError() {
    if (retried) { setBroken(true); return }
    setRetried(true)
    const recovered = await recoverCover(kind, id)
    if (!recovered) { setBroken(true); return }
    // Same path as before when the server already had a good copy: bust the browser's cache
    setCurrent(recovered === current ? `${recovered}?r=${Date.now()}` : recovered)
    onRecovered?.(recovered)
  }

  if (!current || broken) return <>{fallback}</>
  return <img src={current} alt={alt} className={className} style={style} loading={loading} onError={handleError} />
}
