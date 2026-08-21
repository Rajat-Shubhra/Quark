import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import type { Task } from './types'

export function TaskCard({ task, onOpen }: { task: Task; onOpen: (task: Task) => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: task.id,
  })

  return (
    <li
      ref={setNodeRef}
      className="card"
      style={{
        transform: CSS.Translate.toString(transform),
        transition,
        // The DragOverlay renders the "real" card while dragging.
        opacity: isDragging ? 0.35 : 1,
      }}
      {...attributes}
      {...listeners}
      // The pointer sensor only starts a drag after a few pixels of movement,
      // so a plain click still opens the task.
      onClick={() => onOpen(task)}
    >
      <span className="card-title">{task.title}</span>
      {task.description && <span className="card-desc">{task.description}</span>}
    </li>
  )
}

/** Static version shown under the cursor while dragging. */
export function TaskCardPreview({ task }: { task: Task }) {
  return (
    <div className="card dragging">
      <span className="card-title">{task.title}</span>
      {task.description && <span className="card-desc">{task.description}</span>}
    </div>
  )
}
