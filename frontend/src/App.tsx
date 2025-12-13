import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { HomePage } from './components/HomePage';
import { SessionPage } from './components/SessionPage';

/**
 * Main App Component
 *
 * Sets up routing for the Planning Poker application.
 * Routes:
 * - / : HomePage (create new session)
 * - /session/:sessionId : SessionPage (join/participate in session)
 */
function App() {
  return (
    <Router
      future={{
        v7_startTransition: true,
        v7_relativeSplatPath: true,
      }}
    >
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/session/:sessionId" element={<SessionPage />} />
      </Routes>
    </Router>
  );
}

export default App;
