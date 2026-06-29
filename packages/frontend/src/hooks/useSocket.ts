import { useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { getSocket, disconnectSocket } from '@/lib/socket';
import { getAccessToken } from '@/lib/api-client';
import { taskKeys } from '@/api/tasks';
import { useAuthStore } from '@/stores/auth-store';

/**
 * Connect to Socket.IO server, join workspace/project rooms,
 * and wire events to React Query cache invalidation.
 */
export function useSocket(workspaceId: string | undefined, projectId: string | undefined) {
  const qc = useQueryClient();
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const connectedRef = useRef(false);

  useEffect(() => {
    if (!isAuthenticated) return;

    const token = getAccessToken();
    if (!token) return;

    const socket = getSocket();

    if (!socket.connected) {
      socket.auth = { token };
      socket.connect();
    }

    const onConnect = () => {
      if (connectedRef.current) return;
      connectedRef.current = true;

      if (workspaceId) socket.emit('join:workspace', { workspaceId });
      if (projectId) socket.emit('join:project', { projectId });
    };

    const onTaskChanged = () => {
      if (projectId) {
        qc.invalidateQueries({ queryKey: taskKeys.byStatus(projectId) });
      }
    };

    // Task events → invalidate kanban data
    socket.on('connect', onConnect);
    socket.on('task:created', onTaskChanged);
    socket.on('task:updated', onTaskChanged);
    socket.on('task:deleted', onTaskChanged);
    socket.on('task:moved', (data: { projectId: string }) => {
      qc.invalidateQueries({ queryKey: taskKeys.byStatus(data.projectId) });
    });

    // Join rooms immediately if already connected
    if (socket.connected) {
      onConnect();
    }

    return () => {
      socket.off('connect', onConnect);
      socket.off('task:created', onTaskChanged);
      socket.off('task:updated', onTaskChanged);
      socket.off('task:deleted', onTaskChanged);
      socket.off('task:moved');

      // Leave rooms
      if (projectId) socket.emit('leave:project', { projectId });
      if (workspaceId) socket.emit('leave:workspace', { workspaceId });
      connectedRef.current = false;
    };
  }, [workspaceId, projectId, isAuthenticated, qc]);

  // Disconnect on logout
  useEffect(() => {
    if (!isAuthenticated) {
      disconnectSocket();
      connectedRef.current = false;
    }
  }, [isAuthenticated]);
}
