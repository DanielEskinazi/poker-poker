import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { HomePage } from './components/HomePage';

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
    <Router>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/session/:sessionId" element={<div className="p-8">Session Page - Coming in Phase 4</div>} />
      </Routes>
    </Router>
  );
}

export default App;
