import { useEffect, useState } from 'react'
import { COLUMNS, type Task, type TaskStatus } from './types'

type TaskDetailProps = {
  task: Task
  onClose: () => void
  onUpdate: (id: string, patch: Partial<Task>) => void
  onDelete: (id: string) => void
}

export function TaskDetail({ task, onClose, onUpdate, onDelete }: TaskDetailProps) {
  const [title, setTitle] = useState(task.title)
  const [description, setDescription] = useState(task.description)
  const [confirmingDelete, setConfirmingDelete] = useState(false)

  // Switching to a different task while the panel is open.
  useEffect(() => {
    setTitle(task.title)
    setDescription(task.description)
    setConfirmingDelete(false)
  }, [task.id, task.title, task.description])

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  /** Edits save when a field loses focus — no explicit save button. */
  function commit() {
    const patch: Partial<Task> = {}
    const trimmed = title.trim()
    if (trimmed && trimmed !== task.title) patch.title = trimmed
    if (description !== task.description) patch.description = description
    if (Object.keys(patch).length > 0) onUpdate(task.id, patch)
  }

  return (
    <div className="drawer-backdrop" onClick={onClose}>
      <aside className="drawer" onClick={(e) => e.stopPropagation()} aria-label="Task detail">
        <header>
          <label htmlFor="task-status">Status</label>
          <select
            id="task-status"
            value={task.status}
            onChange={(e) => onUpdate(task.id, { status: e.target.value as TaskStatus })}
          >
            {COLUMNS.map((column) => (
              <option key={column.id} value={column.id}>
                {column.label}
              </option>
            ))}
          </select>
          <button type="button" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </header>

        <label htmlFor="task-title">Title</label>
        <input
          id="task-title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onBlur={commit}
        />

        <label htmlFor="task-description">Description</label>
        <textarea
          id="task-description"
          rows={5}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          onBlur={commit}
          placeholder="What does done look like?"
        />

        <p className="muted note-placeholder">
          A BlockNote note attaches here in milestone 4, and the task agent in milestone 5.
        </p>

        <footer>
          {confirmingDelete ? (
            <>
              <span className="muted">Delete this task?</span>
              <button type="button" className="danger" onClick={() => onDelete(task.id)}>
                Yes, delete
              </button>
              <button type="button" onClick={() => setConfirmingDelete(false)}>
                Cancel
              </button>
            </>
          ) : (
            <button type="button" className="danger" onClick={() => setConfirmingDelete(true)}>
              Delete task
            </button>
          )}
        </footer>
      </aside>
    </div>
  )
}
