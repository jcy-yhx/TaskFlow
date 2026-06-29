import { createServer } from 'node:http';
import { createApp } from './app.js';
import { config, getPrisma, getLogger, setIO } from './config/index.js';
import { createSocketServer } from './websocket/index.js';

const logger = getLogger();

async function main() {
  // Verify database connection
  try {
    const prisma = getPrisma();
    await prisma.$connect();
    logger.info('Database connected');
  } catch (err) {
    logger.error(err, 'Failed to connect to database');
    process.exit(1);
  }

  const app = createApp();

  // Create HTTP server and attach Socket.IO
  const httpServer = createServer(app);
  const io = createSocketServer(httpServer, config.frontendUrl);
  setIO(io);

  httpServer.listen(config.port, () => {
    logger.info(`Server running on http://localhost:${config.port}`);
    logger.info(`WebSocket ready on ws://localhost:${config.port}`);
    logger.info(`Environment: ${config.nodeEnv}`);
  });
}

main().catch((err) => {
  logger.error(err, 'Failed to start server');
  process.exit(1);
});
