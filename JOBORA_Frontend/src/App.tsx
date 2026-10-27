import { useEffect, useState, type ReactNode } from "react"
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom"
import { AppLayout } from "./components/layout"
import CVPage from "./modules/cv/CVPage"
import InterviewPage from "./modules/interview/InterviewPage"
import JobMatcherPage from "./modules/job-matcher/JobMatcherPage"
import LetterPage from "./modules/letter/LetterPage"
import MatchingPage from "./modules/matching/MatchingPage"
import PortfolioPage from "./modules/portfolio/PortfolioPage"
import PortfolioPreviewPage from "./modules/portfolio/PortfolioPreviewPage"
import PublicPortfolioPage from "./modules/portfolio/PublicPortfolioPage"
import TrainingPage from "./modules/training/TrainingPage"
import { AuthPage } from "./pages/Auth"
import Dashboard from "./pages/Dashboard"
import SettingsPage from "./pages/SettingsPage"
import { authService, readSession } from "./services/api"

function ProtectedRoute({ children }: { children: ReactNode }) {
  return authService.hasSession() ? children : <Navigate to="/" replace />
}

export default function App() {
  const [, refresh] = useState(readSession())
  useEffect(() => {
    void authService.restoreSession().then(() => refresh(readSession()))
  }, [])
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={authService.hasSession() ? <Navigate to="/app" replace /> : <AuthPage />} />
        <Route path="/p/:slug" element={<PublicPortfolioPage />} />
        <Route path="/portfolio/preview" element={<ProtectedRoute><PortfolioPreviewPage /></ProtectedRoute>} />
        <Route path="/app" element={<ProtectedRoute><AppLayout /></ProtectedRoute>}>
          <Route index element={<Dashboard />} />
          <Route path="cv" element={<CVPage />} />
          <Route path="entretien" element={<InterviewPage />} />
          <Route path="matching" element={<MatchingPage />} />
          <Route path="job-matcher" element={<JobMatcherPage />} />
          <Route path="lettre" element={<LetterPage />} />
          <Route path="formations" element={<TrainingPage />} />
          <Route path="portfolio" element={<PortfolioPage />} />
          <Route path="parametres" element={<SettingsPage />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
