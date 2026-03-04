// ============================================================================
// SERVER - Main Entry Point
// ============================================================================

import dotenv from 'dotenv';
import { app } from './app';
import { logger } from './core/logging/logger';
import { config } from './config/app.config';

// Load environment variables
dotenv.config();

const PORT = config.port;

/**
 * Start server
 */
async function start() {
  try {
    // TODO: Initialize database connection
    // await initializeDatabase();
    
    // Start listening
    app.listen(PORT, () => {
      logger.info(`🚀 Server running on port ${PORT}`);
      logger.info(`📝 Environment: ${config.env}`);
      logger.info(`🔗 API URL: ${config.apiUrl}`);
    });
  } catch (error) {
    logger.error('❌ Failed to start server:', error);
    process.exit(1);
  }
}

/**
 * Graceful shutdown
 */
process.on('SIGTERM', () => {
  logger.info('SIGTERM received, shutting down gracefully');
  process.exit(0);
});

process.on('SIGINT', () => {
  logger.info('SIGINT received, shutting down gracefully');
  process.exit(0);
});

/**
 * Unhandled errors
 */
process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception:', error);
  process.exit(1);
});

// Start the server
start();
