/**
 * StorageService
 *
 * Wrapper around localStorage for persisting session and participant data.
 * Handles serialization/deserialization and error handling.
 */
class StorageService {
  /**
   * Save current participant ID
   */
  saveParticipantId(participantId: string): void {
    try {
      localStorage.setItem('current_participant_id', participantId);
    } catch (error) {
      console.error('[Storage] Failed to save participant ID:', error);
    }
  }

  /**
   * Get current participant ID
   */
  getParticipantId(): string | null {
    try {
      return localStorage.getItem('current_participant_id');
    } catch (error) {
      console.error('[Storage] Failed to get participant ID:', error);
      return null;
    }
  }

  /**
   * Save participant ID for specific session (for reconnection)
   */
  saveParticipantForSession(sessionId: string, participantId: string): void {
    try {
      localStorage.setItem(`participant_${sessionId}`, participantId);
    } catch (error) {
      console.error('[Storage] Failed to save participant ID:', error);
    }
  }

  /**
   * Get saved participant ID for specific session
   */
  getParticipantForSession(sessionId: string): string | null {
    try {
      return localStorage.getItem(`participant_${sessionId}`);
    } catch (error) {
      console.error('[Storage] Failed to get participant ID:', error);
      return null;
    }
  }

  /**
   * Remove current participant ID
   */
  removeParticipantId(): void {
    try {
      localStorage.removeItem('current_participant_id');
    } catch (error) {
      console.error('[Storage] Failed to remove participant ID:', error);
    }
  }

  /**
   * Remove participant ID for specific session
   */
  removeParticipantForSession(sessionId: string): void {
    try {
      localStorage.removeItem(`participant_${sessionId}`);
    } catch (error) {
      console.error('[Storage] Failed to remove participant ID:', error);
    }
  }

  /**
   * Save current session ID
   */
  saveSessionId(sessionId: string): void {
    try {
      localStorage.setItem('current_session_id', sessionId);
    } catch (error) {
      console.error('[Storage] Failed to save session ID:', error);
    }
  }

  /**
   * Get current session ID
   */
  getSessionId(): string | null {
    try {
      return localStorage.getItem('current_session_id');
    } catch (error) {
      console.error('[Storage] Failed to get session ID:', error);
      return null;
    }
  }

  /**
   * Save session ID for recent sessions list
   */
  saveRecentSession(sessionId: string): void {
    try {
      const recent = this.getRecentSessions();
      const updated = [sessionId, ...recent.filter((id) => id !== sessionId)].slice(0, 10);
      localStorage.setItem('recent_sessions', JSON.stringify(updated));
    } catch (error) {
      console.error('[Storage] Failed to save recent session:', error);
    }
  }

  /**
   * Get recent session IDs
   */
  getRecentSessions(): string[] {
    try {
      const data = localStorage.getItem('recent_sessions');
      return data ? JSON.parse(data) : [];
    } catch (error) {
      console.error('[Storage] Failed to get recent sessions:', error);
      return [];
    }
  }

  /**
   * Save browser fingerprint
   */
  saveBrowserFingerprint(fingerprint: string): void {
    try {
      localStorage.setItem('browser_fingerprint', fingerprint);
    } catch (error) {
      console.error('[Storage] Failed to save browser fingerprint:', error);
    }
  }

  /**
   * Get saved browser fingerprint
   */
  getBrowserFingerprint(): string | null {
    try {
      return localStorage.getItem('browser_fingerprint');
    } catch (error) {
      console.error('[Storage] Failed to get browser fingerprint:', error);
      return null;
    }
  }

  /**
   * Clear all session data
   */
  clearSessionData(): void {
    try {
      localStorage.removeItem('current_session_id');
      localStorage.removeItem('current_participant_id');
    } catch (error) {
      console.error('[Storage] Failed to clear session data:', error);
    }
  }

  /**
   * Clear all storage
   */
  clearAll(): void {
    try {
      localStorage.clear();
    } catch (error) {
      console.error('[Storage] Failed to clear storage:', error);
    }
  }
}

// Export singleton instance
export const storageService = new StorageService();
