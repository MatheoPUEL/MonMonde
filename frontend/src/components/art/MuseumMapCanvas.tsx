import { useEffect, useRef } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { Museum } from '../../api/art'
import { useTheme } from '../../context/ThemeContext'

interface Props {
  museums: Museum[]
  selectedId: string | null
  onSelect: (id: string) => void
}

// Esri's muted canvas basemaps: keyless, and quiet enough for the markers to carry the color
const TILES = {
  light: 'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Base/MapServer/tile/{z}/{y}/{x}',
  dark: 'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}',
}
const ATTRIBUTION = 'Tiles &copy; Esri &mdash; Esri, HERE, Garmin, &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'

// Grows with the number of artworks held there, but stays a dot rather than a bubble chart
function radius(museum: Museum): number {
  return Math.min(6 + Math.sqrt(museum.artworkCount) * 3, 16)
}

function markerIcon(museum: Museum, selected: boolean): L.DivIcon {
  const size = Math.round((radius(museum) + (selected ? 2 : 0)) * 2)
  return L.divIcon({
    className: `museum-marker museum-marker--${museum.status}${selected ? ' museum-marker--selected' : ''}`,
    iconSize: [size, size],
    html: '',
  })
}

export function MuseumMapCanvas({ museums, selectedId, onSelect }: Props) {
  const { theme } = useTheme()
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<L.Map | null>(null)
  const tilesRef = useRef<L.TileLayer | null>(null)
  const markersRef = useRef<L.LayerGroup | null>(null)
  const markerByIdRef = useRef(new Map<string, L.Marker>())
  const fittedRef = useRef(false)
  const onSelectRef = useRef(onSelect)
  onSelectRef.current = onSelect

  useEffect(() => {
    if (!containerRef.current) return
    const map = L.map(containerRef.current, {
      center: [30, 10],
      zoom: 2,
      minZoom: 2,
      maxZoom: 16,
      worldCopyJump: true,
      zoomControl: false,
    })
    L.control.zoom({ position: 'topright' }).addTo(map)
    markersRef.current = L.layerGroup().addTo(map)
    mapRef.current = map

    // The map sits in a flex layout that settles after mount and on window resizes
    const observer = new ResizeObserver(() => map.invalidateSize())
    observer.observe(containerRef.current)

    return () => {
      observer.disconnect()
      map.remove()
      mapRef.current = null
      markerByIdRef.current.clear()
    }
  }, [])

  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    tilesRef.current?.remove()
    tilesRef.current = L.tileLayer(TILES[theme], {
      attribution: ATTRIBUTION,
      maxZoom: 16,
    }).addTo(map)
  }, [theme])

  // HTML markers rather than SVG circles: Leaflet scales the SVG layer during zoom animations,
  // so on a flyTo across many zoom levels a circle marker briefly covered the whole map.
  useEffect(() => {
    const map = mapRef.current
    const layer = markersRef.current
    if (!map || !layer) return
    const markers = markerByIdRef.current

    const placed = museums.filter(m => m.latitude != null && m.longitude != null)
    const placedIds = new Set(placed.map(m => m.id))
    for (const [id, marker] of markers) {
      if (!placedIds.has(id)) { marker.remove(); markers.delete(id) }
    }

    for (const museum of placed) {
      const isSelected = museum.id === selectedId
      const latLng: L.LatLngExpression = [museum.latitude!, museum.longitude!]
      const icon = markerIcon(museum, isSelected)
      let marker = markers.get(museum.id)
      if (!marker) {
        marker = L.marker(latLng, { icon, keyboard: false })
          .bindTooltip(museum.name, { direction: 'top', offset: [0, -radius(museum)], className: 'museum-tooltip' })
          .on('click', () => onSelectRef.current(museum.id))
          .addTo(layer)
        markers.set(museum.id, marker)
      } else {
        marker.setLatLng(latLng).setIcon(icon).setTooltipContent(museum.name)
      }
      // Selected marker on top of its neighbours
      marker.setZIndexOffset(isSelected ? 1000 : 0)
    }

    if (!fittedRef.current && placed.length) {
      fittedRef.current = true
      map.fitBounds(L.latLngBounds(placed.map(m => [m.latitude!, m.longitude!])), {
        padding: [48, 48],
        maxZoom: 6,
      })
    }
  }, [museums, selectedId])

  // Fly on a new selection or a corrected position — not on every list refresh
  const selected = museums.find(m => m.id === selectedId)
  const lat = selected?.latitude
  const lng = selected?.longitude
  useEffect(() => {
    const map = mapRef.current
    if (!map || lat == null || lng == null) return
    map.flyTo([lat, lng], Math.max(map.getZoom(), 11), { duration: 0.8 })
  }, [selectedId, lat, lng])

  return <div ref={containerRef} className="museum-map-canvas" />
}
