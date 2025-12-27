// ============================================================================
// APP - Express Application Setup
// ============================================================================

import express, { Application } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import { corsConfig } from './config/cors.config';
import { logger } from './core/logging/logger';
import { errorMiddleware } from './middleware/error/error.middleware';
import { notFoundMiddleware } from './middleware/error/notFound.middleware';

// TODO: Import routes
// import { routes } from './routes';

/**
 * Create Express application
 */
export const app: Application = express();

// ============================================================================
// MIDDLEWARE
// ============================================================================

// Security
app.use(helmet());

// CORS
app.use(cors(corsConfig));

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Logging
if (process.env.NODE_ENV === 'development') {
  app.use(morgan('dev'));
} else {
  app.use(
    morgan('combined', {
      stream: {
        write: (message) => logger.info(message.trim()),
      },
    })
  );
}

// ============================================================================
// ROUTES
// ============================================================================

// Health check
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV,
  });
});

// API routes
// app.use('/api/v1', routes);

// ============================================================================
// ERROR HANDLING
// ============================================================================

// 404 handler
app.use(notFoundMiddleware);

// Global error handler
app.use(errorMiddleware);

// ============================================================================

export default app;
