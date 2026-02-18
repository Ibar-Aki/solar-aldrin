import { lazy, Suspense } from 'react'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import './index.css'

const HomePage = lazy(() => import('@/pages/HomePage').then((m) => ({ default: m.HomePage })))
const KYSessionPage = lazy(() => import('@/pages/KYSessionPage').then((m) => ({ default: m.KYSessionPage })))
const CompletionPage = lazy(() => import('@/pages/CompletionPage').then((m) => ({ default: m.CompletionPage })))
const HistoryPage = lazy(() => import('@/pages/HistoryPage').then((m) => ({ default: m.HistoryPage })))
const HistoryDetailPage = lazy(() => import('@/pages/HistoryDetailPage').then((m) => ({ default: m.HistoryDetailPage })))
const PDFDebugPage = import.meta.env.DEV
  ? lazy(() => import('@/pages/debug/PDFDebugPage').then((m) => ({ default: m.PDFDebugPage })))
  : null

function App() {
  return (
    <BrowserRouter>
      <Suspense
        fallback={
          <div className="min-h-screen bg-gray-50 p-4 flex items-center justify-center text-gray-500">
            読み込み中...
          </div>
        }
      >
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/session" element={<KYSessionPage />} />
          <Route path="/complete" element={<CompletionPage />} />
          <Route path="/history" element={<HistoryPage />} />
          <Route path="/history/:id" element={<HistoryDetailPage />} />
          {/* Debug Route for Visual Regression Testing (development only) */}
          {PDFDebugPage && <Route path="/debug/pdf" element={<PDFDebugPage />} />}
        </Routes>
      </Suspense>
    </BrowserRouter>
  )
}

export default App
