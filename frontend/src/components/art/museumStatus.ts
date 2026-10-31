import { MuseumStatus } from '../../api/art'

export const MUSEUM_STATUS_ORDER: MuseumStatus[] = ['visited', 'wishlist', 'artworks']

export const MUSEUM_STATUS_LABELS: Record<MuseumStatus, string> = {
  visited: 'Visité',
  wishlist: 'À visiter',
  artworks: 'Mes œuvres',
}

export const MUSEUM_FILTER_LABELS: Record<MuseumStatus, string> = {
  visited: 'Visités',
  wishlist: 'À visiter',
  artworks: 'Mes œuvres',
}

/** Today as YYYY-MM-DD in the viewer's own timezone, for date inputs. */
export function todayIso(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
