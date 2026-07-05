import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useWorkspaces, useDeleteWorkspace } from '@/api/workspaces';
import { useAuthStore } from '@/stores/auth-store';
import WorkspaceForm from '@/components/workspace/WorkspaceForm';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Plus, Users, FolderKanban, Trash2, LogIn } from 'lucide-react';
import apiClient from '@/lib/api-client';
import { toast } from 'sonner';

export default function DashboardPage() {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const { data: workspaces, isLoading, refetch } = useWorkspaces();
  const deleteMut = useDeleteWorkspace();
  const [formOpen, setFormOpen] = useState(false);
  const [joinOpen, setJoinOpen] = useState(false);
  const [joinCode, setJoinCode] = useState('');
  const [joining, setJoining] = useState(false);

  const handleJoin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!joinCode.trim()) return;
    setJoining(true);
    try {
      const { data } = await apiClient.post<{ data: { id: string; name: string } }>('/workspaces/join', { joinCode: joinCode.trim() });
      toast.success(`Joined ${data.data.name}!`);
      setJoinOpen(false);
      setJoinCode('');
      refetch();
      navigate(`/workspaces/${data.data.id}`);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: { message?: string } } } })?.response?.data?.error?.message ?? 'Failed to join workspace';
      toast.error(msg);
    } finally { setJoining(false); }
  };

  return (
    <div className="max-w-3xl mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Welcome, {user?.name ?? 'there'}!</h1>
          <p className="text-muted-foreground mt-1">Your workspaces</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => setJoinOpen(true)}>
            <LogIn className="w-4 h-4 mr-1.5" />
            Join Workspace
          </Button>
          <Button size="sm" onClick={() => setFormOpen(true)}>
            <Plus className="w-4 h-4 mr-1.5" />
            New Workspace
          </Button>
        </div>
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading...</p>
      ) : workspaces && workspaces.length > 0 ? (
        <div className="grid gap-4">
          {workspaces.map((ws) => (
            <div key={ws.id} className="flex items-center justify-between p-4 rounded-lg border bg-card hover:shadow-sm transition-shadow cursor-pointer" onClick={() => navigate(`/workspaces/${ws.id}`)}>
              <div className="flex items-center gap-3">
                <div className="w-3 h-3 rounded-full bg-primary" />
                <div>
                  <h3 className="font-semibold">{ws.name}</h3>
                  <p className="text-xs text-muted-foreground mt-0.5">{ws.role} · {ws.slug}</p>
                </div>
              </div>
              <div className="flex items-center gap-4 text-sm text-muted-foreground">
                <span className="flex items-center gap-1"><FolderKanban className="w-3.5 h-3.5" /> {ws.projectCount ?? 0}</span>
                <span className="flex items-center gap-1"><Users className="w-3.5 h-3.5" /> {ws.memberCount ?? 0}</span>
                {ws.role === 'OWNER' && (
                  <button onClick={(e) => { e.stopPropagation(); if (!confirm(`Delete "${ws.name}" and all its data?`)) return; deleteMut.mutate(ws.id, { onSuccess: () => toast.success('Workspace deleted') }); }} className="p-1.5 hover:bg-destructive/10 rounded text-destructive" title="Delete workspace">
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-12">
          <p className="text-muted-foreground mb-4">No workspaces yet. Create one or join with an invite code!</p>
        </div>
      )}

      <WorkspaceForm open={formOpen} onClose={() => setFormOpen(false)} />

      {/* Join Workspace dialog */}
      {joinOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setJoinOpen(false)}>
          <div className="w-full max-w-sm rounded-xl border bg-card p-6 shadow-lg" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-lg font-semibold mb-1">Join a Workspace</h2>
            <p className="text-sm text-muted-foreground mb-4">Enter the invite code shared by your team.</p>
            <form onSubmit={handleJoin} className="space-y-3">
              <Input
                value={joinCode}
                onChange={(e) => setJoinCode(e.target.value)}
                placeholder="e.g. X7K9P2AB"
                className="text-lg font-mono tracking-widest text-center"
                autoFocus
              />
              <Button type="submit" className="w-full" disabled={joining || !joinCode.trim()}>
                {joining ? 'Joining...' : 'Join Workspace'}
              </Button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
