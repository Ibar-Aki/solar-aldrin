import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { HomePage } from '@/pages/HomePage'
import { KYSessionPage } from '@/pages/KYSessionPage'
import { CompletionPage } from '@/pages/CompletionPage'
import { PDFDebugPage } from '@/pages/debug/PDFDebugPage'
import './index.css'

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/session" element={<KYSessionPage />} />
        <Route path="/complete" element={<CompletionPage />} />
        {/* Debug Route for Visual Regression Testing */}
        <Route path="/debug/pdf" element={<PDFDebugPage />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App
