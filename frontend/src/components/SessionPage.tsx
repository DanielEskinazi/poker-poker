import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { socketService } from '../services/socketService';
import { storageService } from '../services/storageService';
import { CardDeck } from './CardDeck';
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
  isSpectator: boolean;
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

// Keyboard shortcut constants
const KEYBOARD_SHORTCUTS = {
  REVEAL: 'r',
  RESET: 'n', // 'n' for new round
} as const;

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
  const [copiedSessionId, setCopiedSessionId] = useState(false);
  const [showParticipantsPanel, setShowParticipantsPanel] = useState(false);
  const [sessionExpiryWarning, setSessionExpiryWarning] = useState<number | null>(null); // minutes remaining
  const [showExpiredModal, setShowExpiredModal] = useState(false);

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

  const copySessionId = async () => {
    if (!sessionId) return;
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopiedSessionId(true);
      showToast('Link copied to clipboard', 'success');
      setTimeout(() => setCopiedSessionId(false), 2000);
    } catch {
      showToast('Failed to copy link', 'error');
    }
  };

  const toggleSpectatorMode = () => {
    if (!sessionId || !currentParticipant) return;

    const socket = socketService.getSocket();
    if (!socket) return;

    const newSpectatorState = !currentParticipant.isSpectator;
    socket.emit('toggle-spectator', {
      sessionId,
      participantId: currentParticipant.participantId,
      isSpectator: newSpectatorState,
    });

    showToast(
      newSpectatorState ? 'Switched to spectator mode' : 'Switched to voter mode',
      'info'
    );
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

  // Get voters (non-spectators) for vote count display
  const voters = participantsWithVotingStatus.filter((p) => !p.isSpectator);


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

    // Handle session expiring warning
    const handleSessionExpiring = (data: any) => {
      console.log('[SessionPage] Session expiring:', data);
      setSessionExpiryWarning(data.minutesRemaining);
      showToast(`Session expires in ${data.minutesRemaining} minutes`, 'error');
    };

    // Handle session expired
    const handleSessionExpired = () => {
      console.log('[SessionPage] Session expired');
      setShowExpiredModal(true);
      setSessionExpiryWarning(null);
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

    // Handle spectator toggled
    const handleSpectatorToggled = (data: any) => {
      console.log('[SessionPage] Spectator toggled:', data);

      // Update current participant if they toggled
      if (currentParticipant && data.participantId === currentParticipant.participantId) {
        setCurrentParticipant({ ...currentParticipant, isSpectator: data.isSpectator });
      }

      // Refresh participants list
      fetchParticipants();
    };

    socket.on('participant-joined', handleParticipantJoined);
    socket.on('participant-left', handleParticipantLeft);
    socket.on('session-expiring', handleSessionExpiring);
    socket.on('session-expired', handleSessionExpired);
    socket.on('moderator-promoted', handleModeratorPromoted);
    socket.on('spectator-toggled', handleSpectatorToggled);

    return () => {
      socket.off('participant-joined', handleParticipantJoined);
      socket.off('participant-left', handleParticipantLeft);
      socket.off('session-expiring', handleSessionExpiring);
      socket.off('session-expired', handleSessionExpired);
      socket.off('moderator-promoted', handleModeratorPromoted);
      socket.off('spectator-toggled', handleSpectatorToggled);
    };
  }, [isJoined, navigate, currentParticipant]);

  // Keyboard shortcuts for moderator actions
  useEffect(() => {
    if (!isJoined || !currentParticipant?.isModerator) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger if user is typing in an input
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

      if (e.key.toLowerCase() === KEYBOARD_SHORTCUTS.REVEAL && voting.votingPhase !== 'revealed' && voting.votedCount > 0) {
        e.preventDefault();
        voting.revealVotes();
      } else if (e.key.toLowerCase() === KEYBOARD_SHORTCUTS.RESET && voting.votingPhase === 'revealed') {
        e.preventDefault();
        voting.resetVotes();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isJoined, currentParticipant?.isModerator, voting]);

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
    <div className="h-screen bg-slate-50 flex flex-col overflow-hidden">
      {/* Toast Notifications - Accessible */}
      <div className="fixed top-3 right-3 z-50 space-y-2" aria-live="polite" aria-atomic="false">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`
              px-3 py-2 rounded-lg shadow-lg
              flex items-center gap-2 toast-animate text-sm
              ${toast.type === 'success'
                ? 'bg-success-50 text-success-700 border border-success-200'
                : toast.type === 'error'
                  ? 'bg-error-50 text-error-700 border border-error-200'
                  : 'bg-white text-slate-700 border border-slate-200'
              }
            `}
          >
            {toast.type === 'success' && (
              <svg className="w-4 h-4 text-success-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            )}
            {toast.type === 'error' && (
              <svg className="w-4 h-4 text-error-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
              </svg>
            )}
            {toast.type === 'info' && (
              <svg className="w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z" />
              </svg>
            )}
            <span className="font-medium">{toast.message}</span>
          </div>
        ))}
      </div>

      {/* Session Expiry Warning Banner */}
      {sessionExpiryWarning !== null && (
        <div className="fixed top-0 left-0 right-0 z-40 bg-warning-500 text-white px-4 py-2 text-center animate-fade-in">
          <div className="flex items-center justify-center gap-2 text-sm font-medium">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
            </svg>
            <span>Session will expire in {sessionExpiryWarning} minute{sessionExpiryWarning !== 1 ? 's' : ''} due to inactivity</span>
            <button
              onClick={() => setSessionExpiryWarning(null)}
              className="ml-2 p-1 hover:bg-warning-600 rounded transition-colors"
              aria-label="Dismiss warning"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
      )}

      {/* Session Expired Modal */}
      {showExpiredModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 animate-fade-in">
          <div className="bg-white rounded-xl shadow-xl p-6 max-w-sm mx-4 animate-slide-up">
            <div className="text-center">
              <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-error-100 flex items-center justify-center">
                <svg className="w-8 h-8 text-error-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
                </svg>
              </div>
              <h2 className="text-lg font-semibold text-slate-900 mb-2">Session Expired</h2>
              <p className="text-sm text-slate-600 mb-6">
                This session has expired due to inactivity. Please create a new session to continue.
              </p>
              <button
                onClick={() => navigate('/')}
                className="w-full py-2.5 px-4 bg-primary-500 text-white rounded-lg font-medium hover:bg-primary-600 transition-colors"
              >
                Create New Session
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Compact Header */}
      <header className="flex-shrink-0 bg-white border-b border-slate-200 px-4 py-2">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-primary-500 flex items-center justify-center">
              <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6zM16 13a1 1 0 011-1h2a1 1 0 011 1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-6z" />
              </svg>
            </div>
            <div>
              <h1 className="text-sm font-semibold text-slate-900">Planning Poker</h1>
              <button
                onClick={copySessionId}
                className="group flex items-center gap-1 text-[10px] font-mono text-slate-500 hover:text-primary-600 transition-colors cursor-pointer"
                title="Click to copy session link"
              >
                <code>{sessionId}</code>
                {copiedSessionId ? (
                  <svg className="w-3 h-3 text-success-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                ) : (
                  <svg className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                  </svg>
                )}
              </button>
            </div>
          </div>

          {/* Inline Vote Progress */}
          {isJoined && (
            <div className="flex items-center gap-4">
              {/* Vote Progress Bar */}
              <div className="hidden sm:flex items-center gap-2">
                <div className="flex items-center gap-1.5">
                  {[...Array(Math.min(voters.length, 8))].map((_, i) => (
                    <div
                      key={i}
                      className={`w-2 h-2 rounded-full transition-colors ${
                        i < voting.votedCount ? 'bg-primary-500' : 'bg-slate-200'
                      }`}
                    />
                  ))}
                  {voters.length > 8 && (
                    <span className="text-xs text-slate-400">+{voters.length - 8}</span>
                  )}
                </div>
                <span className="text-xs text-slate-500">
                  {voting.votedCount}/{voters.length}
                </span>
                <span className={`badge text-[10px] py-0.5 ${
                  voting.votingPhase === 'revealed'
                    ? 'badge-success'
                    : voting.votedCount === voters.length && voters.length > 0
                      ? 'badge-warning'
                      : 'badge-neutral'
                }`}>
                  {voting.votingPhase === 'revealed'
                    ? 'Revealed'
                    : voting.votedCount === voters.length && voters.length > 0
                      ? 'Ready'
                      : 'Voting'
                  }
                </span>
              </div>

              {/* Current User */}
              {currentParticipant && (
                <div className="flex items-center gap-2 pl-4 border-l border-slate-200">
                  <div className="w-7 h-7 rounded-full bg-slate-100 flex items-center justify-center text-sm">
                    {currentParticipant.emoji}
                  </div>
                  <div className="hidden sm:block">
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-medium text-slate-700">{currentParticipant.name}</span>
                      {currentParticipant.isModerator && (
                        <span className="badge badge-warning text-[9px] py-0">Host</span>
                      )}
                      {currentParticipant.isSpectator && (
                        <span className="badge badge-neutral text-[9px] py-0">Spectator</span>
                      )}
                    </div>
                  </div>
                  {/* Spectator Toggle Button */}
                  <button
                    onClick={toggleSpectatorMode}
                    className={`
                      p-1 rounded-md transition-all duration-200
                      ${currentParticipant.isSpectator
                        ? 'bg-slate-200 text-slate-600'
                        : 'hover:bg-slate-100 text-slate-400 hover:text-slate-600'
                      }
                    `}
                    title={currentParticipant.isSpectator ? 'Switch to voter' : 'Switch to spectator (no voting)'}
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      {currentParticipant.isSpectator ? (
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                      ) : (
                        <path strokeLinecap="round" strokeLinejoin="round" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                      )}
                    </svg>
                  </button>
                </div>
              )}

              {/* Participants Panel Toggle */}
              <button
                onClick={() => setShowParticipantsPanel(!showParticipantsPanel)}
                className={`
                  ml-2 p-1.5 rounded-lg transition-all duration-200
                  flex items-center gap-1.5
                  ${showParticipantsPanel
                    ? 'bg-primary-100 text-primary-600'
                    : 'hover:bg-slate-100 text-slate-500 hover:text-slate-700'
                  }
                `}
                title="Toggle participants panel"
                aria-expanded={showParticipantsPanel}
                aria-controls="participants-panel"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
                </svg>
                <span className="hidden sm:inline text-xs font-medium">{participantsWithVotingStatus.length}</span>
              </button>
            </div>
          )}
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 overflow-hidden">
        {!isJoined ? (
          /* Join Form - Centered */
          <div className="h-full flex items-center justify-center p-4">
            <div className="w-full max-w-sm animate-slide-up">
              <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-soft">
                <div className="text-center mb-5">
                  <div className="w-11 h-11 mx-auto mb-3 rounded-full bg-primary-100 flex items-center justify-center">
                    <svg className="w-5 h-5 text-primary-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
                    </svg>
                  </div>
                  <h2 className="text-base font-semibold text-slate-900 mb-0.5">Join Session</h2>
                  <p className="text-xs text-slate-500">Enter your name to participate</p>
                </div>

                {error && (
                  <div
                    role="alert"
                    className="mb-3 p-2.5 rounded-lg bg-error-50 border border-error-200 text-error-700 flex items-center gap-2 animate-fade-in"
                  >
                    <svg className="w-4 h-4 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20" aria-hidden="true">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                    </svg>
                    <span className="text-xs">{error}</span>
                  </div>
                )}

                <div className="space-y-3">
                  <div>
                    <label htmlFor="name" className="text-xs font-medium text-slate-600 mb-1 block">Your name</label>
                    <input
                      id="name"
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleJoinSession()}
                      placeholder="Enter your name"
                      maxLength={50}
                      className="input text-sm py-2"
                      disabled={isJoining}
                      data-testid="name-input"
                    />
                  </div>

                  <button
                    onClick={handleJoinSession}
                    disabled={isJoining || !name.trim()}
                    className={`
                      w-full py-2 px-4 rounded-lg font-medium text-sm
                      transition-all duration-200
                      flex items-center justify-center gap-2
                      ${isJoining || !name.trim()
                        ? 'bg-slate-200 text-slate-400 cursor-not-allowed'
                        : 'bg-primary-500 text-white hover:bg-primary-600 active:scale-[0.98]'
                      }
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
          </div>
        ) : (
          /* Session Content - Compact Layout */
          <div className="h-full flex flex-col p-3 max-w-7xl mx-auto">
            {/* Participants Row - Horizontal */}
            <div className="flex-shrink-0 bg-white rounded-lg border border-slate-200 px-3 py-2 mb-3">
              <div className="flex items-center gap-3">
                <span className="text-xs font-medium text-slate-500 flex-shrink-0">Team</span>
                <div className="flex-1 flex items-center gap-1 overflow-x-auto scrollbar-hide">
                  {participantsWithVotingStatus.length === 0 ? (
                    <div className="flex items-center gap-2 text-xs text-slate-400 italic">
                      <svg className="w-4 h-4 animate-pulse" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5} aria-hidden="true">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M18 18.72a9.094 9.094 0 003.741-.479 3 3 0 00-4.682-2.72m.94 3.198l.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0112 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 016 18.719m12 0a5.971 5.971 0 00-.941-3.197m0 0A5.995 5.995 0 0012 12.75a5.995 5.995 0 00-5.058 2.772m0 0a3 3 0 00-4.681 2.72 8.986 8.986 0 003.74.477m.94-3.197a5.971 5.971 0 00-.94 3.197M15 6.75a3 3 0 11-6 0 3 3 0 016 0zm6 3a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0zm-13.5 0a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0z" />
                      </svg>
                      <span>Waiting for team to join...</span>
                    </div>
                  ) : (
                    <>
                      {/* Mobile: Stacked avatars (show first 5 + overflow) */}
                      <div className="flex sm:hidden items-center">
                        <div className="flex -space-x-1.5">
                          {participantsWithVotingStatus.slice(0, 5).map((participant, index) => (
                            <div
                              key={participant.participantId}
                              className={`
                                relative w-6 h-6 rounded-full flex items-center justify-center text-xs
                                border border-white
                                ${participant.participantId === currentParticipant?.participantId
                                  ? 'bg-primary-100 ring-1 ring-primary-400'
                                  : 'bg-slate-100'
                                }
                                ${!participant.isConnected ? 'opacity-40 grayscale' : ''}
                              `}
                              style={{ zIndex: 5 - index }}
                              title={`${participant.name}${participant.isModerator ? ' (Host)' : ''}`}
                            >
                              {participant.emoji}
                            </div>
                          ))}
                        </div>
                        {participantsWithVotingStatus.length > 5 && (
                          <div className="ml-1 px-1.5 py-0.5 rounded-full bg-slate-100 text-[10px] font-medium text-slate-500">
                            +{participantsWithVotingStatus.length - 5}
                          </div>
                        )}
                      </div>

                      {/* Desktop: Full participant list with names */}
                      <div className="hidden sm:flex items-center gap-2">
                        {participantsWithVotingStatus.map((participant) => (
                          <div
                            key={participant.participantId}
                            className={`
                              relative flex items-center gap-1.5 flex-shrink-0
                              px-2 py-1 rounded-full
                              ${participant.participantId === currentParticipant?.participantId ? 'order-first' : ''}
                              ${participant.isSpectator
                                ? 'bg-slate-50 border border-dashed border-slate-300'
                                : participant.participantId === currentParticipant?.participantId
                                  ? 'bg-primary-100 border border-primary-300'
                                  : 'bg-slate-100 border border-slate-200'
                              }
                              ${!participant.isConnected ? 'opacity-50' : ''}
                            `}
                            title={`${participant.name}${participant.isModerator ? ' (Host)' : ''}${participant.isSpectator ? ' (Spectator)' : ''} - ${participant.isSpectator ? 'Spectating' : participant.hasVoted ? 'Voted' : 'Thinking...'}`}
                          >
                            {/* Emoji */}
                            <span className={`text-sm ${participant.isSpectator ? 'opacity-60' : ''}`}>{participant.emoji}</span>
                            {/* Name */}
                            <span className={`
                              text-xs font-medium truncate max-w-[80px]
                              ${participant.isSpectator
                                ? 'text-slate-400'
                                : participant.participantId === currentParticipant?.participantId
                                  ? 'text-primary-700'
                                  : 'text-slate-600'
                              }
                            `}>
                              {participant.name}
                            </span>
                            {/* Host badge */}
                            {participant.isModerator && (
                              <svg className="w-3 h-3 text-warning-500 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20" aria-hidden="true">
                                <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                              </svg>
                            )}
                            {/* Spectator eye icon or Vote status indicator */}
                            {participant.isSpectator ? (
                              <svg className="w-3 h-3 text-slate-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                              </svg>
                            ) : (
                              <div className={`
                                absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-white
                                ${participant.hasVoted
                                  ? 'bg-success-500'
                                  : participant.isConnected
                                    ? 'bg-warning-400'
                                    : 'bg-slate-300'
                                }
                              `} />
                            )}
                          </div>
                        ))}
                      </div>
                    </>
                  )}
                </div>
                {/* Moderator Controls - Inline */}
                {currentParticipant?.isModerator && (
                  <div className="flex-shrink-0 flex items-center gap-2 pl-3 border-l border-slate-200">
                    <button
                      onClick={voting.revealVotes}
                      disabled={voting.votingPhase === 'revealed' || voting.votedCount === 0}
                      className={`
                        px-3 py-1.5 rounded-md text-xs font-medium
                        transition-all flex items-center gap-1.5
                        ${voting.votingPhase === 'revealed' || voting.votedCount === 0
                          ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                          : 'bg-primary-500 text-white hover:bg-primary-600'
                        }
                      `}
                      data-testid="reveal-votes-btn"
                      title={`Reveal votes (${KEYBOARD_SHORTCUTS.REVEAL.toUpperCase()})`}
                    >
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                      Reveal
                      <kbd className="hidden sm:inline-flex ml-1 px-1 py-0.5 text-[9px] font-mono bg-white/20 rounded">{KEYBOARD_SHORTCUTS.REVEAL.toUpperCase()}</kbd>
                    </button>
                    <button
                      onClick={voting.resetVotes}
                      disabled={voting.votingPhase === 'voting'}
                      className={`
                        px-3 py-1.5 rounded-md text-xs font-medium
                        transition-all flex items-center gap-1.5 border
                        ${voting.votingPhase === 'voting'
                          ? 'bg-slate-50 border-slate-200 text-slate-400 cursor-not-allowed'
                          : 'bg-white border-slate-300 text-slate-600 hover:bg-slate-50'
                        }
                      `}
                      data-testid="reset-votes-btn"
                      title={`New round (${KEYBOARD_SHORTCUTS.RESET.toUpperCase()})`}
                    >
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" />
                      </svg>
                      Reset
                      <kbd className="hidden sm:inline-flex ml-1 px-1 py-0.5 text-[9px] font-mono bg-slate-200 rounded">{KEYBOARD_SHORTCUTS.RESET.toUpperCase()}</kbd>
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Main Voting Area */}
            <div className="flex-1 flex flex-col min-h-0">
              {voting.votingPhase === 'revealed' && voting.revealedVotes.length > 0 ? (
                /* Results View */
                <div className="flex-1 bg-white rounded-lg border border-slate-200 p-4 overflow-auto">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-sm font-semibold text-slate-900">Results</h3>
                    {voting.statistics && (
                      <div className="flex items-center gap-4 text-xs">
                        <span className="text-slate-500">
                          Avg: <span className="font-semibold text-primary-600">{voting.statistics.averageNumeric?.toFixed(1) || '—'}</span>
                        </span>
                        <span className={`badge text-[10px] py-0.5 ${voting.statistics.consensus ? 'badge-success' : 'badge-warning'}`}>
                          {voting.statistics.consensus ? 'Consensus' : 'No Consensus'}
                        </span>
                      </div>
                    )}
                  </div>

                  <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 gap-2">
                    {voting.revealedVotes.map((vote, index) => (
                      <div
                        key={vote.participantId}
                        className="p-2 rounded-lg bg-slate-50 border border-slate-200 text-center animate-reveal"
                        style={{ animationDelay: `${index * 0.03}s` }}
                      >
                        <div className="text-lg mb-0.5">{vote.participantEmoji}</div>
                        <div className="text-[10px] text-slate-500 truncate mb-1">{vote.participantName}</div>
                        <div className="inline-flex items-center justify-center w-8 h-8 rounded-md bg-primary-100 text-primary-700 font-semibold text-sm">
                          {vote.cardValue}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                /* Voting View */
                <div className="flex-1 bg-white rounded-lg border border-slate-200 p-4 flex flex-col">
                  {/* Story Description - Compact */}
                  {session?.storyDescription && (
                    <div className="flex-shrink-0 mb-3 p-2 rounded-md bg-slate-50 border border-slate-100">
                      <p className="text-xs text-slate-600 line-clamp-2">{session.storyDescription}</p>
                    </div>
                  )}

                  {/* Card Deck - Centered (or Spectator Message) */}
                  <div className="flex-1 flex items-center justify-center">
                    {currentParticipant?.isSpectator ? (
                      <div className="text-center py-8">
                        <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-slate-100 flex items-center justify-center">
                          <svg className="w-8 h-8 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                            <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                          </svg>
                        </div>
                        <h3 className="text-sm font-medium text-slate-700 mb-1">Spectator Mode</h3>
                        <p className="text-xs text-slate-500 mb-4">You're observing this session without voting</p>
                        <button
                          onClick={toggleSpectatorMode}
                          className="px-4 py-2 text-xs font-medium rounded-lg bg-primary-500 text-white hover:bg-primary-600 transition-colors"
                        >
                          Join as Voter
                        </button>
                      </div>
                    ) : (
                      <CardDeck
                        onCardSelect={voting.castVote}
                        selectedCard={voting.selectedCard}
                        disabled={voting.isVoting}
                        votingState={voting.votingPhase}
                        compact
                      />
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </main>

      {/* Participants Panel - Slide-out */}
      {isJoined && (
        <>
          {/* Backdrop */}
          {showParticipantsPanel && (
            <div
              className="fixed inset-0 bg-black/20 z-40 sm:hidden animate-fade-in"
              onClick={() => setShowParticipantsPanel(false)}
              aria-hidden="true"
            />
          )}

          {/* Panel */}
          <aside
            id="participants-panel"
            className={`
              fixed top-0 right-0 h-full w-80 max-w-[85vw] z-50
              bg-white border-l border-slate-200 shadow-xl
              transform transition-transform duration-300 ease-out
              ${showParticipantsPanel ? 'translate-x-0' : 'translate-x-full'}
            `}
            aria-label="Participants panel"
          >
            {/* Panel Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200">
              <div className="flex items-center gap-2">
                <svg className="w-5 h-5 text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
                </svg>
                <h2 className="text-sm font-semibold text-slate-900">
                  Participants
                  <span className="ml-1.5 text-xs font-normal text-slate-500">
                    ({participantsWithVotingStatus.length})
                  </span>
                </h2>
              </div>
              <button
                onClick={() => setShowParticipantsPanel(false)}
                className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors"
                aria-label="Close panel"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Voting Summary */}
            <div className="px-4 py-3 bg-slate-50 border-b border-slate-100">
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-500">Voting Progress</span>
                <span className="font-medium text-slate-700">
                  {voting.votedCount} / {voters.length} voted
                </span>
              </div>
              <div className="mt-2 h-1.5 bg-slate-200 rounded-full overflow-hidden">
                <div
                  className="h-full bg-primary-500 rounded-full transition-all duration-500"
                  style={{ width: `${voters.length > 0 ? (voting.votedCount / voters.length) * 100 : 0}%` }}
                />
              </div>
            </div>

            {/* Participants List */}
            <div className="flex-1 overflow-y-auto">
              <ul className="divide-y divide-slate-100">
                {participantsWithVotingStatus.length === 0 ? (
                  <li className="px-4 py-8 text-center">
                    <svg className="w-10 h-10 mx-auto text-slate-300 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5} aria-hidden="true">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M18 18.72a9.094 9.094 0 003.741-.479 3 3 0 00-4.682-2.72m.94 3.198l.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0112 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 016 18.719m12 0a5.971 5.971 0 00-.941-3.197m0 0A5.995 5.995 0 0012 12.75a5.995 5.995 0 00-5.058 2.772m0 0a3 3 0 00-4.681 2.72 8.986 8.986 0 003.74.477m.94-3.197a5.971 5.971 0 00-.94 3.197M15 6.75a3 3 0 11-6 0 3 3 0 016 0zm6 3a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0zm-13.5 0a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0z" />
                    </svg>
                    <p className="text-sm text-slate-500">No participants yet</p>
                    <p className="text-xs text-slate-400 mt-1">Waiting for team to join...</p>
                  </li>
                ) : (
                  participantsWithVotingStatus.map((participant) => (
                    <li
                      key={participant.participantId}
                      className={`
                        px-4 py-3 flex items-center gap-3 transition-colors
                        ${participant.participantId === currentParticipant?.participantId
                          ? 'bg-primary-50/50'
                          : 'hover:bg-slate-50'
                        }
                      `}
                    >
                      {/* Avatar */}
                      <div className="relative flex-shrink-0">
                        <div className={`
                          w-10 h-10 rounded-full flex items-center justify-center text-lg
                          ${participant.participantId === currentParticipant?.participantId
                            ? 'bg-primary-100 ring-2 ring-primary-400'
                            : 'bg-slate-100'
                          }
                          ${!participant.isConnected ? 'opacity-50 grayscale' : ''}
                        `}>
                          {participant.emoji}
                        </div>
                        {/* Connection status dot */}
                        <div className={`
                          absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-white
                          ${participant.isConnected ? 'bg-success-500' : 'bg-slate-300'}
                        `} />
                      </div>

                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className={`
                            text-sm font-medium truncate
                            ${participant.participantId === currentParticipant?.participantId
                              ? 'text-primary-700'
                              : 'text-slate-900'
                            }
                          `}>
                            {participant.name}
                            {participant.participantId === currentParticipant?.participantId && (
                              <span className="text-xs font-normal text-slate-500 ml-1">(you)</span>
                            )}
                          </span>
                          {participant.isModerator && (
                            <span className="badge badge-warning text-[9px] py-0 flex-shrink-0">Host</span>
                          )}
                          {participant.isSpectator && (
                            <span className="badge badge-neutral text-[9px] py-0 flex-shrink-0">Spectator</span>
                          )}
                        </div>
                        <p className="text-xs text-slate-500 mt-0.5">
                          {!participant.isConnected
                            ? 'Disconnected'
                            : participant.isSpectator
                              ? 'Observing session'
                              : participant.hasVoted
                                ? voting.votingPhase === 'revealed'
                                  ? `Voted: ${voting.revealedVotes.find(v => v.participantId === participant.participantId)?.cardValue ?? '—'}`
                                  : 'Voted'
                                : 'Thinking...'
                          }
                        </p>
                      </div>

                      {/* Vote Status Icon */}
                      <div className="flex-shrink-0">
                        {participant.isSpectator ? (
                          <div className="w-6 h-6 rounded-full bg-slate-100 flex items-center justify-center">
                            <svg className="w-3.5 h-3.5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                              <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                            </svg>
                          </div>
                        ) : participant.hasVoted ? (
                          <div className="w-6 h-6 rounded-full bg-success-100 flex items-center justify-center">
                            <svg className="w-3.5 h-3.5 text-success-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                            </svg>
                          </div>
                        ) : participant.isConnected ? (
                          <div className="w-6 h-6 rounded-full bg-warning-100 flex items-center justify-center">
                            <div className="w-2 h-2 rounded-full bg-warning-500 animate-pulse" />
                          </div>
                        ) : (
                          <div className="w-6 h-6 rounded-full bg-slate-100 flex items-center justify-center">
                            <svg className="w-3.5 h-3.5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                            </svg>
                          </div>
                        )}
                      </div>
                    </li>
                  ))
                )}
              </ul>
            </div>

            {/* Panel Footer */}
            <div className="px-4 py-3 border-t border-slate-200 bg-slate-50">
              <div className="flex items-center justify-between text-xs text-slate-500">
                <span>
                  {participantsWithVotingStatus.filter(p => p.isConnected).length} online
                </span>
                <span>
                  {voting.votingPhase === 'revealed' ? 'Votes revealed' : 'Voting in progress'}
                </span>
              </div>
            </div>
          </aside>
        </>
      )}
    </div>
  );
}
