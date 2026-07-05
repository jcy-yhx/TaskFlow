import { useParams } from 'react-router-dom';
import { useWorkspace } from '@/api/workspaces';
import { useForm } from 'react-hook-form';
import { updateWorkspaceSchema, type UpdateWorkspaceInput } from '@taskflow/shared';
import { zodResolver } from '@hookform/resolvers/zod';
import apiClient from '@/lib/api-client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { Copy, RefreshCw } from 'lucide-react';
import { useState } from 'react';

export default function WorkspaceSettingsPage() {
  const { workspaceId } = useParams<{ workspaceId: string }>();
  const { data: workspace, isLoading, refetch } = useWorkspace(workspaceId!);
  const [resetting, setResetting] = useState(false);

  const { register, handleSubmit, formState: { isSubmitting } } = useForm<UpdateWorkspaceInput>({
    resolver: zodResolver(updateWorkspaceSchema),
    values: workspace ? { name: workspace.name, description: workspace.description ?? '' } : undefined,
  });

  if (isLoading) return <div className="p-6 text-sm text-muted-foreground">Loading...</div>;
  if (!workspace) return <div className="p-6 text-sm text-destructive">Workspace not found.</div>;

  const isAdmin = workspace.role === 'OWNER' || workspace.role === 'ADMIN';

  const onSubmit = async (data: UpdateWorkspaceInput) => {
    try {
      await apiClient.patch(`/workspaces/${workspaceId}`, data);
      toast.success('Workspace updated');
    } catch { toast.error('Failed to update workspace'); }
  };

  const handleResetCode = async () => {
    if (!confirm('Reset the invite code? The old code will stop working.')) return;
    setResetting(true);
    try {
      await apiClient.post(`/workspaces/${workspaceId}/reset-join-code`);
      refetch();
      toast.success('Invite code reset');
    } catch { toast.error('Failed to reset invite code'); }
    finally { setResetting(false); }
  };

  const handleCopyCode = () => {
    navigator.clipboard.writeText(workspace.joinCode);
    toast.success('Invite code copied!');
  };

  return (
    <div className="max-w-lg mx-auto p-6 space-y-6">
      <h2 className="text-lg font-semibold">Workspace Settings</h2>

      {/* ── Invite code ── */}
      <div className="rounded-xl border bg-card p-4 space-y-3">
        <div>
          <h3 className="text-sm font-medium">Invite Code</h3>
          <p className="text-xs text-muted-foreground">Share this code — anyone can use it to join this workspace.</p>
        </div>
        <div className="flex items-center gap-2">
          <code className="flex-1 rounded-md bg-muted px-3 py-2 text-lg font-mono font-bold tracking-widest select-all">
            {workspace.joinCode}
          </code>
          <Button size="sm" variant="outline" onClick={handleCopyCode}>
            <Copy className="w-3.5 h-3.5 mr-1" /> Copy
          </Button>
        </div>
        {isAdmin && (
          <Button size="sm" variant="ghost" onClick={handleResetCode} disabled={resetting} className="text-xs">
            <RefreshCw className="w-3 h-3 mr-1" />
            {resetting ? 'Resetting...' : 'Reset Code'}
          </Button>
        )}
      </div>

      {/* ── General settings ── */}
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-1">Name</label>
          <Input {...register('name')} />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Description</label>
          <Input {...register('description')} placeholder="Optional description" />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1 text-muted-foreground">Slug</label>
          <p className="text-sm">{workspace.slug}</p>
        </div>
        <Button type="submit" disabled={isSubmitting || !isAdmin}>
          {isSubmitting ? 'Saving...' : 'Save Changes'}
        </Button>
      </form>
    </div>
  );
}
