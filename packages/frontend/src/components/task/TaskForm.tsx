import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { createTaskSchema, type CreateTaskInput } from '@taskflow/shared';
import type { TaskStatus, TaskPriority } from '@/api/tasks';
import { useCreateTask } from '@/api/tasks';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';

interface Props {
  projectId: string;
  defaultStatus?: TaskStatus;
  open: boolean;
  onClose: () => void;
}

export default function TaskForm({ projectId, defaultStatus = 'TODO', open, onClose }: Props) {
  const createMutation = useCreateTask(projectId);

  const { register, handleSubmit, reset, formState: { isSubmitting, errors } } = useForm<CreateTaskInput>({
    resolver: zodResolver(createTaskSchema),
    defaultValues: { status: defaultStatus, priority: 'MEDIUM' },
  });

  const onSubmit = async (data: CreateTaskInput) => {
    try {
      await createMutation.mutateAsync({ ...data });
      toast.success('Task created');
      reset();
      onClose();
    } catch {
      toast.error('Failed to create task');
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div className="w-full max-w-md rounded-lg border bg-card p-6 shadow-lg" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-lg font-semibold mb-4">Create Task</h2>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div>
            <Input placeholder="Task title" {...register('title')} autoFocus />
            {errors.title && <p className="text-xs text-destructive mt-1">{errors.title.message}</p>}
          </div>
          <div>
            <textarea
              placeholder="Description (optional)"
              {...register('description')}
              className="w-full min-h-[80px] rounded-md border border-input bg-transparent px-3 py-2 text-sm resize-y"
              rows={3}
            />
          </div>
          <div className="flex gap-3">
            <div className="flex-1">
              <label className="text-xs text-muted-foreground">Status</label>
              <select {...register('status')} className="w-full h-9 rounded-md border border-input bg-transparent px-2 text-sm mt-1">
                {['BACKLOG', 'TODO', 'IN_PROGRESS', 'IN_REVIEW', 'DONE'].map((s) => (
                  <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>
                ))}
              </select>
            </div>
            <div className="flex-1">
              <label className="text-xs text-muted-foreground">Priority</label>
              <select {...register('priority')} className="w-full h-9 rounded-md border border-input bg-transparent px-2 text-sm mt-1">
                {(['LOW', 'MEDIUM', 'HIGH', 'URGENT'] as TaskPriority[]).map((p) => (
                  <option key={p} value={p}>{p}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="flex gap-2 justify-end">
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'Creating...' : 'Create Task'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
