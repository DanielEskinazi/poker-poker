import { useState, useEffect, useCallback } from 'react';
import { socketService, ReconnectionState } from '../services/socketService';
import { storageService } from '../services/storageService';

/**
 * Hook for managing WebSocket reconnection state and automatic session rejoining
 *
 * Provides:
 * - Current reconnection state (connected, disconnected, reconnecting, failed)
 * - Attempt number during reconnection
 * - Automatic session rejoining after reconnection
 */
export function useReconnection(
  sessionId: string | undefined,
  onReconnected?: () => void
) {
  const [reconnectionState, setReconnectionState] = useState<ReconnectionState>('disconnected');
  const [attemptNumber, setAttemptNumber] = useState<number | undefined>(undefined);
  const [isRejoining, setIsRejoining] = useState(false);

  // Handle reconnection state changes
  useEffect(() => {
    const unsubscribe = socketService.onReconnectionStateChange((state, attempt) => {
      setReconnectionState(state);
      setAttemptNumber(attempt);

      // If reconnected and we have a session, try to rejoin
      if (state === 'connected' && sessionId) {
        const savedData = storageService.getParticipantDataForSession(sessionId);
        if (savedData) {
          setIsRejoining(true);
          // The session page will handle the actual rejoin logic
          // This hook just provides the state
        }
        onReconnected?.();
      }
    });

    return unsubscribe;
  }, [sessionId, onReconnected]);

  // Reset rejoining state when connection is stable
  useEffect(() => {
    if (reconnectionState === 'connected') {
      // Give some time for the rejoin to complete
      const timeout = setTimeout(() => {
        setIsRejoining(false);
      }, 2000);
      return () => clearTimeout(timeout);
    }
    return undefined;
  }, [reconnectionState]);

  // Helper to check if we should show reconnecting UI
  const isReconnecting = reconnectionState === 'reconnecting' || reconnectionState === 'disconnected';
  const isConnectionFailed = reconnectionState === 'failed';

  // Manual retry function
  const retryConnection = useCallback(() => {
    const socket = socketService.getSocket();
    if (socket && !socket.connected) {
      socket.connect();
    }
  }, []);

  return {
    reconnectionState,
    attemptNumber,
    isReconnecting,
    isConnectionFailed,
    isRejoining,
    retryConnection,
  };
}
