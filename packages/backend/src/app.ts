import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import rateLimit from 'express-rate-limit';
import { config, getLogger } from './config/index.js';
import { errorHandler } from './middleware/error-handler.js';
import authRoutes from './routes/auth.routes.js';
import userRoutes from './routes/user.routes.js';

const logger = getLogger();

export function createApp() {
  const app = express();

  // Security headers
  app.use(helmet());

  // CORS — must allow credentials for cookies
  app.use(
    cors({
      origin: config.frontendUrl,
      credentials: true,
    }),
  );

  // Body parsing
  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ extended: true }));

  // Cookie parsing (refresh token)
  app.use(cookieParser());

  // Request logging
  app.use((req, _res, next) => {
    logger.info({ method: req.method, url: req.url }, 'incoming request');
    next();
  });

  // Rate limiting — tighter limits on auth endpoints
  const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 20,
    standardHeaders: true,
    legacyHeaders: false,
    message: {
      error: { code: 'RATE_LIMITED', message: 'Too many attempts, try again later' },
    },
  });

  const generalLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100,
    standardHeaders: true,
    legacyHeaders: false,
  });

  // Health check (no rate limit)
  app.get('/health', (_req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  // Auth routes — tighter rate limit
  app.use('/api/auth', authLimiter, authRoutes);

  // User routes
  app.use('/api/users', userRoutes);

  // Other API routes (to be added in later phases)
  app.use(generalLimiter);

  // 404 handler
  app.use((_req, res) => {
    res.status(404).json({
      error: { code: 'NOT_FOUND', message: 'Route not found' },
    });
  });

  // Error handler (must be last)
  app.use(errorHandler);

  return app;
}
