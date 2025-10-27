/**
 * Environment Configuration
 *
 * Loads and validates environment variables for the Planning Poker application.
 * All required variables must be present or the application will fail to start.
 */

import { config } from 'dotenv';

// Load .env file
config();

interface EnvironmentConfig {
  // Server
  NODE_ENV: 'development' | 'production' | 'test';
  PORT: number;
  HOST: string;

  // CORS
  CORS_ORIGIN: string;

  // Session Configuration
  SESSION_EXPIRY_MS: number;
  MAX_PARTICIPANTS: number;

  // Rate Limiting
  RATE_LIMIT_ENABLED: boolean;

  // Logging
  LOG_LEVEL: 'error' | 'warn' | 'info' | 'debug';
}

/**
 * Validates and parses environment variables
 */
function loadEnvironment(): EnvironmentConfig {
  const nodeEnv = process.env.NODE_ENV as EnvironmentConfig['NODE_ENV'];

  if (!['development', 'production', 'test'].includes(nodeEnv)) {
    throw new Error(`Invalid NODE_ENV: ${nodeEnv}. Must be 'development', 'production', or 'test'`);
  }

  const port = parseInt(process.env.PORT || '3000', 10);
  if (isNaN(port) || port < 1 || port > 65535) {
    throw new Error(`Invalid PORT: ${process.env.PORT}. Must be between 1 and 65535`);
  }

  const sessionExpiryMs = parseInt(process.env.SESSION_EXPIRY_MS || '3600000', 10);
  if (isNaN(sessionExpiryMs) || sessionExpiryMs < 60000) {
    throw new Error(`Invalid SESSION_EXPIRY_MS: ${process.env.SESSION_EXPIRY_MS}. Must be at least 60000 (1 minute)`);
  }

  const maxParticipants = parseInt(process.env.MAX_PARTICIPANTS || '20', 10);
  if (isNaN(maxParticipants) || maxParticipants < 1) {
    throw new Error(`Invalid MAX_PARTICIPANTS: ${process.env.MAX_PARTICIPANTS}. Must be at least 1`);
  }

  const logLevel = (process.env.LOG_LEVEL || 'info') as EnvironmentConfig['LOG_LEVEL'];
  if (!['error', 'warn', 'info', 'debug'].includes(logLevel)) {
    throw new Error(`Invalid LOG_LEVEL: ${logLevel}. Must be 'error', 'warn', 'info', or 'debug'`);
  }

  return {
    NODE_ENV: nodeEnv,
    PORT: port,
    HOST: process.env.HOST || 'localhost',
    CORS_ORIGIN: process.env.CORS_ORIGIN || 'http://localhost:5173',
    SESSION_EXPIRY_MS: sessionExpiryMs,
    MAX_PARTICIPANTS: maxParticipants,
    RATE_LIMIT_ENABLED: process.env.RATE_LIMIT_ENABLED !== 'false',
    LOG_LEVEL: logLevel,
  };
}

// Export validated configuration
export const env = loadEnvironment();

// Log configuration on startup (redact sensitive values in production)
if (env.NODE_ENV !== 'test') {
  console.log('[ENV] Configuration loaded:', {
    NODE_ENV: env.NODE_ENV,
    PORT: env.PORT,
    HOST: env.HOST,
    CORS_ORIGIN: env.CORS_ORIGIN,
    SESSION_EXPIRY_MS: env.SESSION_EXPIRY_MS,
    MAX_PARTICIPANTS: env.MAX_PARTICIPANTS,
    RATE_LIMIT_ENABLED: env.RATE_LIMIT_ENABLED,
    LOG_LEVEL: env.LOG_LEVEL,
  });
}
