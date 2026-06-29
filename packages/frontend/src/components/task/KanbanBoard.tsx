import { useState } from 'react';
import type { Task, TaskStatus } from '@/api/tasks';
import { useMoveTask } from '@/api/tasks';
import {
  DndContext,
  DragOverlay,
  closestCorners,
  PointerSensor,
  useSensor,
  useSensors,
  type DragStartEvent,
  type DragEndEvent,
} from '@dnd-kit/core';
import KanbanColumn from './KanbanColumn';
import KanbanCard from './KanbanCard';

interface Props {
  projectId: string;
  tasks: Record<TaskStatus, Task[]>;
  onTaskClick: (taskId: string) => void;
  onAddClick: (status: TaskStatus) => void;
}

export default function KanbanBoard({ projectId, tasks, onTaskClick, onAddClick }: Props) {
  const moveTask = useMoveTask(projectId);
  const [activeTask, setActiveTask] = useState<Task | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
  );

  const handleDragStart = (event: DragStartEvent) => {
    const task = event.active.data.current?.task as Task | undefined;
    if (task) setActiveTask(task);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    setActiveTask(null);
    const { active, over } = event;
    if (!over) return;

    const task = active.data.current?.task as Task;
    const sourceStatus = task?.status;
    const taskId = task?.id;

    // Determine target status and position
    let targetStatus: TaskStatus;
    if (over.data.current?.type === 'column' || typeof over.id === 'string' && ['BACKLOG', 'TODO', 'IN_PROGRESS', 'IN_REVIEW', 'DONE'].includes(over.id as string)) {
      // Dropped on a column itself
      targetStatus = over.id as TaskStatus;
    } else {
      // Dropped on a card — inherit that card's status
      const overTask = over.data.current?.task as Task | undefined;
      targetStatus = overTask?.status ?? sourceStatus;
    }

    if (!sourceStatus || !taskId) return;

    // Calculate new position: count how many items are before this in the target column
    const targetTasks = tasks[targetStatus] ?? [];
    const overIndex = targetTasks.findIndex((t) => t.id === over.id);
    const newPosition = overIndex >= 0 ? overIndex : targetTasks.length;

    // Don't do anything if no actual change
    if (sourceStatus === targetStatus && task.position === newPosition) return;

    moveTask.mutate({ id: taskId, status: targetStatus, position: newPosition });
  };

  const columns: TaskStatus[] = ['BACKLOG', 'TODO', 'IN_PROGRESS', 'IN_REVIEW', 'DONE'];

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div className="flex gap-4 p-6 overflow-x-auto h-full items-start">
        {columns.map((status) => (
          <KanbanColumn
            key={status}
            status={status}
            tasks={tasks[status] ?? []}
            onTaskClick={onTaskClick}
            onAddClick={onAddClick}
          />
        ))}
      </div>

      <DragOverlay>
        {activeTask ? (
          <div className="w-72 opacity-90">
            <KanbanCard task={activeTask} onClick={() => {}} />
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
