import { useState } from 'react';
import { Link, Outlet, useParams, useLocation, useNavigate } from 'react-router-dom';
import { useWorkspaces } from '@/api/workspaces';
import { useLogout } from '@/api/auth';
import { useAuthStore } from '@/stores/auth-store';
import { Button } from '@/components/ui/button';
import WorkspaceForm from '@/components/workspace/WorkspaceForm';
import WorkspaceCard from '@/components/workspace/WorkspaceCard';
import { Plus, LogOut, Menu, X, User, LayoutDashboard, Search } from 'lucide-react';
import NotificationBell from '@/components/notification/NotificationBell';
import SearchCommand from '@/components/common/SearchCommand';

export default function AppShell() {
  const { workspaceId } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const { data: workspaces } = useWorkspaces();
  const logoutMutation = useLogout();

  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [formOpen, setFormOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);

  const handleLogout = async () => {
    await logoutMutation.mutateAsync();
    navigate('/login');
  };

  return (
    <div className="flex h-screen bg-background">
      {/* Sidebar */}
      <aside className={`${sidebarOpen ? 'w-60' : 'w-0 -translate-x-full'} border-r bg-card shadow-sm shrink-0 transition-all duration-200 overflow-hidden flex flex-col`}>
        <div className="p-4 border-b">
          <Link to="/" className="text-lg font-bold tracking-tight">
            TaskFlow
          </Link>
        </div>

        <nav className="flex-1 overflow-auto p-2 space-y-1">
          <Link
            to="/"
            className={`flex items-center gap-2 px-3 py-2 rounded-md text-sm transition-colors ${
              location.pathname === '/' ? 'bg-accent text-accent-foreground' : 'hover:bg-accent/50 text-muted-foreground hover:text-foreground'
            }`}
          >
            <LayoutDashboard className="w-4 h-4" />
            Dashboard
          </Link>

          {workspaces?.map((ws) => (
            <WorkspaceCard
              key={ws.id}
              workspace={ws}
              isActive={workspaceId === ws.id}
            />
          ))}
        </nav>

        <div className="p-3 border-t">
          <Button
            variant="outline"
            size="sm"
            className="w-full justify-start"
            onClick={() => setFormOpen(true)}
          >
            <Plus className="w-4 h-4 mr-2" />
            New Workspace
          </Button>
        </div>
      </aside>

      {/* Main area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top bar */}
        <header className="h-12 border-b flex items-center justify-between px-4 bg-card shadow-sm shrink-0">
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="p-1.5 hover:bg-accent rounded-md"
          >
            {sidebarOpen ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
          </button>

          <div className="flex items-center gap-3">
            <button
              onClick={() => setSearchOpen(true)}
              className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-md border border-border bg-muted/30 text-xs text-muted-foreground hover:bg-muted/50 hover:text-foreground transition-colors min-w-[200px]"
            >
              <Search className="w-3.5 h-3.5" />
              Search tasks...
              <kbd className="ml-auto text-[10px] font-mono px-1 rounded bg-muted">⌘K</kbd>
            </button>
            <NotificationBell />
            <span className="text-sm text-muted-foreground">{user?.email}</span>
            <Button variant="ghost" size="icon" onClick={() => navigate('/profile')} title="Profile">
              <User className="w-4 h-4" />
            </Button>
            <Button variant="ghost" size="icon" onClick={handleLogout} title="Sign out">
              <LogOut className="w-4 h-4" />
            </Button>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-auto">
          <Outlet />
        </main>
      </div>

      <WorkspaceForm open={formOpen} onClose={() => setFormOpen(false)} />
      <SearchCommand open={searchOpen} onClose={() => setSearchOpen(false)} />
    </div>
  );
}
