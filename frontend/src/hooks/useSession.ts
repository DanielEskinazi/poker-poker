import { useState, useCallback } from 'react';
import { apiService } from '../services/apiService';
import { socketService } from '../services/socketService';
import { storageService } from '../services/storageService';
import { useBrowserFingerprint } from './useBrowserFingerprint';

/**
 * useSession Hook
 *
 * Manages session state and provides methods for session operations.
 * Implements User Story 1 (US1) - Session Creation & Link Sharing
 */

interface CreateSessionResult {
  sessionId: string;
  sessionUrl: string;
  participant: {
    participantId: string;
    name: string;
    emoji: string;
    isModerator: boolean;
  };
  createdAt: number;
}

interface SessionData {
  sessionId: string | null;
  participantId: string | null;
  name: string | null;
  emoji: string | null;
  isModerator: boolean;
}

export function useSession() {
  const [sessionData, setSessionData] = useState<SessionData>({
    sessionId: null,
    participantId: null,
    name: null,
    emoji: null,
    isModerator: false,
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { fingerprint, loading: fingerprintLoading } = useBrowserFingerprint();

  /**
   * Create a new session
   */
  const createSession = useCallback(
    async (creatorName: string): Promise<CreateSessionResult> => {
      if (!fingerprint) {
        throw new Error('Browser fingerprint not ready');
      }

      setIsLoading(true);
      setError(null);

      try {
        // Call REST API to create session
        const result = await apiService.post<
          { creatorName: string; browserFingerprint: string },
          CreateSessionResult
        >('/api/sessions', {
          creatorName,
          browserFingerprint: fingerprint,
        });

        // Store session data in localStorage
        storageService.saveParticipantId(result.participant.participantId);
        storageService.saveSessionId(result.sessionId);

        // Update local state
        setSessionData({
          sessionId: result.sessionId,
          participantId: result.participant.participantId,
          name: result.participant.name,
          emoji: result.participant.emoji,
          isModerator: result.participant.isModerator,
        });

        setIsLoading(false);
        return result;
      } catch (err) {
        const errorMessage =
          err instanceof Error ? err.message : 'Failed to create session';
        setError(errorMessage);
        setIsLoading(false);
        throw err;
      }
    },
    [fingerprint]
  );

  /**
   * Create session via WebSocket (alternative method)
   */
  const createSessionViaWebSocket = useCallback(
    async (creatorName: string): Promise<CreateSessionResult> => {
      if (!fingerprint) {
        throw new Error('Browser fingerprint not ready');
      }

      setIsLoading(true);
      setError(null);

      try {
        // Connect to WebSocket if not already connected
        await socketService.connect();

        // Send create-session event
        const result = await new Promise<CreateSessionResult>(
          (resolve, reject) => {
            // Listen for session-created event
            socketService.on('session-created', (data: CreateSessionResult) => {
              resolve(data);
            });

            // Listen for error event
            socketService.on('error', (error: { code: string; message: string }) => {
              reject(new Error(error.message));
            });

            // Emit create-session event
            socketService.emit('create-session', {
              creatorName,
              browserFingerprint: fingerprint,
            });

            // Timeout after 10 seconds
            setTimeout(() => {
              reject(new Error('Session creation timed out'));
            }, 10000);
          }
        );

        // Store session data in localStorage
        storageService.saveParticipantId(result.participant.participantId);
        storageService.saveSessionId(result.sessionId);

        // Update local state
        setSessionData({
          sessionId: result.sessionId,
          participantId: result.participant.participantId,
          name: result.participant.name,
          emoji: result.participant.emoji,
          isModerator: result.participant.isModerator,
        });

        setIsLoading(false);
        return result;
      } catch (err) {
        const errorMessage =
          err instanceof Error ? err.message : 'Failed to create session';
        setError(errorMessage);
        setIsLoading(false);
        throw err;
      }
    },
    [fingerprint]
  );

  /**
   * Get session data from localStorage (for reconnection)
   */
  const loadSessionFromStorage = useCallback(() => {
    const sessionId = storageService.getSessionId();
    const participantId = storageService.getParticipantId();

    if (sessionId && participantId) {
      setSessionData((prev) => ({
        ...prev,
        sessionId,
        participantId,
      }));
    }
  }, []);

  /**
   * Clear session data
   */
  const clearSession = useCallback(() => {
    storageService.clearSessionData();
    setSessionData({
      sessionId: null,
      participantId: null,
      name: null,
      emoji: null,
      isModerator: false,
    });
  }, []);

  return {
    // State
    sessionData,
    isLoading: isLoading || fingerprintLoading,
    error,

    // Methods
    createSession,
    createSessionViaWebSocket,
    loadSessionFromStorage,
    clearSession,

    // Helpers
    isReady: !!fingerprint && !fingerprintLoading,
  };
}
