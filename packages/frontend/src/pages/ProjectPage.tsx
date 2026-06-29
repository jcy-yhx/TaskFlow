import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { useTasksByStatus, type TaskStatus } from '@/api/tasks';
import { useWorkspace } from '@/api/workspaces';
import KanbanBoard from '@/components/task/KanbanBoard';
import TaskForm from '@/components/task/TaskForm';
import TaskDetailSheet from '@/components/task/TaskDetailSheet';

export default function ProjectPage() {
  const { projectId, workspaceId } = useParams<{ projectId: string; workspaceId: string }>();
  const { data: tasks, isLoading } = useTasksByStatus(projectId);
  const { data: workspace } = useWorkspace(workspaceId!);

  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [taskFormOpen, setTaskFormOpen] = useState(false);
  const [defaultStatus, setDefaultStatus] = useState<TaskStatus>('TODO');

  if (isLoading) {
    return <div className="p-6 text-sm text-muted-foreground">Loading board...</div>;
  }

  if (!tasks) {
    return <div className="p-6 text-sm text-destructive">Failed to load tasks.</div>;
  }

  const handleAddClick = (status: TaskStatus) => {
    setDefaultStatus(status);
    setTaskFormOpen(true);
  };

  return (
    <div className="h-full flex flex-col">
      <KanbanBoard
        projectId={projectId!}
        tasks={tasks}
        onTaskClick={setSelectedTaskId}
        onAddClick={handleAddClick}
      />

      <TaskForm
        projectId={projectId!}
        defaultStatus={defaultStatus}
        open={taskFormOpen}
        onClose={() => setTaskFormOpen(false)}
      />

      <TaskDetailSheet
        taskId={selectedTaskId}
        projectId={projectId!}
        workspaceId={workspaceId!}
        onClose={() => setSelectedTaskId(null)}
      />
    </div>
  );
}
