import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import apiClient from '@/lib/api-client';
import { toast } from 'sonner';

export interface TaskUser {
  id: string; name: string; email: string; avatarUrl: string | null;
}

export interface Task {
  id: string;
  projectId: string;
  title: string;
  description: string | null;
  status: 'BACKLOG' | 'TODO' | 'IN_PROGRESS' | 'IN_REVIEW' | 'DONE';
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
  position: number;
  dueDate: string | null;
  creatorId: string;
  createdAt: string;
  updatedAt: string;
  assignees: TaskUser[];
  creator: TaskUser;
  commentCount: number;
  attachmentCount: number;
}

export type TaskStatus = Task['status'];
export type TaskPriority = Task['priority'];

export const taskKeys = {
  all: ['tasks'] as const,
  byProject: (projectId: string) => [...taskKeys.all, 'project', projectId] as const,
  byStatus: (projectId: string) => [...taskKeys.all, 'byStatus', projectId] as const,
  detail: (id: string) => [...taskKeys.all, 'detail', id] as const,
};

// ── Grouped by status (Kanban) ──
export function useTasksByStatus(projectId: string | undefined) {
  return useQuery({
    queryKey: taskKeys.byStatus(projectId!),
    queryFn: async () => {
      const { data } = await apiClient.get<{ data: Record<TaskStatus, Task[]> }>(`/projects/${projectId}/tasks/by-status`);
      return data.data;
    },
    enabled: !!projectId,
  });
}

// ── Single task ──
export function useTask(id: string | undefined) {
  return useQuery({
    queryKey: taskKeys.detail(id!),
    queryFn: async () => {
      const { data } = await apiClient.get<{ data: Task }>(`/tasks/${id}`);
      return data.data;
    },
    enabled: !!id,
  });
}

// ── Create ──
export function useCreateTask(projectId: string) {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (input: { title: string; description?: string; status?: TaskStatus; priority?: TaskPriority }) => {
      const { data } = await apiClient.post<{ data: Task }>(`/projects/${projectId}/tasks`, input);
      return data.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: taskKeys.byStatus(projectId) });
    },
  });
}

// ── Update ──
export function useUpdateTask(projectId: string) {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...input }: { id: string; title?: string; description?: string; priority?: TaskPriority; dueDate?: string | null }) => {
      const { data } = await apiClient.patch<{ data: Task }>(`/tasks/${id}`, input);
      return data.data;
    },
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: taskKeys.byStatus(projectId) });
      qc.invalidateQueries({ queryKey: taskKeys.detail(vars.id) });
    },
  });
}

// ── Move (status + position) with optimistic update ──
export function useMoveTask(projectId: string) {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, status, position }: { id: string; status: TaskStatus; position: number }) => {
      const { data } = await apiClient.patch<{ data: Task }>(`/tasks/${id}/status`, { status, position });
      return data.data;
    },
    onMutate: async ({ id, status, position }) => {
      await qc.cancelQueries({ queryKey: taskKeys.byStatus(projectId) });
      const previous = qc.getQueryData<Record<TaskStatus, Task[]>>(taskKeys.byStatus(projectId));

      if (previous) {
        const updated = { ...previous };
        for (const col of Object.keys(updated) as TaskStatus[]) {
          updated[col] = [...updated[col]];
        }

        // Find and remove from old column
        let movedTask: Task | undefined;
        for (const col of Object.keys(updated) as TaskStatus[]) {
          const idx = updated[col].findIndex((t) => t.id === id);
          if (idx !== -1) {
            movedTask = { ...updated[col][idx], status, position };
            updated[col].splice(idx, 1);
            break;
          }
        }

        // Insert into new column at correct position
        if (movedTask) {
          updated[status].push(movedTask);
          updated[status].sort((a, b) => a.position - b.position);
          // Re-assign positions
          updated[status] = updated[status].map((t, i) => ({ ...t, position: i }));
        }

        qc.setQueryData(taskKeys.byStatus(projectId), updated);
      }

      return { previous };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) {
        qc.setQueryData(taskKeys.byStatus(projectId), context.previous);
      }
      toast.error('Failed to move task');
    },
    onSettled: (_data, _err, vars) => {
      qc.invalidateQueries({ queryKey: taskKeys.byStatus(projectId) });
      qc.invalidateQueries({ queryKey: taskKeys.detail(vars.id) });
    },
  });
}

// ── Delete ──
export function useDeleteTask(projectId: string) {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      await apiClient.delete(`/tasks/${id}`);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: taskKeys.byStatus(projectId) });
      toast.success('Task deleted');
    },
  });
}

// ── Assign / Unassign ──
export function useAssignTask(projectId: string) {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async ({ taskId, userId }: { taskId: string; userId: string }) => {
      const { data } = await apiClient.post<{ data: Task }>(`/tasks/${taskId}/assignees`, { userId });
      return data.data;
    },
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: taskKeys.byStatus(projectId) });
      qc.invalidateQueries({ queryKey: taskKeys.detail(vars.taskId) });
    },
  });
}

export function useUnassignTask(projectId: string) {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async ({ taskId, userId }: { taskId: string; userId: string }) => {
      const { data } = await apiClient.delete<{ data: Task }>(`/tasks/${taskId}/assignees/${userId}`);
      return data.data;
    },
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: taskKeys.byStatus(projectId) });
      qc.invalidateQueries({ queryKey: taskKeys.detail(vars.taskId) });
    },
  });
}
