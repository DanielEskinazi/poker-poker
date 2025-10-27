import winston from 'winston';
import { config } from '../config/environment.js';

/**
 * Create Winston logger instance with structured logging
 */
const logger = winston.createLogger({
  level: config.logLevel,
  format: winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    winston.format.errors({ stack: true }),
    winston.format.splat(),
    winston.format.json()
  ),
  defaultMeta: { service: 'planning-poker-backend' },
  transports: [
    // Write all logs with importance level of `error` or less to `error.log`
    new winston.transports.File({ filename: 'error.log', level: 'error' }),
    // Write all logs to `combined.log`
    new winston.transports.File({ filename: 'combined.log' }),
  ],
});

// If not in production, also log to console with colorized output
if (config.nodeEnv !== 'production') {
  logger.add(
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple()
      ),
    })
  );
}

/**
 * Log session event
 */
export function logSessionEvent(
  event: string,
  sessionId: string,
  meta?: Record<string, unknown>
) {
  logger.info(`[SESSION] ${event}`, { sessionId, ...meta });
}

/**
 * Log participant event
 */
export function logParticipantEvent(
  event: string,
  sessionId: string,
  participantId: string,
  meta?: Record<string, unknown>
) {
  logger.info(`[PARTICIPANT] ${event}`, {
    sessionId,
    participantId,
    ...meta,
  });
}

/**
 * Log WebSocket event
 */
export function logWebSocketEvent(
  event: string,
  socketId: string,
  meta?: Record<string, unknown>
) {
  logger.debug(`[WS] ${event}`, { socketId, ...meta });
}

/**
 * Log error
 */
export function logError(
  message: string,
  error: Error | unknown,
  meta?: Record<string, unknown>
) {
  logger.error(message, {
    error: error instanceof Error ? error.message : String(error),
    stack: error instanceof Error ? error.stack : undefined,
    ...meta,
  });
}

/**
 * Log performance metric
 */
export function logPerformance(
  operation: string,
  durationMs: number,
  meta?: Record<string, unknown>
) {
  logger.info(`[PERF] ${operation}`, { durationMs, ...meta });
}

export default logger;
