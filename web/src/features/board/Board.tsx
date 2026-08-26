import { useMemo, useState } from 'react'
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  closestCorners,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core'
import { Column } from './Column'
import { TaskCardPreview } from './TaskCard'
import { TaskDetail } from './TaskDetail'
import { useTasks } from './useTasks'
import { COLUMNS, POSITION_GAP, type Task, type TaskStatus } from './types'

/**
 * Position for a card landing at `index` of `column` (which excludes the card
 * being moved): the midpoint of its new neighbours, so only that row changes.
 */
function positionAt(column: Task[], index: number): number {
  const before = column[index - 1]
  const after = column[index]
  if (!before && !after) return POSITION_GAP
  if (!before) return after.position - POSITION_GAP
  if (!after) return before.position + POSITION_GAP
  return (before.position + after.position) / 2
}

function isStatus(value: string): value is TaskStatus {
  return COLUMNS.some((column) => column.id === value)
}

export function Board({ userId }: { userId: string }) {
  const { tasks, loading, error, needsMigration, createTask, updateTask, deleteTask, reload } =
    useTasks(userId)
  const [draggingId, setDraggingId] = useState<string | null>(null)
  const [openTaskId, setOpenTaskId] = useState<string | null>(null)

  // A few pixels of movement before a drag starts, so clicks still open a task.
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }))

  const byColumn = useMemo(() => {
    const grouped: Record<TaskStatus, Task[]> = { todo: [], doing: [], done: [] }
    for (const task of tasks) {
      // Subtasks (milestone 6) render inside their parent, not as board cards.
      if (!task.parent_id) grouped[task.status].push(task)
    }
    for (const status of Object.keys(grouped) as TaskStatus[]) {
      grouped[status].sort((a, b) => a.position - b.position)
    }
    return grouped
  }, [tasks])

  const draggingTask = draggingId ? tasks.find((t) => t.id === draggingId) : undefined
  const openTask = openTaskId ? tasks.find((t) => t.id === openTaskId) : undefined

  function handleDragStart(event: DragStartEvent) {
    setDraggingId(String(event.active.id))
  }

  function handleDragEnd(event: DragEndEvent) {
    setDraggingId(null)
    const { active, over } = event
    if (!over) return

    const task = tasks.find((t) => t.id === active.id)
    if (!task) return

    // `over` is either another card or a column's empty space.
    const overTask = tasks.find((t) => t.id === over.id)
    const targetStatus = overTask ? overTask.status : String(over.id)
    if (!isStatus(targetStatus)) return

    const column = byColumn[targetStatus].filter((t) => t.id !== task.id)
    let index = overTask ? column.findIndex((t) => t.id === overTask.id) : column.length
    if (index < 0) index = column.length
    // Dragging a card downwards past another lands it after that card.
    if (overTask && task.status === targetStatus && task.position < overTask.position) index += 1

    const position = positionAt(column, index)
    if (task.status === targetStatus && task.position === position) return

    void updateTask(task.id, { status: targetStatus, position })
  }

  if (needsMigration) {
    return (
      <div className="message error setup">
        <strong>Database not set up yet.</strong> Run{' '}
        <code>supabase/migrations/0001_init.sql</code> in the Supabase dashboard → SQL Editor, then{' '}
        <button type="button" onClick={() => void reload()}>
          retry
        </button>
        .
      </div>
    )
  }

  return (
    <>
      {error && <p className="message error">{error}</p>}
      {loading ? (
        <p className="muted">Loading board…</p>
      ) : (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCorners}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
          onDragCancel={() => setDraggingId(null)}
        >
          <div className="board">
            {COLUMNS.map((column) => (
              <Column
                key={column.id}
                status={column.id}
                label={column.label}
                tasks={byColumn[column.id]}
                onOpen={(task) => setOpenTaskId(task.id)}
                onCreate={createTask}
              />
            ))}
          </div>

          <DragOverlay>{draggingTask && <TaskCardPreview task={draggingTask} />}</DragOverlay>
        </DndContext>
      )}

      {openTask && (
        <TaskDetail
          task={openTask}
          subtasks={tasks
            .filter((t) => t.parent_id === openTask.id)
            .sort((a, b) => a.position - b.position)}
          onTasksChanged={() => void reload()}
          onClose={() => setOpenTaskId(null)}
          onUpdate={updateTask}
          onDelete={(id) => {
            setOpenTaskId(null)
            void deleteTask(id)
          }}
        />
      )}
    </>
  )
}
