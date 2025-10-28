import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { socketService } from '../services/socketService';
import { storageService } from '../services/storageService';
import { ParticipantList } from './ParticipantList';
import { CardDeck } from './CardDeck';
import { VoteCounter } from './VoteCounter';
import { useVoting } from '../hooks/useVoting';

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

  // Initialize voting hook
  const voting = useVoting({
    socket: socketService.getSocket(),
    sessionId: sessionId || null,
    participantId: currentParticipant?.participantId || null,
  });

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
        storageService.saveParticipantDataForSession(sessionId, data.participant.participantId, data.participant.name);
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

  // Merge voting status with participants
  const participantsWithVotingStatus = participants.map((participant) => ({
    ...participant,
    hasVoted: voting.hasVoted[participant.participantId] || false,
  }));

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

    const savedParticipantData = storageService.getParticipantDataForSession(sessionId);
    if (savedParticipantData && savedParticipantData.name) {
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
        name: savedParticipantData.name,
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
                  participants={participantsWithVotingStatus}
                  currentParticipantId={currentParticipant?.participantId || ''}
                />
              </div>
            </div>

            {/* Voting Area */}
            <div className="lg:col-span-2 space-y-6">
              {/* Story Description */}
              <div className="bg-white rounded-lg shadow-md p-6">
                <h3 className="text-xl font-bold text-gray-800 mb-2">
                  Story to Estimate
                </h3>
                <p className="text-gray-600">
                  {session?.storyDescription || 'No story description provided'}
                </p>
              </div>

              {/* Vote Counter */}
              <VoteCounter
                votedCount={voting.votedCount}
                totalParticipants={voting.totalParticipants}
                votingState={voting.votingPhase}
              />

              {/* Card Deck */}
              <div className="bg-white rounded-lg shadow-md p-6">
                <CardDeck
                  onCardSelect={voting.castVote}
                  selectedCard={voting.selectedCard}
                  disabled={voting.isVoting}
                  votingState={voting.votingPhase}
                />
              </div>

              {/* Moderator Controls */}
              {currentParticipant?.isModerator && (
                <div className="bg-white rounded-lg shadow-md p-6">
                  <h3 className="text-lg font-semibold text-gray-700 mb-4">
                    Moderator Controls
                  </h3>
                  <div className="flex gap-3">
                    <button
                      onClick={voting.revealVotes}
                      disabled={voting.votingPhase === 'revealed' || voting.votedCount === 0}
                      className="flex-1 py-3 px-6 bg-green-600 hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-white font-semibold rounded-lg transition-colors duration-200"
                    >
                      Reveal Votes
                    </button>
                    <button
                      onClick={voting.resetVotes}
                      disabled={voting.votingPhase === 'voting'}
                      className="flex-1 py-3 px-6 bg-orange-600 hover:bg-orange-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-white font-semibold rounded-lg transition-colors duration-200"
                    >
                      Reset Votes
                    </button>
                  </div>
                </div>
              )}

              {/* Revealed Votes */}
              {voting.votingPhase === 'revealed' && voting.revealedVotes.length > 0 && (
                <div className="bg-white rounded-lg shadow-md p-6">
                  <h3 className="text-lg font-semibold text-gray-700 mb-4">
                    Revealed Votes
                  </h3>

                  {/* Statistics */}
                  {voting.statistics && (
                    <div className="mb-6 p-4 bg-blue-50 rounded-lg">
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <p className="text-sm text-gray-600">Average</p>
                          <p className="text-2xl font-bold text-gray-800">
                            {voting.statistics.averageNumeric?.toFixed(1) || 'N/A'}
                          </p>
                        </div>
                        <div>
                          <p className="text-sm text-gray-600">Consensus</p>
                          <p className="text-2xl font-bold text-gray-800">
                            {voting.statistics.consensus ? (
                              <span className="text-green-600">✓ Yes</span>
                            ) : (
                              <span className="text-orange-600">✗ No</span>
                            )}
                          </p>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Individual Votes */}
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                    {voting.revealedVotes.map((vote) => (
                      <div
                        key={vote.participantId}
                        className="p-4 border-2 border-gray-200 rounded-lg text-center"
                      >
                        <div className="text-3xl mb-2">{vote.participantEmoji}</div>
                        <div className="text-sm text-gray-600 mb-1">{vote.participantName}</div>
                        <div className="text-2xl font-bold text-blue-600">{vote.cardValue}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
