import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import apiClient from '@/lib/api-client';
import { workspaceKeys } from './workspaces';
import { taskKeys } from './tasks';
import { toast } from 'sonner';

export interface Project {
  id: string;
  workspaceId: string;
  name: string;
  description: string | null;
  color: string | null;
  createdAt: string;
  updatedAt: string;
  taskCount: number;
  statusCounts: Record<string, number>;
}

export const projectKeys = {
  all: ['projects'] as const,
  list: (workspaceId: string) => [...projectKeys.all, 'list', workspaceId] as const,
  detail: (id: string) => [...projectKeys.all, 'detail', id] as const,
};

export function useProjects(workspaceId: string) {
  return useQuery({
    queryKey: projectKeys.list(workspaceId),
    queryFn: async () => {
      const { data } = await apiClient.get<{ data: Project[] }>(`/workspaces/${workspaceId}/projects`);
      return data.data;
    },
    enabled: !!workspaceId,
  });
}

export function useCreateProject(workspaceId: string) {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (input: { name: string; description?: string; color?: string }) => {
      const { data } = await apiClient.post<{ data: Project }>(`/workspaces/${workspaceId}/projects`, input);
      return data.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: projectKeys.list(workspaceId) });
      qc.invalidateQueries({ queryKey: workspaceKeys.list() });
      toast.success('Project created');
    },
  });
}

export function useDeleteProject(workspaceId: string) {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      await apiClient.delete(`/projects/${id}`);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: projectKeys.list(workspaceId) });
      qc.invalidateQueries({ queryKey: workspaceKeys.list() });
      toast.success('Project deleted');
    },
  });
}
