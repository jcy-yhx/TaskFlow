import { useState } from 'react';
import { useParams, Link, Outlet, useLocation } from 'react-router-dom';
import { useWorkspace } from '@/api/workspaces';
import { useProjects, useDeleteProject } from '@/api/projects';
import { cn } from '@/lib/utils';
import { Users, Settings, Plus, Trash2 } from 'lucide-react';
import ProjectForm from '@/components/project/ProjectForm';

export default function WorkspacePage() {
  const { workspaceId } = useParams<{ workspaceId: string }>();
  const location = useLocation();
  const { data: workspace, isLoading } = useWorkspace(workspaceId!);
  const { data: projects } = useProjects(workspaceId!);
  const deleteProjectMut = useDeleteProject(workspaceId!);
  const [projectFormOpen, setProjectFormOpen] = useState(false);

  if (isLoading) return <div className="p-6 text-sm text-muted-foreground">Loading...</div>;
  if (!workspace) return <div className="p-6 text-sm text-destructive">Workspace not found.</div>;

  const isProjectActive = (projectId: string) => location.pathname.includes(`/projects/${projectId}`);

  const tabs = [
    { label: 'Members', href: `/workspaces/${workspaceId}/members`, icon: Users },
    { label: 'Settings', href: `/workspaces/${workspaceId}/settings`, icon: Settings },
  ];

  return (
    <div className="flex h-full">
      {/* Project sidebar */}
      <aside className="w-56 border-r bg-card shrink-0 flex flex-col">
        <div className="p-3 border-b flex items-center justify-between">
          <h2 className="text-sm font-semibold truncate">{workspace.name}</h2>
        </div>
        <nav className="flex-1 overflow-auto p-2 space-y-0.5">
          <p className="px-2 py-1 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
            Projects
          </p>
          {projects?.map((p) => (
            <div key={p.id} className="group flex items-center">
              <Link
                to={`/workspaces/${workspaceId}/projects/${p.id}`}
                className={cn(
                  'flex-1 flex items-center gap-2 px-2 py-1.5 rounded-md text-sm transition-colors',
                  isProjectActive(p.id)
                    ? 'bg-accent text-accent-foreground font-medium'
                    : 'text-muted-foreground hover:text-foreground hover:bg-accent/50',
                )}
              >
                <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: p.color ?? '#888' }} />
                <span className="truncate">{p.name}</span>
              </Link>
              {workspace.role !== 'MEMBER' && (
                <button
                  onClick={(e) => {
                    e.preventDefault();
                    if (!confirm(`Delete "${p.name}"?`)) return;
                    deleteProjectMut.mutate(p.id);
                  }}
                  className="p-0.5 hover:bg-destructive/10 rounded text-muted-foreground/40 hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              )}
            </div>
          ))}
          {workspace.role !== 'MEMBER' && (
            <button
              onClick={() => setProjectFormOpen(true)}
              className="w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-sm text-muted-foreground hover:text-foreground hover:bg-accent/50 transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              New Project
            </button>
          )}
        </nav>
        <div className="p-2 border-t space-y-0.5">
          {tabs.map((tab) => (
            <Link
              key={tab.href}
              to={tab.href}
              className={cn(
                'flex items-center gap-2 px-2 py-1.5 rounded-md text-sm transition-colors',
                location.pathname.startsWith(tab.href)
                  ? 'bg-accent text-accent-foreground font-medium'
                  : 'text-muted-foreground hover:text-foreground hover:bg-accent/50',
              )}
            >
              <tab.icon className="w-3.5 h-3.5" />
              {tab.label}
            </Link>
          ))}
        </div>
      </aside>

      {/* Main content */}
      <div className="flex-1 overflow-auto">
        <Outlet />
      </div>

      <ProjectForm workspaceId={workspaceId!} open={projectFormOpen} onClose={() => setProjectFormOpen(false)} />
    </div>
  );
}
