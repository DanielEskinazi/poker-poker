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
 * Slate & Stone theme - Corporate Minimalism.
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
    }, 4000);
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

        showToast(`Welcome, ${data.participant.name}!`, 'success');

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

  // Handle promote moderator action
  const handlePromoteModerator = (targetParticipantId: string) => {
    if (!sessionId || !currentParticipant) return;

    const socket = socketService.getSocket();
    if (!socket) return;

    socket.emit('promote-moderator', {
      sessionId,
      promoterId: currentParticipant.participantId,
      targetParticipantId
    });
  };

  // Set up real-time event listeners
  useEffect(() => {
    if (!isJoined) return;

    const socket = socketService.getSocket();
    if (!socket) return;

    // Handle participant joined
    const handleParticipantJoined = (data: any) => {
      console.log('[SessionPage] Participant joined:', data);
      showToast(`${data.participant.name} joined`, 'info');
      fetchParticipants();
    };

    // Handle participant left
    const handleParticipantLeft = (data: any) => {
      console.log('[SessionPage] Participant left:', data);
      showToast(`${data.participant.name} left`, 'info');
      fetchParticipants();
    };

    // Handle session expired
    const handleSessionExpired = () => {
      showToast('Session has expired', 'error');
      setTimeout(() => navigate('/'), 3000);
    };

    // Handle moderator promoted
    const handleModeratorPromoted = (data: any) => {
      console.log('[SessionPage] Moderator promoted:', data);

      const promotionMessage = data.promotionType === 'auto'
        ? `${data.participantName} is now the host`
        : `${data.participantName} was promoted to host`;

      showToast(promotionMessage, 'success');

      // Update current participant if they were promoted
      if (currentParticipant && data.participantId === currentParticipant.participantId) {
        setCurrentParticipant({ ...currentParticipant, isModerator: true });
      }

      // Refresh participants list
      fetchParticipants();
    };

    socket.on('participant-joined', handleParticipantJoined);
    socket.on('participant-left', handleParticipantLeft);
    socket.on('session-expired', handleSessionExpired);
    socket.on('moderator-promoted', handleModeratorPromoted);

    return () => {
      socket.off('participant-joined', handleParticipantJoined);
      socket.off('participant-left', handleParticipantLeft);
      socket.off('session-expired', handleSessionExpired);
      socket.off('moderator-promoted', handleModeratorPromoted);
    };
  }, [isJoined, navigate, currentParticipant]);

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
        showToast('Reconnected successfully', 'success');
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
    <div className="min-h-screen bg-slate-50 p-4">
      <div className="max-w-6xl mx-auto">
        {/* Toast Notifications */}
        <div className="fixed top-4 right-4 z-50 space-y-2">
          {toasts.map((toast) => (
            <div
              key={toast.id}
              className={`
                px-4 py-3 rounded-lg shadow-lg
                flex items-center gap-3 toast-animate
                ${toast.type === 'success'
                  ? 'bg-success-50 text-success-700 border border-success-200'
                  : toast.type === 'error'
                    ? 'bg-error-50 text-error-700 border border-error-200'
                    : 'bg-white text-slate-700 border border-slate-200'
                }
              `}
            >
              {toast.type === 'success' && (
                <svg className="w-5 h-5 text-success-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              )}
              {toast.type === 'error' && (
                <svg className="w-5 h-5 text-error-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
                </svg>
              )}
              {toast.type === 'info' && (
                <svg className="w-5 h-5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z" />
                </svg>
              )}
              <span className="text-sm font-medium">{toast.message}</span>
            </div>
          ))}
        </div>

        {/* Header */}
        <div className="bg-white rounded-xl border border-slate-200 p-4 mb-6 animate-slide-up">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              {/* Logo */}
              <div className="w-10 h-10 rounded-lg bg-primary-500 flex items-center justify-center">
                <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6zM16 13a1 1 0 011-1h2a1 1 0 011 1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-6z" />
                </svg>
              </div>

              <div>
                <h1 className="text-lg font-semibold text-slate-900">
                  Planning Poker
                </h1>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-xs text-slate-500">Session:</span>
                  <code className="text-xs font-mono text-slate-600 bg-slate-100 px-1.5 py-0.5 rounded">
                    {sessionId}
                  </code>
                </div>
              </div>
            </div>

            {isJoined && currentParticipant && (
              <div className="flex items-center gap-3 px-3 py-2 rounded-lg bg-slate-50 border border-slate-200">
                <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center text-base">
                  {currentParticipant.emoji}
                </div>
                <div>
                  <p className="text-xs text-slate-500">Logged in as</p>
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium text-slate-900">
                      {currentParticipant.name}
                    </p>
                    {currentParticipant.isModerator && (
                      <span className="badge badge-warning text-[10px] py-0.5">
                        Host
                      </span>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Join Form or Session Content */}
        {!isJoined ? (
          <div className="max-w-md mx-auto animate-slide-up" style={{ animationDelay: '0.1s' }}>
            <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-soft">
              <div className="text-center mb-6">
                <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-primary-100 flex items-center justify-center">
                  <svg className="w-6 h-6 text-primary-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
                  </svg>
                </div>
                <h2 className="text-lg font-semibold text-slate-900 mb-1">
                  Join Session
                </h2>
                <p className="text-sm text-slate-500">Enter your name to participate</p>
              </div>

              {error && (
                <div className="mb-4 p-3 rounded-lg bg-error-50 border border-error-200 text-error-700 flex items-center gap-2 animate-fade-in">
                  <svg className="w-4 h-4 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                  </svg>
                  <span className="text-sm">{error}</span>
                </div>
              )}

              <div className="space-y-4">
                <div>
                  <label htmlFor="name" className="label">
                    Your name
                  </label>
                  <input
                    id="name"
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && handleJoinSession()}
                    placeholder="Enter your name"
                    maxLength={50}
                    className="input"
                    disabled={isJoining}
                    data-testid="name-input"
                  />
                </div>

                <button
                  onClick={handleJoinSession}
                  disabled={isJoining || !name.trim()}
                  className={`
                    w-full py-2.5 px-4 rounded-lg font-medium
                    transition-all duration-200
                    flex items-center justify-center gap-2
                    ${isJoining || !name.trim()
                      ? 'bg-slate-200 text-slate-400 cursor-not-allowed'
                      : 'bg-primary-500 text-white hover:bg-primary-600 active:scale-[0.98]'
                    }
                    focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2
                  `}
                  data-testid="join-session-btn"
                >
                  {isJoining ? (
                    <>
                      <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                      </svg>
                      Joining...
                    </>
                  ) : (
                    <>
                      Join Session
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
                      </svg>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Participants Section */}
            <div className="lg:col-span-1">
              <div className="bg-white rounded-xl border border-slate-200 p-5 animate-slide-up" style={{ animationDelay: '0.1s' }}>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-base font-semibold text-slate-900">Participants</h3>
                  <span className="badge badge-neutral">
                    {participants.length}
                  </span>
                </div>
                <ParticipantList
                  participants={participantsWithVotingStatus}
                  currentParticipantId={currentParticipant?.participantId || ''}
                  onPromoteModerator={handlePromoteModerator}
                  isCurrentUserModerator={currentParticipant?.isModerator || false}
                />
              </div>
            </div>

            {/* Voting Area */}
            <div className="lg:col-span-2 space-y-6">
              {/* Story Description */}
              <div className="bg-white rounded-xl border border-slate-200 p-5 animate-slide-up" style={{ animationDelay: '0.15s' }}>
                <h3 className="text-base font-semibold text-slate-900 mb-2">Story to Estimate</h3>
                <p className="text-slate-600 text-sm">
                  {session?.storyDescription || 'No description provided — discuss the task with your team'}
                </p>
              </div>

              {/* Vote Counter */}
              <div className="animate-slide-up" style={{ animationDelay: '0.2s' }}>
                <VoteCounter
                  votedCount={voting.votedCount}
                  totalParticipants={voting.totalParticipants}
                  votingState={voting.votingPhase}
                />
              </div>

              {/* Card Deck */}
              <div className="bg-white rounded-xl border border-slate-200 p-5 animate-slide-up" style={{ animationDelay: '0.25s' }}>
                <CardDeck
                  onCardSelect={voting.castVote}
                  selectedCard={voting.selectedCard}
                  disabled={voting.isVoting}
                  votingState={voting.votingPhase}
                />
              </div>

              {/* Moderator Controls */}
              {currentParticipant?.isModerator && (
                <div className="bg-white rounded-xl border border-slate-200 p-5 animate-slide-up" style={{ animationDelay: '0.3s' }}>
                  <h3 className="text-base font-semibold text-slate-900 mb-4">Host Controls</h3>
                  <div className="flex flex-col sm:flex-row gap-3">
                    <button
                      onClick={voting.revealVotes}
                      disabled={voting.votingPhase === 'revealed' || voting.votedCount === 0}
                      className={`
                        flex-1 py-2.5 px-4 rounded-lg font-medium
                        transition-all duration-200
                        flex items-center justify-center gap-2
                        ${voting.votingPhase === 'revealed' || voting.votedCount === 0
                          ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                          : 'bg-primary-500 text-white hover:bg-primary-600'
                        }
                      `}
                      data-testid="reveal-votes-btn"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                      Reveal Votes
                    </button>
                    <button
                      onClick={voting.resetVotes}
                      disabled={voting.votingPhase === 'voting'}
                      className={`
                        flex-1 py-2.5 px-4 rounded-lg font-medium
                        transition-all duration-200
                        flex items-center justify-center gap-2
                        border
                        ${voting.votingPhase === 'voting'
                          ? 'bg-slate-50 border-slate-200 text-slate-400 cursor-not-allowed'
                          : 'bg-white border-slate-300 text-slate-700 hover:bg-slate-50 hover:border-slate-400'
                        }
                      `}
                      data-testid="reset-votes-btn"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" />
                      </svg>
                      New Round
                    </button>
                  </div>
                </div>
              )}

              {/* Revealed Votes */}
              {voting.votingPhase === 'revealed' && voting.revealedVotes.length > 0 && (
                <div className="bg-white rounded-xl border border-slate-200 p-5 animate-slide-up">
                  <h3 className="text-base font-semibold text-slate-900 mb-5">Results</h3>

                  {/* Statistics */}
                  {voting.statistics && (
                    <div className="mb-6 p-4 rounded-lg bg-slate-50 border border-slate-200">
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                        <div className="text-center">
                          <p className="text-xs text-slate-500 uppercase tracking-wide mb-1">Average</p>
                          <p className="text-2xl font-semibold text-primary-600">
                            {voting.statistics.averageNumeric?.toFixed(1) || '—'}
                          </p>
                        </div>
                        <div className="text-center">
                          <p className="text-xs text-slate-500 uppercase tracking-wide mb-1">Median</p>
                          <p className="text-2xl font-semibold text-slate-900">
                            {voting.statistics.medianNumeric || '—'}
                          </p>
                        </div>
                        <div className="text-center">
                          <p className="text-xs text-slate-500 uppercase tracking-wide mb-1">Mode</p>
                          <p className="text-2xl font-semibold text-slate-900">
                            {voting.statistics.mode || '—'}
                          </p>
                        </div>
                        <div className="text-center">
                          <p className="text-xs text-slate-500 uppercase tracking-wide mb-1">Consensus</p>
                          <p className="text-2xl font-semibold">
                            {voting.statistics.consensus ? (
                              <span className="text-success-600">Yes</span>
                            ) : (
                              <span className="text-warning-600">No</span>
                            )}
                          </p>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Individual Votes */}
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                    {voting.revealedVotes.map((vote, index) => (
                      <div
                        key={vote.participantId}
                        className="p-3 rounded-lg bg-slate-50 border border-slate-200 text-center animate-reveal"
                        style={{ animationDelay: `${index * 0.05}s` }}
                      >
                        <div className="text-2xl mb-1">{vote.participantEmoji}</div>
                        <div className="text-xs text-slate-500 mb-2 truncate">{vote.participantName}</div>
                        <div className="inline-flex items-center justify-center w-10 h-10 rounded-lg bg-primary-100 text-primary-700 font-semibold text-lg">
                          {vote.cardValue}
                        </div>
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
