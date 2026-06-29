import type { Task, TaskStatus } from '@/api/tasks';
import { useDroppable } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import KanbanCard from './KanbanCard';
import { cn } from '@/lib/utils';
import { Plus } from 'lucide-react';

const STATUS_LABELS: Record<TaskStatus, string> = {
  BACKLOG: 'Backlog',
  TODO: 'To Do',
  IN_PROGRESS: 'In Progress',
  IN_REVIEW: 'In Review',
  DONE: 'Done',
};

const STATUS_COLORS: Record<TaskStatus, string> = {
  BACKLOG: 'bg-gray-400',
  TODO: 'bg-blue-400',
  IN_PROGRESS: 'bg-yellow-400',
  IN_REVIEW: 'bg-purple-400',
  DONE: 'bg-green-400',
};

interface Props {
  status: TaskStatus;
  tasks: Task[];
  onTaskClick: (taskId: string) => void;
  onAddClick: (status: TaskStatus) => void;
}

export default function KanbanColumn({ status, tasks, onTaskClick, onAddClick }: Props) {
  const { setNodeRef, isOver } = useDroppable({ id: status });

  return (
    <div className="flex flex-col w-72 shrink-0">
      {/* Column header */}
      <div className="flex items-center justify-between mb-2 px-1">
        <div className="flex items-center gap-2">
          <div className={cn('w-2.5 h-2.5 rounded-full', STATUS_COLORS[status])} />
          <h3 className="text-sm font-semibold text-foreground">
            {STATUS_LABELS[status]}
          </h3>
          <span className="text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded-full">
            {tasks.length}
          </span>
        </div>
        <button
          onClick={() => onAddClick(status)}
          className="p-0.5 hover:bg-accent rounded text-muted-foreground hover:text-foreground"
        >
          <Plus className="w-4 h-4" />
        </button>
      </div>

      {/* Card list */}
      <div
        ref={setNodeRef}
        className={cn(
          'flex-1 rounded-lg p-2 space-y-2 min-h-[120px] transition-colors',
          isOver ? 'bg-accent/60' : 'bg-muted/30',
        )}
      >
        <SortableContext items={tasks.map((t) => t.id)} strategy={verticalListSortingStrategy}>
          {tasks.map((task) => (
            <KanbanCard
              key={task.id}
              task={task}
              onClick={() => onTaskClick(task.id)}
            />
          ))}
        </SortableContext>

        {tasks.length === 0 && (
          <p className="text-xs text-muted-foreground text-center py-8">
            No tasks
          </p>
        )}
      </div>
    </div>
  );
}
