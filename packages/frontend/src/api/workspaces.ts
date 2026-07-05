import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import apiClient from '@/lib/api-client';
import { toast } from 'sonner';

// ── Types ──

export interface WorkspaceMember {
  id: string;
  userId: string;
  workspaceId: string;
  role: 'OWNER' | 'ADMIN' | 'MEMBER';
  joinedAt: string;
  user: {
    id: string;
    name: string;
    email: string;
    avatarUrl: string | null;
  };
}

export interface Workspace {
  id: string;
  name: string;
  slug: string;
  joinCode: string;
  description: string | null;
  createdAt: string;
  updatedAt: string;
  role: 'OWNER' | 'ADMIN' | 'MEMBER';
  projectCount?: number;
  memberCount?: number;
}

export interface Invitation {
  id: string;
  workspaceId: string;
  email: string;
  token: string;
  role: 'ADMIN' | 'MEMBER';
  acceptedAt: string | null;
  expiresAt: string;
  createdAt: string;
  inviter: { id: string; name: string; email: string };
}

// ── Query keys ──

export const workspaceKeys = {
  all: ['workspaces'] as const,
  list: () => [...workspaceKeys.all, 'list'] as const,
  detail: (id: string) => [...workspaceKeys.all, 'detail', id] as const,
  members: (id: string) => [...workspaceKeys.all, 'members', id] as const,
  invitations: (id: string) => [...workspaceKeys.all, 'invitations', id] as const,
};

// ── List user's workspaces ──

export function useWorkspaces() {
  return useQuery({
    queryKey: workspaceKeys.list(),
    queryFn: async () => {
      const { data } = await apiClient.get<{ data: Workspace[] }>('/workspaces');
      return data.data;
    },
  });
}

// ── Single workspace ──

export function useWorkspace(id: string) {
  return useQuery({
    queryKey: workspaceKeys.detail(id),
    queryFn: async () => {
      const { data } = await apiClient.get<{ data: Workspace & { _count?: Record<string, number> } }>(`/workspaces/${id}`);
      return data.data;
    },
    enabled: !!id,
  });
}

// ── Create workspace ──

export function useCreateWorkspace() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (input: { name: string; description?: string }) => {
      const { data } = await apiClient.post<{ data: Workspace }>('/workspaces', input);
      return data.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: workspaceKeys.list() });
    },
  });
}

// ── Delete workspace ──

export function useDeleteWorkspace() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      await apiClient.delete(`/workspaces/${id}`);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: workspaceKeys.list() });
    },
  });
}

// ── Members ──

export function useMembers(workspaceId: string) {
  return useQuery({
    queryKey: workspaceKeys.members(workspaceId),
    queryFn: async () => {
      const { data } = await apiClient.get<{ data: WorkspaceMember[] }>(`/workspaces/${workspaceId}/members`);
      return data.data;
    },
    enabled: !!workspaceId,
  });
}

export function useUpdateMemberRole(workspaceId: string) {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async ({ userId, role }: { userId: string; role: 'ADMIN' | 'MEMBER' }) => {
      const { data } = await apiClient.patch<{ data: WorkspaceMember }>(`/workspaces/${workspaceId}/members/${userId}`, { role });
      return data.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: workspaceKeys.members(workspaceId) });
    },
  });
}

export function useRemoveMember(workspaceId: string) {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (userId: string) => {
      await apiClient.delete(`/workspaces/${workspaceId}/members/${userId}`);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: workspaceKeys.members(workspaceId) });
      toast.success('Member removed');
    },
  });
}

// ── Invitations ──

export function useInvitations(workspaceId: string) {
  return useQuery({
    queryKey: workspaceKeys.invitations(workspaceId),
    queryFn: async () => {
      const { data } = await apiClient.get<{ data: Invitation[] }>(`/workspaces/${workspaceId}/invitations`);
      return data.data;
    },
    enabled: !!workspaceId,
  });
}

export function useCreateInvitation(workspaceId: string) {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (input: { email: string; role: 'ADMIN' | 'MEMBER' }) => {
      const { data } = await apiClient.post<{ data: Invitation }>(`/workspaces/${workspaceId}/invitations`, input);
      return data.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: workspaceKeys.invitations(workspaceId) });
      toast.success('Invitation sent!');
    },
  });
}
