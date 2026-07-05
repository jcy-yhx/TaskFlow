import { useState } from 'react';
import { useCreateInvitation, useInvitations, useWorkspace } from '@/api/workspaces';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Mail, X, Copy } from 'lucide-react';
import { toast } from 'sonner';

interface Props {
  workspaceId: string;
  open: boolean;
  onClose: () => void;
}

export default function InviteDialog({ workspaceId, open, onClose }: Props) {
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<'ADMIN' | 'MEMBER'>('MEMBER');
  const invMutation = useCreateInvitation(workspaceId);
  const { data: invitations } = useInvitations(workspaceId);
  const { data: workspace } = useWorkspace(workspaceId);

  if (!open) return null;

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    try {
      await invMutation.mutateAsync({ email: email.trim(), role });
      setEmail('');
      toast.success('Invitation sent');
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: { message?: string } } } })?.response?.data?.error?.message ?? 'Failed to send invitation';
      toast.error(msg);
    }
  };

  const handleCopyCode = () => {
    if (workspace?.joinCode) {
      navigator.clipboard.writeText(workspace.joinCode);
      toast.success('Invite code copied!');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div className="w-full max-w-md rounded-xl border bg-card p-6 shadow-lg" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">Invite Members</h2>
          <button onClick={onClose} className="p-1 hover:bg-muted rounded-md">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* ── Invite code ── */}
        {workspace?.joinCode && (
          <div className="mb-5 p-3 rounded-lg bg-primary/5 border border-primary/20">
            <p className="text-xs text-muted-foreground mb-1.5">Invite Code — share this for instant access</p>
            <div className="flex items-center gap-2">
              <code className="flex-1 rounded bg-white px-2 py-1 text-sm font-mono font-bold tracking-widest select-all border">
                {workspace.joinCode}
              </code>
              <Button size="sm" variant="outline" onClick={handleCopyCode} className="shrink-0 h-8 text-xs">
                <Copy className="w-3 h-3 mr-1" /> Copy
              </Button>
            </div>
          </div>
        )}

        {/* ── Email invite ── */}
        <p className="text-xs text-muted-foreground font-medium mb-2">Or invite by email</p>
        <form onSubmit={handleInvite} className="space-y-3">
          <div>
            <label className="block text-sm font-medium mb-1">Email</label>
            <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="colleague@example.com" />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Role</label>
            <select value={role} onChange={(e) => setRole(e.target.value as 'ADMIN' | 'MEMBER')} className="w-full h-9 rounded-md border border-input bg-transparent px-3 py-1 text-sm">
              <option value="MEMBER">Member</option>
              <option value="ADMIN">Admin</option>
            </select>
          </div>
          <Button type="submit" disabled={invMutation.isPending || !email.trim()} className="w-full">
            <Mail className="w-4 h-4 mr-2" />
            {invMutation.isPending ? 'Sending...' : 'Send Invitation'}
          </Button>
        </form>

        {/* ── Pending ── */}
        {invitations && invitations.length > 0 && (
          <div className="mt-4 pt-4 border-t">
            <h3 className="text-xs font-medium text-muted-foreground mb-2">Pending Invitations</h3>
            <ul className="space-y-1.5">
              {invitations.map((inv) => (
                <li key={inv.id} className="flex items-center justify-between text-sm p-2 rounded-md bg-muted/40">
                  <div>
                    <p className="font-medium text-xs">{inv.email}</p>
                    <p className="text-[11px] text-muted-foreground">{inv.role} · Expires {new Date(inv.expiresAt).toLocaleDateString()}</p>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}
