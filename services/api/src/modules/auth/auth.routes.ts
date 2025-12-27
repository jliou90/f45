// ============================================================================
// AUTH ROUTES
// ============================================================================

import { Router } from 'express';
import { authController } from './controllers/auth.controller';
// TODO: Import auth middleware when created
// import { authenticate } from '@/middleware/auth/authenticate.middleware';

const router = Router();

/**
 * Public routes
 */
router.post('/login', authController.login);
router.post('/register', authController.register);
router.post('/refresh', authController.refresh);

/**
 * Protected routes
 */
// router.get('/me', authenticate, authController.me);
// router.post('/logout', authenticate, authController.logout);
// router.post('/change-password', authenticate, authController.changePassword);

// TODO: Add when auth middleware is ready
router.get('/me', authController.me);
router.post('/logout', authController.logout);
router.post('/change-password', authController.changePassword);

export const authRoutes = router;
