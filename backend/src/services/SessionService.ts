import NodeCache from 'node-cache';
import { generateSessionId, generateParticipantId } from '../utils/idGenerator.js';
import { assignEmojiByHash } from '../utils/emojiAssigner.js';
import { env } from '../config/environment.js';
import type { Session, CreateSessionParams, CreateSessionResult } from '../models/Session.js';
import type { Participant } from '../models/Participant.js';

/**
 * SessionService
 *
 * Handles session creation, retrieval, and lifecycle management.
 * Uses in-memory cache with 1-hour TTL for session storage.
 */
export class SessionService {
  private sessionCache: NodeCache;

  constructor() {
    // Initialize cache with session expiry time
    this.sessionCache = new NodeCache({
      stdTTL: env.SESSION_EXPIRY_MS / 1000, // Convert ms to seconds
      checkperiod: 60, // Check for expired keys every 60 seconds
      useClones: false, // Performance optimization - don't clone objects
    });
  }

  /**
   * Create a new session with the creator as first participant and moderator
   */
  createSession(params: CreateSessionParams): CreateSessionResult {
    const now = Date.now();
    const sessionId = generateSessionId();
    const creatorId = generateParticipantId();
    const emoji = assignEmojiByHash(creatorId);

    // Create creator participant
    const creator: Participant = {
      participantId: creatorId,
      browserFingerprint: params.browserFingerprint,
      name: params.creatorName,
      emoji,
      isModerator: true,
      isSpectator: false,
      joinTimestamp: now,
      isConnected: true,
      socketIds: new Set(),
      lastSeenAt: now,
      hasVoted: false,
      currentVote: null,
    };

    // Create session
    const session: Session = {
      sessionId,
      createdAt: now,
      lastActivityAt: now,
      expiresAt: now + env.SESSION_EXPIRY_MS,
      storyDescription: 'Story to estimate',
      votingState: 'voting',
      participants: new Map([[creatorId, creator]]),
      votes: new Map(),
      voteHistory: [],
      participantCount: 1,
      moderatorIds: new Set([creatorId]),
    };

    // Store in cache
    this.sessionCache.set(sessionId, session);

    return { session, participant: creator };
  }

  /**
   * Get session by ID
   */
  getSession(sessionId: string): Session | undefined {
    return this.sessionCache.get<Session>(sessionId);
  }

  /**
   * Update session last activity timestamp
   */
  updateLastActivity(sessionId: string): void {
    const session = this.getSession(sessionId);
    if (session) {
      session.lastActivityAt = Date.now();
    }
  }

  /**
   * Delete session from cache
   */
  deleteSession(sessionId: string): boolean {
    return this.sessionCache.del(sessionId) > 0;
  }

  /**
   * Get all active session IDs
   */
  getAllSessionIds(): string[] {
    return this.sessionCache.keys();
  }

  /**
   * Get cache statistics
   */
  getStats() {
    return this.sessionCache.getStats();
  }

  /**
   * Clear all sessions (for testing purposes only)
   */
  clearAllSessions(): void {
    this.sessionCache.flushAll();
  }
}

// Export singleton instance
export const sessionService = new SessionService();
