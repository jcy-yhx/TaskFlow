import type { Task, TaskPriority } from '@/api/tasks';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical, MessageSquare, Paperclip, Calendar } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';

const PRIORITY_COLORS: Record<TaskPriority, string> = {
  URGENT: 'bg-red-500',
  HIGH: 'bg-orange-500',
  MEDIUM: 'bg-blue-500',
  LOW: 'bg-gray-400',
};

interface Props {
  task: Task;
  isDragging?: boolean;
  onClick: () => void;
}

export default function KanbanCard({ task, onClick }: Props) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: task.id,
    data: { task },
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const isOverdue = task.dueDate && new Date(task.dueDate) < new Date();

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        'group bg-card border rounded-lg p-3 cursor-pointer shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all',
        isDragging && 'shadow-lg ring-2 ring-primary/20',
      )}
      onClick={onClick}
    >
      <div className="flex items-start gap-2">
        <button
          {...attributes}
          {...listeners}
          className="mt-0.5 cursor-grab active:cursor-grabbing text-muted-foreground/40 hover:text-muted-foreground shrink-0"
          onClick={(e) => e.stopPropagation()}
        >
          <GripVertical className="w-3.5 h-3.5" />
        </button>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 mb-1">
            <div className={cn('w-2 h-2 rounded-full shrink-0', PRIORITY_COLORS[task.priority])} />
            <p className="text-sm font-medium truncate">{task.title}</p>
          </div>

          {/* Meta row */}
          <div className="flex items-center gap-3 text-xs text-muted-foreground mt-2">
            {task.dueDate && (
              <span className={cn('flex items-center gap-0.5', isOverdue && 'text-red-500')}>
                <Calendar className="w-3 h-3" />
                {format(new Date(task.dueDate), 'MMM d')}
              </span>
            )}
            {task.commentCount > 0 && (
              <span className="flex items-center gap-0.5">
                <MessageSquare className="w-3 h-3" />{task.commentCount}
              </span>
            )}
            {task.attachmentCount > 0 && (
              <span className="flex items-center gap-0.5">
                <Paperclip className="w-3 h-3" />{task.attachmentCount}
              </span>
            )}
          </div>

          {/* Assignee avatars */}
          {task.assignees.length > 0 && (
            <div className="flex -space-x-1.5 mt-2">
              {task.assignees.slice(0, 3).map((user) => (
                <div
                  key={user.id}
                  className="w-5 h-5 rounded-full bg-muted border-2 border-card flex items-center justify-center text-[10px] font-medium"
                  title={user.name}
                >
                  {user.name[0].toUpperCase()}
                </div>
              ))}
              {task.assignees.length > 3 && (
                <div className="w-5 h-5 rounded-full bg-muted border-2 border-card flex items-center justify-center text-[10px] text-muted-foreground">
                  +{task.assignees.length - 3}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
