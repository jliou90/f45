// ============================================================================
// CORS CONFIGURATION
// ============================================================================

import { CorsOptions } from 'cors';
import { config } from './app.config';

/**
 * CORS configuration
 */
export const corsConfig: CorsOptions = {
  origin: (origin, callback) => {
    // Allow requests with no origin (mobile apps, Postman, etc.)
    if (!origin) {
      return callback(null, true);
    }

    // In development, allow all origins
    if (config.isDevelopment) {
      return callback(null, true);
    }

    // In production, check against whitelist
    const allowedOrigins = config.cors.origin.split(',');
    
    if (allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  exposedHeaders: ['Content-Range', 'X-Content-Range'],
  maxAge: 600, // 10 minutes
};
