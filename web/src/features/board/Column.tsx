import { useState, type FormEvent } from 'react'
import { useDroppable } from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { TaskCard } from './TaskCard'
import type { Task, TaskStatus } from './types'

type ColumnProps = {
  status: TaskStatus
  label: string
  tasks: Task[]
  onOpen: (task: Task) => void
  onCreate: (title: string, status: TaskStatus) => void
}

export function Column({ status, label, tasks, onOpen, onCreate }: ColumnProps) {
  // Droppable on the column itself so cards can be dropped into empty space.
  const { setNodeRef, isOver } = useDroppable({ id: status })
  const [title, setTitle] = useState('')

  function handleSubmit(event: FormEvent) {
    event.preventDefault()
    if (!title.trim()) return
    onCreate(title, status)
    setTitle('')
  }

  return (
    <section className="column">
      <h3>
        {label} <span className="count">{tasks.length}</span>
      </h3>

      <ul ref={setNodeRef} className={`dropzone${isOver ? ' over' : ''}`}>
        <SortableContext items={tasks.map((t) => t.id)} strategy={verticalListSortingStrategy}>
          {tasks.map((task) => (
            <TaskCard key={task.id} task={task} onOpen={onOpen} />
          ))}
        </SortableContext>
        {tasks.length === 0 && <li className="empty">Nothing here yet</li>}
      </ul>

      <form className="add" onSubmit={handleSubmit}>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Add a task…"
          aria-label={`Add a task to ${label}`}
        />
      </form>
    </section>
  )
}
