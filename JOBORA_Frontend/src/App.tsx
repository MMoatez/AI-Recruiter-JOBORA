import type { ReactNode } from "react"
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom"
import { AppLayout } from "./components/layout"
import CVPage from "./modules/cv/CVPage"
import InterviewPage from "./modules/interview/InterviewPage"
import LetterPage from "./modules/letter/LetterPage"
import MatchingPage from "./modules/matching/MatchingPage"
import PortfolioPage from "./modules/portfolio/PortfolioPage"
import TrainingPage from "./modules/training/TrainingPage"
import { AuthPage } from "./pages/Auth"
import Dashboard from "./pages/Dashboard"
import SettingsPage from "./pages/SettingsPage"
import { authService } from "./services/api"

function ProtectedRoute({ children }: { children: ReactNode }) {
  return authService.hasSession() ? children : <Navigate to="/" replace />
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={authService.hasSession() ? <Navigate to="/app/cv" replace /> : <AuthPage />} />
        <Route path="/app" element={<ProtectedRoute><AppLayout /></ProtectedRoute>}>
          <Route index element={<Dashboard />} />
          <Route path="cv" element={<CVPage />} />
          <Route path="entretien" element={<InterviewPage />} />
          <Route path="matching" element={<MatchingPage />} />
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
