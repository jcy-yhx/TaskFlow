import { io, Socket } from 'socket.io-client';
import { getAccessToken } from './api-client';

let socket: Socket | null = null;

/**
 * Returns a singleton Socket.IO client, authenticated with the current access token.
 * Automatically reconnects on token refresh (reads latest from memory).
 */
export function getSocket(): Socket {
  if (!socket) {
    socket = io('/', {
      transports: ['websocket', 'polling'], // websocket first, polling fallback
      autoConnect: false,
      auth: (cb: (data: { token: string }) => void) => {
        cb({ token: getAccessToken() ?? '' });
      },
    });
  }
  return socket;
}

export function disconnectSocket() {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}
