import { useState } from 'react';
import { useCreateInvitation, useInvitations } from '@/api/workspaces';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Copy, Mail, X } from 'lucide-react';
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
  const [lastLink, setLastLink] = useState<string | null>(null);

  if (!open) return null;

  const inviteLink = (token: string) => `${window.location.origin}/invitations/${token}`;

  const handleCopyLink = (token: string) => {
    navigator.clipboard.writeText(inviteLink(token));
    toast.success('Link copied!');
  };

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;

    try {
      const inv = await invMutation.mutateAsync({ email: email.trim(), role });
      setEmail('');
      setLastLink(inviteLink(inv.token));
      toast.success('Invitation sent');
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: { message?: string } } } })?.response?.data?.error?.message ?? 'Failed to send invitation';
      toast.error(msg);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div className="w-full max-w-md rounded-xl border bg-card p-6 shadow-lg max-h-[85vh] overflow-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">Invite Members</h2>
          <button onClick={onClose} className="p-1 hover:bg-muted rounded-md">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* ── Send via email ── */}
        <form onSubmit={handleInvite} className="space-y-3 pb-5 mb-5 border-b">
          <p className="text-xs text-muted-foreground font-medium">Send via email</p>
          <div>
            <label className="block text-sm font-medium mb-1">Email</label>
            <Input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="colleague@example.com"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Role</label>
            <select
              value={role}
              onChange={(e) => setRole(e.target.value as 'ADMIN' | 'MEMBER')}
              className="w-full h-9 rounded-md border border-input bg-transparent px-3 py-1 text-sm"
            >
              <option value="MEMBER">Member</option>
              <option value="ADMIN">Admin</option>
            </select>
          </div>
          <Button type="submit" disabled={invMutation.isPending || !email.trim()} className="w-full">
            <Mail className="w-4 h-4 mr-2" />
            {invMutation.isPending ? 'Sending...' : 'Send Invitation'}
          </Button>
        </form>

        {/* ── Pending invitations ── */}
        {invitations && invitations.length > 0 && (
          <div>
            <p className="text-xs text-muted-foreground font-medium mb-2">
              Share these links — anyone with the link can join
            </p>
            <ul className="space-y-2">
              {invitations.map((inv) => (
                <li
                  key={inv.id}
                  className={`flex items-center justify-between text-sm p-2.5 rounded-lg border transition-colors ${
                    inviteLink(inv.token) === lastLink
                      ? 'bg-primary/5 border-primary/30'
                      : 'bg-muted/40 border-transparent'
                  }`}
                >
                  <div>
                    <p className="font-medium text-xs">{inv.email}</p>
                    <p className="text-[11px] text-muted-foreground">
                      {inv.role} · Expires{' '}
                      {new Date(inv.expiresAt).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                      })}
                    </p>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleCopyLink(inv.token)}
                    className="h-7 text-xs shrink-0"
                  >
                    <Copy className="w-3 h-3 mr-1" />
                    Copy link
                  </Button>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}
