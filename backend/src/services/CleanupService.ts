import { Server as SocketIOServer } from 'socket.io';
import { SessionService } from './SessionService.js';
import {
  SESSION_EXPIRY_MS,
  EXPIRY_WARNING_THRESHOLD_MS,
  CLEANUP_INTERVAL_MS
} from '../config/constants.js';
import { logWebSocketEvent, logError } from '../utils/logger.js';

/**
 * CleanupService
 *
 * Background service that manages session lifecycle:
 * - Runs periodic cleanup cycles to check for expired sessions
 * - Broadcasts warning events to sessions approaching expiry
 * - Broadcasts expired events and removes expired sessions
 */
export class CleanupService {
  private io: SocketIOServer;
  private sessionService: SessionService;
  private cleanupInterval: NodeJS.Timeout | null = null;
  private warnedSessions: Set<string> = new Set();

  constructor(io: SocketIOServer, sessionService: SessionService) {
    this.io = io;
    this.sessionService = sessionService;
  }

  /**
   * Start the cleanup background job
   * Runs every CLEANUP_INTERVAL_MS (default: 5 minutes)
   */
  start(): void {
    if (this.cleanupInterval) {
      return; // Already running
    }

    logWebSocketEvent('cleanup-service-started', 'system', {
      intervalMs: CLEANUP_INTERVAL_MS
    });

    this.cleanupInterval = setInterval(() => {
      this.runCleanupCycle();
    }, CLEANUP_INTERVAL_MS);
  }

  /**
   * Stop the cleanup background job
   */
  stop(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;

      logWebSocketEvent('cleanup-service-stopped', 'system', {});
    }
  }

  /**
   * Run a single cleanup cycle
   * - Find and warn sessions nearing expiry
   * - Find and expire sessions past expiry
   */
  runCleanupCycle(): void {
    try {
      // First, warn sessions nearing expiry
      const sessionsNearingExpiry = this.findSessionsNearingExpiry();
      for (const sessionId of sessionsNearingExpiry) {
        if (!this.warnedSessions.has(sessionId)) {
          this.broadcastSessionExpiring(sessionId);
          this.warnedSessions.add(sessionId);
        }
      }

      // Then, expire sessions past expiry time
      const expiredSessions = this.findExpiredSessions();
      for (const sessionId of expiredSessions) {
        this.broadcastSessionExpired(sessionId);
        this.sessionService.deleteSession(sessionId);
        this.warnedSessions.delete(sessionId);
      }

      // Clean up warned sessions that no longer exist or have been refreshed
      this.cleanupWarnedSessions();

    } catch (error) {
      logError('Error in cleanup cycle', error, { service: 'CleanupService' });
    }
  }

  /**
   * Find sessions that have exceeded their expiry time
   * A session is expired when: now > lastActivityAt + SESSION_EXPIRY_MS
   */
  findExpiredSessions(): string[] {
    const now = Date.now();
    const expired: string[] = [];

    for (const sessionId of this.sessionService.getAllSessionIds()) {
      const session = this.sessionService.getSession(sessionId);
      if (session) {
        const expiryTime = session.lastActivityAt + SESSION_EXPIRY_MS;
        if (now > expiryTime) {
          expired.push(sessionId);
        }
      }
    }

    return expired;
  }

  /**
   * Find sessions that are approaching expiry (within warning threshold)
   * A session needs warning when:
   * - Time remaining < EXPIRY_WARNING_THRESHOLD_MS
   * - Session is not already expired
   */
  findSessionsNearingExpiry(): string[] {
    const now = Date.now();
    const nearingExpiry: string[] = [];

    for (const sessionId of this.sessionService.getAllSessionIds()) {
      const session = this.sessionService.getSession(sessionId);
      if (session) {
        const expiryTime = session.lastActivityAt + SESSION_EXPIRY_MS;
        const timeRemaining = expiryTime - now;

        // Within warning threshold but not yet expired
        if (timeRemaining > 0 && timeRemaining <= EXPIRY_WARNING_THRESHOLD_MS) {
          nearingExpiry.push(sessionId);
        }
      }
    }

    return nearingExpiry;
  }

  /**
   * Calculate minutes remaining until session expiry
   */
  calculateMinutesRemaining(sessionId: string): number {
    const session = this.sessionService.getSession(sessionId);
    if (!session) {
      return 0;
    }

    const expiryTime = session.lastActivityAt + SESSION_EXPIRY_MS;
    const timeRemaining = expiryTime - Date.now();

    return Math.max(0, Math.ceil(timeRemaining / 60000));
  }

  /**
   * Broadcast session-expiring event to all participants in a session
   */
  private broadcastSessionExpiring(sessionId: string): void {
    const minutesRemaining = this.calculateMinutesRemaining(sessionId);

    const event = {
      sessionId,
      minutesRemaining,
      timestamp: Date.now()
    };

    this.io.to(sessionId).emit('session-expiring', event);

    logWebSocketEvent('session-expiring', sessionId, {
      minutesRemaining
    });
  }

  /**
   * Broadcast session-expired event to all participants in a session
   */
  private broadcastSessionExpired(sessionId: string): void {
    const event = {
      sessionId,
      reason: 'inactivity',
      timestamp: Date.now()
    };

    this.io.to(sessionId).emit('session-expired', event);

    logWebSocketEvent('session-expired', sessionId, {
      reason: 'inactivity'
    });
  }

  /**
   * Clean up warned sessions that are no longer valid
   * (e.g., session was refreshed or deleted externally)
   */
  private cleanupWarnedSessions(): void {
    const now = Date.now();

    for (const sessionId of this.warnedSessions) {
      const session = this.sessionService.getSession(sessionId);

      // Remove from warned if session no longer exists
      if (!session) {
        this.warnedSessions.delete(sessionId);
        continue;
      }

      // Remove from warned if session was refreshed (no longer nearing expiry)
      const expiryTime = session.lastActivityAt + SESSION_EXPIRY_MS;
      const timeRemaining = expiryTime - now;

      if (timeRemaining > EXPIRY_WARNING_THRESHOLD_MS) {
        this.warnedSessions.delete(sessionId);
      }
    }
  }
}
