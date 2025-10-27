import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { socketService } from '../services/socketService';
import { storageService } from '../services/storageService';
import { ParticipantList } from './ParticipantList';

/**
 * SessionPage Component
 *
 * Main session interface for Planning Poker.
 * Handles:
 * - Joining existing sessions
 * - Displaying participants
 * - Real-time updates via WebSocket
 */

interface Participant {
  participantId: string;
  name: string;
  emoji: string;
  isModerator: boolean;
  isConnected: boolean;
  hasVoted: boolean;
}

interface SessionData {
  sessionId: string;
  storyDescription: string;
  votingState: 'voting' | 'revealed';
  participantCount: number;
}

interface ToastMessage {
  id: string;
  message: string;
  type: 'success' | 'error' | 'info';
}

export function SessionPage() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const navigate = useNavigate();

  const [isJoined, setIsJoined] = useState(false);
  const [isJoining, setIsJoining] = useState(false);
  const [name, setName] = useState('');
  const [currentParticipant, setCurrentParticipant] = useState<Participant | null>(null);
  const [session, setSession] = useState<SessionData | null>(null);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  // Generate or retrieve browser fingerprint
  const getBrowserFingerprint = (): string => {
    let fingerprint = storageService.getBrowserFingerprint();
    if (!fingerprint) {
      fingerprint = `fp_${Date.now()}_${Math.random().toString(36).substring(7)}`;
      storageService.saveBrowserFingerprint(fingerprint);
    }
    return fingerprint;
  };

  const showToast = (message: string, type: ToastMessage['type'] = 'info') => {
    const id = `toast_${Date.now()}`;
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 5000);
  };

  const handleJoinSession = async () => {
    if (!name.trim()) {
      setError('Please enter your name');
      return;
    }

    if (!sessionId) {
      setError('Invalid session ID');
      return;
    }

    setIsJoining(true);
    setError(null);

    try {
      const socket = socketService.connect();
      const fingerprint = getBrowserFingerprint();

      // Set up listeners before emitting
      socket.once('join-accepted', (data: any) => {
        console.log('[SessionPage] Join accepted:', data);
        setCurrentParticipant(data.participant);
        setSession(data.session);
        setIsJoined(true);
        setIsJoining(false);

        // Save to storage for reconnection
        storageService.saveParticipantForSession(sessionId, data.participant.participantId);
        storageService.saveSessionId(sessionId);
        storageService.saveRecentSession(sessionId);

        showToast(`Welcome, ${data.participant.name} ${data.participant.emoji}!`, 'success');

        // Fetch participants
        fetchParticipants();
      });

      socket.once('error', (errorData: any) => {
        console.error('[SessionPage] Join error:', errorData);
        setError(errorData.message || 'Failed to join session');
        setIsJoining(false);
      });

      // Emit join-session event
      socket.emit('join-session', {
        sessionId,
        name: name.trim(),
        browserFingerprint: fingerprint,
      });
    } catch (err) {
      console.error('[SessionPage] Join failed:', err);
      setError('Failed to connect to session');
      setIsJoining(false);
    }
  };

  const fetchParticipants = async () => {
    if (!sessionId) return;

    try {
      const response = await fetch(`http://localhost:3000/api/sessions/${sessionId}/participants`);
      if (response.ok) {
        const data = await response.json();
        setParticipants(data.participants || []);
      }
    } catch (err) {
      console.error('[SessionPage] Failed to fetch participants:', err);
    }
  };

  // Set up real-time event listeners
  useEffect(() => {
    if (!isJoined) return;

    const socket = socketService.getSocket();
    if (!socket) return;

    // Handle participant joined
    const handleParticipantJoined = (data: any) => {
      console.log('[SessionPage] Participant joined:', data);
      showToast(`${data.participant.name} ${data.participant.emoji} joined the session`, 'info');
      fetchParticipants();
    };

    // Handle participant left
    const handleParticipantLeft = (data: any) => {
      console.log('[SessionPage] Participant left:', data);
      showToast(`${data.participant.name} ${data.participant.emoji} left the session`, 'info');
      fetchParticipants();
    };

    // Handle session expired
    const handleSessionExpired = () => {
      showToast('Session has expired', 'error');
      setTimeout(() => navigate('/'), 3000);
    };

    socket.on('participant-joined', handleParticipantJoined);
    socket.on('participant-left', handleParticipantLeft);
    socket.on('session-expired', handleSessionExpired);

    return () => {
      socket.off('participant-joined', handleParticipantJoined);
      socket.off('participant-left', handleParticipantLeft);
      socket.off('session-expired', handleSessionExpired);
    };
  }, [isJoined, navigate]);

  // Check if already joined on mount
  useEffect(() => {
    if (!sessionId) {
      navigate('/');
      return;
    }

    const savedParticipantId = storageService.getParticipantForSession(sessionId);
    if (savedParticipantId) {
      // Try to reconnect
      setIsJoining(true);
      const socket = socketService.connect();
      const fingerprint = getBrowserFingerprint();

      socket.once('join-accepted', (data: any) => {
        setCurrentParticipant(data.participant);
        setSession(data.session);
        setIsJoined(true);
        setIsJoining(false);
        fetchParticipants();
        showToast('Reconnected successfully!', 'success');
      });

      socket.once('error', () => {
        setIsJoining(false);
        storageService.removeParticipantForSession(sessionId);
      });

      socket.emit('join-session', {
        sessionId,
        name: 'Reconnecting...',
        browserFingerprint: fingerprint,
      });
    }
  }, [sessionId, navigate]);

  if (!sessionId) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
      <div className="max-w-6xl mx-auto">
        {/* Toast Notifications */}
        <div className="fixed top-4 right-4 z-50 space-y-2">
          {toasts.map((toast) => (
            <div
              key={toast.id}
              className={`px-4 py-3 rounded-lg shadow-lg text-white transition-all transform ${
                toast.type === 'success'
                  ? 'bg-green-500'
                  : toast.type === 'error'
                  ? 'bg-red-500'
                  : 'bg-blue-500'
              } animate-slide-in`}
            >
              {toast.message}
            </div>
          ))}
        </div>

        {/* Header */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-800">Planning Poker</h1>
              <p className="text-gray-600 mt-1">Session: {sessionId}</p>
            </div>
            {isJoined && currentParticipant && (
              <div className="text-right">
                <p className="text-sm text-gray-600">You are:</p>
                <p className="text-xl font-semibold text-gray-800">
                  {currentParticipant.name} {currentParticipant.emoji}
                  {currentParticipant.isModerator && (
                    <span className="ml-2 text-xs bg-yellow-400 text-yellow-900 px-2 py-1 rounded-full">
                      Moderator
                    </span>
                  )}
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Join Form or Session Content */}
        {!isJoined ? (
          <div className="bg-white rounded-lg shadow-md p-8">
            <h2 className="text-2xl font-bold text-gray-800 mb-6">Join Session</h2>

            {error && (
              <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
                {error}
              </div>
            )}

            <div className="space-y-4">
              <div>
                <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-2">
                  Your Name
                </label>
                <input
                  id="name"
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handleJoinSession()}
                  placeholder="Enter your name"
                  maxLength={50}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  disabled={isJoining}
                  data-testid="name-input"
                />
                <p className="mt-1 text-sm text-gray-500">1-50 characters</p>
              </div>

              <button
                onClick={handleJoinSession}
                disabled={isJoining || !name.trim()}
                className="w-full py-3 px-6 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white font-semibold rounded-lg transition-colors duration-200"
                data-testid="join-session-btn"
              >
                {isJoining ? 'Joining...' : 'Join Session'}
              </button>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Participants Section */}
            <div className="lg:col-span-1">
              <div className="bg-white rounded-lg shadow-md p-6">
                <h3 className="text-xl font-bold text-gray-800 mb-4">
                  Participants ({participants.length})
                </h3>
                <ParticipantList
                  participants={participants}
                  currentParticipantId={currentParticipant?.participantId || ''}
                />
              </div>
            </div>

            {/* Voting Area */}
            <div className="lg:col-span-2">
              <div className="bg-white rounded-lg shadow-md p-8">
                <h3 className="text-xl font-bold text-gray-800 mb-4">
                  {session?.storyDescription || 'Story to estimate'}
                </h3>
                <div className="text-center py-12 text-gray-500">
                  <p className="text-lg">Voting interface coming in Phase 5 (User Story 3)</p>
                  <p className="mt-2">
                    You've successfully joined the session!
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
