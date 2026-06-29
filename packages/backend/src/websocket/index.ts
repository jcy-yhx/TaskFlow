import { Server as SocketIOServer } from 'socket.io';
import type { Server as HttpServer } from 'node:http';
import { verifyAccessToken } from '../utils/jwt.js';
import { getLogger } from '../config/index.js';

const logger = getLogger();
const ONLINE_USERS = new Map<string, Set<string>>(); // socketId → Set<room>

export function createSocketServer(httpServer: HttpServer, corsOrigin: string): SocketIOServer {
  const io = new SocketIOServer(httpServer, {
    cors: { origin: corsOrigin, credentials: true },
    pingTimeout: 60_000,
    pingInterval: 25_000,
  });

  // ── Authentication middleware ──
  io.use((socket, next) => {
    const token = socket.handshake.auth?.token as string | undefined;
    if (!token) {
      return next(new Error('Authentication required'));
    }
    try {
      const payload = verifyAccessToken(token);
      socket.data.userId = payload.sub;
      socket.data.email = payload.email;
      next();
    } catch {
      next(new Error('Invalid or expired access token'));
    }
  });

  io.on('connection', (socket) => {
    const userId = socket.data.userId as string;
    logger.info({ userId, socketId: socket.id }, 'Socket connected');
    ONLINE_USERS.set(socket.id, new Set());

    // ── Room join/leave ──
    socket.on('join:workspace', ({ workspaceId }: { workspaceId: string }) => {
      const room = `workspace:${workspaceId}`;
      socket.join(room);
      ONLINE_USERS.get(socket.id)?.add(room);
      broadcastPresence(io, workspaceId);
    });

    socket.on('leave:workspace', ({ workspaceId }: { workspaceId: string }) => {
      const room = `workspace:${workspaceId}`;
      socket.leave(room);
      ONLINE_USERS.get(socket.id)?.delete(room);
      broadcastPresence(io, workspaceId);
    });

    socket.on('join:project', ({ projectId }: { projectId: string }) => {
      const room = `project:${projectId}`;
      socket.join(room);
      ONLINE_USERS.get(socket.id)?.add(room);
    });

    socket.on('leave:project', ({ projectId }: { projectId: string }) => {
      const room = `project:${projectId}`;
      socket.leave(room);
      ONLINE_USERS.get(socket.id)?.delete(room);
    });

    // ── Disconnect ──
    socket.on('disconnect', () => {
      const rooms = ONLINE_USERS.get(socket.id);
      if (rooms) {
        for (const room of rooms) {
          if (room.startsWith('workspace:')) {
            const wsId = room.slice('workspace:'.length);
            // Defer presence broadcast to next tick so room membership is updated
            setImmediate(() => broadcastPresence(io, wsId));
          }
        }
      }
      ONLINE_USERS.delete(socket.id);
      logger.info({ userId, socketId: socket.id }, 'Socket disconnected');
    });
  });

  return io;
}

// ── Helpers ──

function broadcastPresence(io: SocketIOServer, workspaceId: string) {
  const room = `workspace:${workspaceId}`;
  const sockets = io.sockets.adapter.rooms.get(room);
  const online = sockets ? Array.from(sockets).map((sid) => {
    const s = io.sockets.sockets.get(sid);
    return { userId: s?.data.userId as string, email: s?.data.email as string };
  }) : [];
  io.to(room).emit('presence:users', { workspaceId, online });
}
