import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import rateLimit from 'express-rate-limit';
import { config, getLogger } from './config/index.js';
import { errorHandler } from './middleware/error-handler.js';
import authRoutes from './routes/auth.routes.js';
import userRoutes from './routes/user.routes.js';
import workspaceRoutes from './routes/workspace.routes.js';
import projectRoutes from './routes/project.routes.js';
import taskRoutes from './routes/task.routes.js';
import commentRoutes from './routes/comment.routes.js';
import notificationRoutes from './routes/notification.routes.js';
import attachmentRoutes from './routes/attachment.routes.js';

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

  // All other API routes — general rate limit
  app.use(generalLimiter);

  // User routes
  app.use('/api/users', userRoutes);

  // Workspace routes
  app.use('/api/workspaces', workspaceRoutes);

  // Project routes (nested under workspaces + direct access)
  app.use('/api/workspaces/:workspaceId/projects', projectRoutes);
  app.use('/api/projects', projectRoutes);

  // Task routes (nested under projects + direct access)
  app.use('/api/projects/:projectId/tasks', taskRoutes);
  app.use('/api/tasks', taskRoutes);

  // Comment routes
  app.use('/api/tasks/:taskId/comments', commentRoutes);
  app.use('/api/comments', commentRoutes);

  // Notification routes
  app.use('/api/notifications', notificationRoutes);

  // Attachment routes
  app.use('/api/tasks/:taskId/attachments', attachmentRoutes);
  app.use('/api/attachments', attachmentRoutes);

  // Serve uploaded files (avatars + attachments)
  app.use('/uploads', express.static(config.upload.dir));

  // More API routes (to be added in later phases)

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
