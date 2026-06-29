import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import apiClient from '@/lib/api-client';
import { toast } from 'sonner';

export interface Attachment {
  id: string;
  taskId: string;
  userId: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
  storageKey: string;
  createdAt: string;
  user?: { id: string; name: string; email: string };
}

export const attachmentKeys = {
  all: ['attachments'] as const,
  byTask: (taskId: string) => [...attachmentKeys.all, 'task', taskId] as const,
};

export function useAttachments(taskId: string | undefined) {
  return useQuery({
    queryKey: attachmentKeys.byTask(taskId!),
    queryFn: async () => {
      const { data } = await apiClient.get<{ data: Attachment[] }>(`/tasks/${taskId}/attachments`);
      return data.data;
    },
    enabled: !!taskId,
  });
}

export function useUploadFiles(taskId: string) {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (files: FileList | File[]) => {
      const form = new FormData();
      Array.from(files).forEach((f) => form.append('files', f));
      const { data } = await apiClient.post<{ data: Attachment[] }>(`/tasks/${taskId}/attachments`, form, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      return data.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: attachmentKeys.byTask(taskId) });
      toast.success('Files uploaded');
    },
    onError: () => toast.error('Upload failed'),
  });
}

export function useDeleteAttachment(taskId: string) {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      await apiClient.delete(`/attachments/${id}`);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: attachmentKeys.byTask(taskId) });
      toast.success('Attachment deleted');
    },
  });
}

export function getDownloadUrl(id: string): string {
  return `/api/attachments/${id}/download`;
}
