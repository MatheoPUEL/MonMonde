import { Routes, Route, Navigate } from 'react-router-dom'
import { JournalList } from './JournalList'
import { EntryDetail } from './EntryDetail'

export function JournalPage() {
  return (
    <Routes>
      <Route index element={<JournalList />} />
      <Route path=":id" element={<EntryDetail />} />
      <Route path="*" element={<Navigate to="" replace />} />
    </Routes>
  )
}
