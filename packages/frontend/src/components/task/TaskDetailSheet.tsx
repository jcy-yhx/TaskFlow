import { useTask, useUpdateTask, useDeleteTask, useAssignTask, useUnassignTask, type TaskStatus, type TaskPriority } from '@/api/tasks';
import { useMembers } from '@/api/workspaces';
import { useAuthStore } from '@/stores/auth-store';
import CommentSection from '@/components/comment/CommentSection';
import FileUpload from '@/components/common/FileUpload';
import { Button } from '@/components/ui/button';
import { X, Trash2, UserPlus, UserX, Calendar } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

interface Props {
  taskId: string | null;
  projectId: string;
  workspaceId: string;
  onClose: () => void;
}

export default function TaskDetailSheet({ taskId, projectId, workspaceId, onClose }: Props) {
  const { data: task } = useTask(taskId ?? undefined);
  const { data: members } = useMembers(workspaceId);
  const updateMut = useUpdateTask(projectId);
  const deleteMut = useDeleteTask(projectId);
  const assignMut = useAssignTask(projectId);
  const unassignMut = useUnassignTask(projectId);
  const { user } = useAuthStore();

  if (!taskId || !task) return null;

  const assignedIds = new Set(task.assignees.map((a) => a.id));
  const unassignedMembers = members?.filter((m) => !assignedIds.has(m.userId)) ?? [];
  const isOverdue = task.dueDate && new Date(task.dueDate) < new Date();

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 z-40 bg-black/20" onClick={onClose} />

      {/* Sheet */}
      <div className="fixed right-0 top-0 z-50 h-full w-[480px] max-w-[90vw] bg-card border-l shadow-2xl overflow-auto">
        {/* Header */}
        <div className="sticky top-0 bg-card border-b px-6 py-4 flex items-center justify-between z-10">
          <div className="flex items-center gap-2">
            <span className="text-xs font-mono text-muted-foreground">{task.id.slice(-6)}</span>
            <select
              value={task.status}
              onChange={(e) => updateMut.mutate({ id: task.id, status: e.target.value as TaskStatus } as never)}
              className="text-xs h-7 rounded-md border px-2 bg-muted/50"
            >
              {['BACKLOG', 'TODO', 'IN_PROGRESS', 'IN_REVIEW', 'DONE'].map((s) => (
                <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>
              ))}
            </select>
            <select
              value={task.priority}
              onChange={(e) => updateMut.mutate({ id: task.id, priority: e.target.value as TaskPriority })}
              className="text-xs h-7 rounded-md border px-2 bg-muted/50"
            >
              {['LOW', 'MEDIUM', 'HIGH', 'URGENT'].map((p) => (
                <option key={p} value={p}>{p}</option>
              ))}
            </select>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={() => {
                if (!confirm('Delete this task?')) return;
                deleteMut.mutate(task.id, { onSuccess: onClose });
              }}
              className="p-1.5 hover:bg-destructive/10 rounded text-muted-foreground hover:text-destructive"
            >
              <Trash2 className="w-4 h-4" />
            </button>
            <button onClick={onClose} className="p-1.5 hover:bg-accent rounded">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="p-6 space-y-6">
          {/* Title */}
          <input
            className="w-full text-xl font-bold bg-transparent border-none outline-none"
            value={task.title}
            onChange={(e) => updateMut.mutate({ id: task.id, title: e.target.value })}
          />

          {/* Description */}
          <div>
            <h4 className="text-sm font-medium text-muted-foreground mb-2">Description</h4>
            <textarea
              className="w-full min-h-[100px] text-sm bg-muted/30 rounded-md border-none p-3 resize-y"
              placeholder="Add a description..."
              value={task.description ?? ''}
              onChange={(e) => updateMut.mutate({ id: task.id, description: e.target.value })}
            />
          </div>

          {/* Meta info */}
          <div className="space-y-3 text-sm">
            {/* Due date */}
            <div className="flex items-center gap-2">
              <Calendar className={cn('w-4 h-4', isOverdue ? 'text-red-500' : 'text-muted-foreground')} />
              {task.dueDate ? (
                <span className={cn(isOverdue && 'text-red-500 font-medium')}>
                  Due {format(new Date(task.dueDate), 'MMM d, yyyy')}
                  {isOverdue && ' (Overdue!)'}
                </span>
              ) : (
                <input
                  type="date"
                  className="bg-transparent border rounded px-2 py-0.5 text-xs"
                  onChange={(e) => updateMut.mutate({ id: task.id, dueDate: e.target.value ? new Date(e.target.value).toISOString() : null })}
                />
              )}
            </div>

            {/* Creator */}
            <div className="flex items-center gap-2 text-muted-foreground">
              <div className="w-5 h-5 rounded-full bg-muted flex items-center justify-center text-[10px] font-medium">
                {task.creator.name[0]}
              </div>
              <span>Created by {task.creator.name}</span>
              <span>·</span>
              <span>{format(new Date(task.createdAt), 'MMM d')}</span>
            </div>
          </div>

          {/* Assignees */}
          <div>
            <h4 className="text-sm font-medium text-muted-foreground mb-2">
              Assignees ({task.assignees.length})
            </h4>
            <div className="space-y-1">
              {task.assignees.map((a) => (
                <div key={a.id} className="flex items-center justify-between py-1.5 px-2 rounded-md hover:bg-muted/50">
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-full bg-muted flex items-center justify-center text-xs font-medium">
                      {a.name[0].toUpperCase()}
                    </div>
                    <span className="text-sm">{a.name}</span>
                  </div>
                  {a.id !== user?.id && (
                    <button
                      onClick={() => unassignMut.mutate({ taskId: task.id, userId: a.id })}
                      className="p-1 hover:bg-destructive/10 rounded"
                    >
                      <UserX className="w-3.5 h-3.5 text-muted-foreground" />
                    </button>
                  )}
                </div>
              ))}
            </div>

            {/* Add assignee */}
            {unassignedMembers.length > 0 && (
              <select
                className="w-full mt-2 h-8 text-sm rounded-md border bg-transparent px-2"
                value=""
                onChange={(e) => {
                  if (e.target.value) {
                    assignMut.mutate({ taskId: task.id, userId: e.target.value });
                    e.target.value = '';
                  }
                }}
              >
                <option value="">+ Add assignee...</option>
                {unassignedMembers.map((m) => (
                  <option key={m.userId} value={m.userId}>{m.user.name}</option>
                ))}
              </select>
            )}
          </div>

          {/* Attachments */}
          <div className="pt-4 border-t">
            <FileUpload taskId={task.id} />
          </div>

          {/* Comments */}
          <div className="pt-4 border-t">
            <CommentSection taskId={task.id} />
          </div>
        </div>
      </div>
    </>
  );
}
