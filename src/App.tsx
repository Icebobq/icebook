import { BrowserRouter, Route, Routes } from 'react-router-dom'
import { AppShell } from './components/AppShell'
import { BookDetailPage } from './pages/BookDetailPage'
import { NotesPage } from './pages/NotesPage'
import { ShelfPage } from './pages/ShelfPage'
import { StatsPage } from './pages/StatsPage'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<AppShell />}>
          <Route index element={<ShelfPage />} />
          <Route path="books/:id" element={<BookDetailPage />} />
          <Route path="notes" element={<NotesPage />} />
          <Route path="stats" element={<StatsPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}
