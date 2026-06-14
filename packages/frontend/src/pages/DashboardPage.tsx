import { useAuthStore } from '@/stores/auth-store';
import { useLogout } from '@/api/auth';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

export default function DashboardPage() {
  const { user } = useAuthStore();
  const logoutMutation = useLogout();

  const handleLogout = async () => {
    await logoutMutation.mutateAsync();
    toast.success('Logged out');
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background p-4">
      <div className="text-center space-y-4">
        <h1 className="text-3xl font-bold tracking-tight">
          Welcome, {user?.name ?? 'there'}!
        </h1>
        <p className="text-muted-foreground">
          You&apos;re signed in as <span className="font-medium text-foreground">{user?.email}</span>.
        </p>
        <p className="text-sm text-muted-foreground max-w-md">
          Phase 1 is complete. Workspaces and projects are coming in Phase 2 and 3.
        </p>
        <Button variant="outline" onClick={handleLogout} disabled={logoutMutation.isPending}>
          {logoutMutation.isPending ? 'Signing out...' : 'Sign out'}
        </Button>
      </div>
    </div>
  );
}
