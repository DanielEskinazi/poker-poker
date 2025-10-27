import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';

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
      <div className="min-h-screen bg-gray-50">
        <Routes>
          <Route path="/" element={<div>Home Page - TODO</div>} />
          <Route path="/session/:sessionId" element={<div>Session Page - TODO</div>} />
        </Routes>
      </div>
    </Router>
  );
}

export default App;
