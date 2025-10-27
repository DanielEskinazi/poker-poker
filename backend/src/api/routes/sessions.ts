import { Router, Request, Response } from 'express';
import { sessionService } from '../../services/SessionService.js';
import { validateName, sanitizeName } from '../../utils/validation.js';
import { env } from '../../config/environment.js';

/**
 * Session API Routes
 *
 * Implements REST endpoints for session management as defined in:
 * specs/001-anonymous-planning-poker/contracts/rest-api.md
 */

const router = Router();

/**
 * POST /api/sessions
 *
 * Creates a new Planning Poker session.
 * The creator becomes the first participant and moderator.
 */
router.post('/sessions', async (req: Request, res: Response) => {
  try {
    const { creatorName, browserFingerprint } = req.body;

    // Validate required fields
    if (!creatorName) {
      return res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Name must be 1-50 characters',
          field: 'creatorName',
          timestamp: Date.now()
        }
      });
    }

    if (!browserFingerprint) {
      return res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Browser fingerprint is required',
          field: 'browserFingerprint',
          timestamp: Date.now()
        }
      });
    }

    // Sanitize and validate name
    const sanitizedName = sanitizeName(creatorName);

    if (!validateName(sanitizedName)) {
      return res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Name must be 1-50 characters',
          field: 'creatorName',
          timestamp: Date.now()
        }
      });
    }

    // Create session using SessionService
    const result = sessionService.createSession({
      creatorName: sanitizedName,
      browserFingerprint
    });

    // Construct session URL
    const protocol = req.protocol;
    const host = req.get('host');
    const sessionUrl = `${protocol}://${host}/session/${result.session.sessionId}`;

    // Return success response matching contract
    return res.status(201).json({
      sessionId: result.session.sessionId,
      sessionUrl,
      participant: {
        participantId: result.participant.participantId,
        name: result.participant.name,
        emoji: result.participant.emoji,
        isModerator: result.participant.isModerator
      },
      createdAt: result.session.createdAt
    });

  } catch (error) {
    console.error('Error creating session:', error);

    return res.status(500).json({
      error: {
        code: 'SERVER_ERROR',
        message: 'Failed to create session',
        timestamp: Date.now()
      }
    });
  }
});

/**
 * GET /api/sessions/:sessionId
 *
 * Retrieves session metadata and current state.
 * Used for initial page load to check if session exists.
 */
router.get('/sessions/:sessionId', async (req: Request, res: Response) => {
  try {
    const { sessionId } = req.params;

    // Validate session ID format (8 alphanumeric characters)
    if (!/^[A-Za-z0-9]{8}$/.test(sessionId)) {
      return res.status(404).json({
        error: {
          code: 'SESSION_NOT_FOUND',
          message: 'Session not found or has expired',
          timestamp: Date.now()
        }
      });
    }

    // Get session from cache
    const session = sessionService.getSession(sessionId);

    if (!session) {
      return res.status(404).json({
        error: {
          code: 'SESSION_NOT_FOUND',
          message: 'Session not found or has expired',
          timestamp: Date.now()
        }
      });
    }

    // Check if session is expired
    const now = Date.now();
    const isExpired = now > session.expiresAt;

    // Return session metadata
    return res.status(200).json({
      sessionId: session.sessionId,
      createdAt: session.createdAt,
      expiresAt: session.expiresAt,
      participantCount: session.participantCount,
      votingState: session.votingState,
      isExpired
    });

  } catch (error) {
    console.error('Error retrieving session:', error);

    return res.status(500).json({
      error: {
        code: 'SERVER_ERROR',
        message: 'Failed to retrieve session',
        timestamp: Date.now()
      }
    });
  }
});

/**
 * GET /api/sessions/:sessionId/participants
 *
 * Retrieves list of participants in a session.
 * Used for initial state load before WebSocket connection.
 */
router.get('/sessions/:sessionId/participants', async (req: Request, res: Response) => {
  try {
    const { sessionId } = req.params;

    // Validate session ID format
    if (!/^[A-Za-z0-9]{8}$/.test(sessionId)) {
      return res.status(404).json({
        error: {
          code: 'SESSION_NOT_FOUND',
          message: 'Session not found or has expired',
          timestamp: Date.now()
        }
      });
    }

    // Get session from cache
    const session = sessionService.getSession(sessionId);

    if (!session) {
      return res.status(404).json({
        error: {
          code: 'SESSION_NOT_FOUND',
          message: 'Session not found or has expired',
          timestamp: Date.now()
        }
      });
    }

    // Convert participants Map to array
    const participants = Array.from(session.participants.values()).map(p => ({
      participantId: p.participantId,
      name: p.name,
      emoji: p.emoji,
      isModerator: p.isModerator,
      isConnected: p.isConnected,
      joinedAt: p.joinTimestamp
    }));

    // Return participants list
    return res.status(200).json({
      participants,
      count: participants.length
    });

  } catch (error) {
    console.error('Error retrieving participants:', error);

    return res.status(500).json({
      error: {
        code: 'SERVER_ERROR',
        message: 'Failed to retrieve participants',
        timestamp: Date.now()
      }
    });
  }
});

export default router;
