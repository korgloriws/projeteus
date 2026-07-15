import { useMemo } from "react";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useDroppable } from "@dnd-kit/core";
import type { DraggableAttributes } from "@dnd-kit/core";
import type { SyntheticListenerMap } from "@dnd-kit/core/dist/hooks/utilities";
import { GripVertical } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  arrayMove,
  parseStageDropDndId,
  parseStageDndId,
  parseTaskDndId,
  sortByOrder,
  stageDndId,
  stageDropDndId,
  taskDndId,
} from "@/lib/board-order";
import type { Stage, Task } from "@api/client";

export type BoardTask = Task & { order?: number };

interface UseProjectBoardDndOptions {
  stages: Stage[];
  tasks: BoardTask[];
  canReorder: boolean;
  onPersistStages: (orderedStages: Stage[]) => Promise<void>;
  onPersistTasks: (
    updates: { id: number; stageId: number; order: number }[],
  ) => Promise<void>;
}

export function useProjectBoardDnd({
  stages,
  tasks,
  canReorder,
  onPersistStages,
  onPersistTasks,
}: UseProjectBoardDndOptions) {
  const sortedStages = useMemo(() => sortByOrder(stages), [stages]);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    }),
  );

  function getStageTasks(stageId: number) {
    return sortByOrder(tasks.filter((task) => task.stageId === stageId));
  }

  async function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || !canReorder) return;

    const activeId = String(active.id);
    const overId = String(over.id);

    const activeStageId = parseStageDndId(activeId);
    if (activeStageId !== null) {
      const overStageId = parseStageDndId(overId);
      if (!overStageId || activeStageId === overStageId) return;

      const oldIndex = sortedStages.findIndex((stage) => stage.id === activeStageId);
      const newIndex = sortedStages.findIndex((stage) => stage.id === overStageId);
      if (oldIndex === -1 || newIndex === -1) return;

      await onPersistStages(arrayMove(sortedStages, oldIndex, newIndex));
      return;
    }

    const activeTaskId = parseTaskDndId(activeId);
    if (activeTaskId === null) return;

    const activeTask = tasks.find((task) => task.id === activeTaskId);
    if (!activeTask) return;

    const sourceStageId = activeTask.stageId;
    let targetStageId = sourceStageId;
    let targetIndex = 0;

    const dropStageId = parseStageDropDndId(overId);
    const overTaskId = parseTaskDndId(overId);

    if (dropStageId !== null) {
      targetStageId = dropStageId;
      targetIndex = getStageTasks(dropStageId).filter((task) => task.id !== activeTaskId).length;
    } else if (overTaskId !== null) {
      const overTask = tasks.find((task) => task.id === overTaskId);
      if (!overTask) return;
      targetStageId = overTask.stageId;
      const stageTasks = getStageTasks(targetStageId).filter((task) => task.id !== activeTaskId);
      targetIndex = stageTasks.findIndex((task) => task.id === overTaskId);
      if (targetIndex === -1) targetIndex = stageTasks.length;
    } else {
      return;
    }

    const updates: { id: number; stageId: number; order: number }[] = [];

    if (sourceStageId === targetStageId) {
      const stageTasks = getStageTasks(sourceStageId);
      const oldIndex = stageTasks.findIndex((task) => task.id === activeTaskId);
      const overIndex = overTaskId
        ? stageTasks.findIndex((task) => task.id === overTaskId)
        : stageTasks.length - 1;
      if (oldIndex === -1 || overIndex === -1 || oldIndex === overIndex) return;

      const reordered = arrayMove(stageTasks, oldIndex, overIndex);
      reordered.forEach((task, index) => {
        updates.push({ id: task.id, stageId: sourceStageId, order: index });
      });
    } else {
      const sourceTasks = getStageTasks(sourceStageId).filter(
        (task) => task.id !== activeTaskId,
      );
      const destinationTasks = getStageTasks(targetStageId).filter(
        (task) => task.id !== activeTaskId,
      );
      destinationTasks.splice(targetIndex, 0, activeTask);

      sourceTasks.forEach((task, index) => {
        updates.push({ id: task.id, stageId: sourceStageId, order: index });
      });
      destinationTasks.forEach((task, index) => {
        updates.push({ id: task.id, stageId: targetStageId, order: index });
      });
    }

    if (updates.length === 0) return;
    await onPersistTasks(updates);
  }

  return {
    sensors,
    handleDragEnd,
    sortedStages,
    getStageTasks,
    stageSortableIds: sortedStages.map((stage) => stageDndId(stage.id)),
  };
}

interface DragHandleProps {
  disabled?: boolean;
  className?: string;
  attributes?: DraggableAttributes;
  listeners?: SyntheticListenerMap;
  setActivatorNodeRef?: (element: HTMLElement | null) => void;
}

export function DragHandle({
  disabled,
  className,
  attributes,
  listeners,
  setActivatorNodeRef,
}: DragHandleProps) {
  if (disabled) return null;

  return (
    <button
      type="button"
      ref={setActivatorNodeRef}
      className={cn(
        "inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground cursor-grab active:cursor-grabbing touch-none",
        className,
      )}
      aria-label="Arrastar para reordenar"
      {...attributes}
      {...listeners}
    >
      <GripVertical className="h-4 w-4" />
    </button>
  );
}

export function SortableStageItem({
  stageId,
  disabled,
  children,
}: {
  stageId: number;
  disabled?: boolean;
  children: (dragHandle: React.ReactNode) => React.ReactNode;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: stageDndId(stageId),
    disabled,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 1 : undefined,
  };

  return (
    <div ref={setNodeRef} style={style} className={isDragging ? "relative" : undefined}>
      {children(
        <DragHandle
          disabled={disabled}
          attributes={attributes}
          listeners={listeners}
          setActivatorNodeRef={setActivatorNodeRef}
        />,
      )}
    </div>
  );
}

export function SortableTaskItem({
  taskId,
  disabled,
  children,
}: {
  taskId: number;
  disabled?: boolean;
  children: (dragHandle: React.ReactNode) => React.ReactNode;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: taskDndId(taskId),
    disabled,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 1 : undefined,
  };

  return (
    <div ref={setNodeRef} style={style} className={isDragging ? "relative" : undefined}>
      {children(
        <DragHandle
          disabled={disabled}
          className="h-7 w-7"
          attributes={attributes}
          listeners={listeners}
          setActivatorNodeRef={setActivatorNodeRef}
        />,
      )}
    </div>
  );
}

export function StageTaskDropZone({
  stageId,
  disabled,
  children,
}: {
  stageId: number;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  const { setNodeRef, isOver } = useDroppable({
    id: stageDropDndId(stageId),
    disabled,
  });

  return (
    <div
      ref={setNodeRef}
      className={cn(
        "min-h-[48px]",
        isOver && "bg-primary/5 ring-1 ring-primary/20 ring-inset",
      )}
    >
      {children}
    </div>
  );
}

export {
  DndContext,
  DragOverlay,
  SortableContext,
  closestCenter,
  verticalListSortingStrategy,
};
