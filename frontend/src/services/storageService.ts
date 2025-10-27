/**
 * StorageService
 *
 * Wrapper around localStorage for persisting session and participant data.
 * Handles serialization/deserialization and error handling.
 */
class StorageService {
  /**
   * Save participant ID for reconnection
   */
  saveParticipantId(sessionId: string, participantId: string): void {
    try {
      localStorage.setItem(`participant_${sessionId}`, participantId);
    } catch (error) {
      console.error('[Storage] Failed to save participant ID:', error);
    }
  }

  /**
   * Get saved participant ID
   */
  getParticipantId(sessionId: string): string | null {
    try {
      return localStorage.getItem(`participant_${sessionId}`);
    } catch (error) {
      console.error('[Storage] Failed to get participant ID:', error);
      return null;
    }
  }

  /**
   * Remove participant ID
   */
  removeParticipantId(sessionId: string): void {
    try {
      localStorage.removeItem(`participant_${sessionId}`);
    } catch (error) {
      console.error('[Storage] Failed to remove participant ID:', error);
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
  clearSessionData(sessionId: string): void {
    this.removeParticipantId(sessionId);
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
