// ============================================================================
// LOGGER
// ============================================================================

import winston from 'winston';
import { config } from '../../config/app.config';

/**
 * Log format
 */
const logFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  winston.format.splat(),
  winston.format.printf(({ level, message, timestamp, stack }) => {
    if (stack) {
      return `${timestamp} [${level.toUpperCase()}]: ${message}\n${stack}`;
    }
    return `${timestamp} [${level.toUpperCase()}]: ${message}`;
  })
);

/**
 * Console transport for development
 */
const consoleTransport = new winston.transports.Console({
  format: winston.format.combine(winston.format.colorize(), logFormat),
});

/**
 * File transport for production
 */
const fileTransport = new winston.transports.File({
  filename: 'logs/error.log',
  level: 'error',
  format: logFormat,
});

const combinedFileTransport = new winston.transports.File({
  filename: 'logs/combined.log',
  format: logFormat,
});

/**
 * Create logger instance
 */
export const logger = winston.createLogger({
  level: config.logging.level,
  format: logFormat,
  transports:
    config.isDevelopment
      ? [consoleTransport]
      : [consoleTransport, fileTransport, combinedFileTransport],
});

/**
 * Stream for Morgan
 */
export const stream = {
  write: (message: string) => {
    logger.info(message.trim());
  },
};
