import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { createProjectSchema, type CreateProjectInput } from '@taskflow/shared';
import { useCreateProject } from '@/api/projects';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';

interface Props {
  workspaceId: string;
  open: boolean;
  onClose: () => void;
}

const PRESET_COLORS = ['#3b82f6', '#ef4444', '#22c55e', '#f59e0b', '#8b5cf6', '#ec4899'];

export default function ProjectForm({ workspaceId, open, onClose }: Props) {
  const createMut = useCreateProject(workspaceId);
  const { register, handleSubmit, setValue, watch, reset, formState: { isSubmitting } } = useForm<CreateProjectInput>({
    resolver: zodResolver(createProjectSchema),
    defaultValues: { color: '#3b82f6' },
  });

  const selectedColor = watch('color');

  const onSubmit = async (data: CreateProjectInput) => {
    try {
      await createMut.mutateAsync(data);
      toast.success('Project created');
      reset();
      onClose();
    } catch {
      toast.error('Failed to create project');
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div className="w-full max-w-sm rounded-lg border bg-card p-6 shadow-lg" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-lg font-semibold mb-4">New Project</h2>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <Input placeholder="Project name" {...register('name')} autoFocus />
          <Input placeholder="Description (optional)" {...register('description')} />
          <div>
            <label className="text-xs text-muted-foreground block mb-1">Color</label>
            <div className="flex gap-2">
              {PRESET_COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  className={`w-7 h-7 rounded-full border-2 ${selectedColor === c ? 'border-foreground ring-2 ring-offset-1 ring-primary/30' : 'border-transparent'}`}
                  style={{ backgroundColor: c }}
                  onClick={() => setValue('color', c)}
                />
              ))}
            </div>
          </div>
          <div className="flex gap-2 justify-end">
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'Creating...' : 'Create'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
