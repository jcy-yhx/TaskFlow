import { useParams } from 'react-router-dom';
import { useTasksByStatus, type TaskStatus } from '@/api/tasks';

const STATUS_LABELS: Record<TaskStatus, string> = {
  BACKLOG: 'Backlog', TODO: 'To Do', IN_PROGRESS: 'In Progress',
  IN_REVIEW: 'In Review', DONE: 'Done',
};

export default function ProjectListPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const { data: tasks, isLoading } = useTasksByStatus(projectId);

  if (isLoading) return <div className="p-6 text-sm text-muted-foreground">Loading...</div>;

  const allTasks = tasks ? Object.values(tasks).flat().sort((a, b) => a.position - b.position) : [];

  return (
    <div className="p-6">
      <div className="rounded-lg border">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/30">
              <th className="text-left px-4 py-2 font-medium">Task</th>
              <th className="text-left px-4 py-2 font-medium">Status</th>
              <th className="text-left px-4 py-2 font-medium">Priority</th>
              <th className="text-left px-4 py-2 font-medium">Assignees</th>
            </tr>
          </thead>
          <tbody>
            {allTasks.map((task) => (
              <tr key={task.id} className="border-b hover:bg-muted/20">
                <td className="px-4 py-2 font-medium">{task.title}</td>
                <td className="px-4 py-2">
                  <span className="text-xs px-1.5 py-0.5 rounded-full bg-muted">
                    {STATUS_LABELS[task.status]}
                  </span>
                </td>
                <td className="px-4 py-2 text-muted-foreground">{task.priority}</td>
                <td className="px-4 py-2 text-muted-foreground">
                  {task.assignees.map((a) => a.name).join(', ') || '-'}
                </td>
              </tr>
            ))}
            {allTasks.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-muted-foreground">
                  No tasks yet. Switch to Board view to create some.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
