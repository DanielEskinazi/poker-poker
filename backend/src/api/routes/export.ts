import { Router, Request, Response } from 'express';
import { sessionService } from '../../services/SessionService.js';
import { exportService } from '../../services/ExportService.js';
import { logWebSocketEvent, logError } from '../../utils/logger.js';

/**
 * Export API Routes
 *
 * Implements REST endpoint for Excel export as defined in:
 * specs/001-anonymous-planning-poker/contracts/rest-api.md
 */

const router = Router();

/**
 * GET /api/sessions/:sessionId/export
 *
 * Generates Excel file with session voting history.
 * Only moderators can export session data (FR-024).
 */
router.get('/sessions/:sessionId/export', async (req: Request, res: Response) => {
  try {
    const { sessionId } = req.params;
    const { participantId } = req.query;

    // Validate participantId is provided
    if (!participantId || typeof participantId !== 'string') {
      return res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'participantId query parameter is required',
          timestamp: Date.now()
        }
      });
    }

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

    // Validate participant exists in session
    const participant = session.participants.get(participantId);
    if (!participant) {
      return res.status(404).json({
        error: {
          code: 'PARTICIPANT_NOT_FOUND',
          message: 'Participant not found in this session',
          timestamp: Date.now()
        }
      });
    }

    // Check if participant is a moderator (FR-024)
    if (!session.moderatorIds.has(participantId)) {
      return res.status(403).json({
        error: {
          code: 'NOT_MODERATOR',
          message: 'Only moderators can export session data',
          timestamp: Date.now()
        }
      });
    }

    logWebSocketEvent('export-requested', sessionId, { participantId });

    // Generate Excel file
    const excelBuffer = await exportService.generateExcel(session);

    // Set response headers for Excel file download
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    );
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="planning-poker-session-${sessionId}.xlsx"`
    );
    res.setHeader('Content-Length', excelBuffer.length);

    logWebSocketEvent('export-completed', sessionId, {
      participantId,
      fileSize: excelBuffer.length
    });

    return res.send(excelBuffer);

  } catch (error) {
    logError('Error exporting session', error as Error, {
      sessionId: req.params.sessionId,
      participantId: req.query.participantId
    });

    return res.status(500).json({
      error: {
        code: 'SERVER_ERROR',
        message: 'Failed to export session data',
        timestamp: Date.now()
      }
    });
  }
});

export default router;
