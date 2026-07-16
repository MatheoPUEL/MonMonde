import { Routes, Route } from 'react-router-dom'
import { ArtGallery } from './ArtGallery'
import { ArtworkDetail } from './ArtworkDetail'
import { ArtistsPage } from './ArtistsPage'
import { ArtistDetail } from './ArtistDetail'

export function ArtPage() {
  return (
    <Routes>
      <Route index element={<ArtGallery />} />
      <Route path="artists" element={<ArtistsPage />} />
      <Route path="artists/:artistId" element={<ArtistDetail />} />
      <Route path=":id" element={<ArtworkDetail />} />
    </Routes>
  )
}
