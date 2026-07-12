import { Routes, Route } from 'react-router-dom'
import { BookLibrary } from './BookLibrary'
import { BookDetail } from './BookDetail'
import { AuthorsPage } from './AuthorsPage'
import { AuthorDetail } from './AuthorDetail'

export function ReadingPage() {
  return (
    <Routes>
      <Route index element={<BookLibrary />} />
      <Route path="authors" element={<AuthorsPage />} />
      <Route path="authors/:authorId" element={<AuthorDetail />} />
      <Route path=":id" element={<BookDetail />} />
    </Routes>
  )
}
