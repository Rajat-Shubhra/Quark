export type TaskStatus = 'todo' | 'doing' | 'done'

export type Task = {
  id: string
  user_id: string
  parent_id: string | null
  title: string
  description: string
  status: TaskStatus
  position: number
  created_at: string
  updated_at: string
}

export const COLUMNS: { id: TaskStatus; label: string }[] = [
  { id: 'todo', label: 'Todo' },
  { id: 'doing', label: 'Doing' },
  { id: 'done', label: 'Done' },
]

/** Gap left between cards so most drops only need to rewrite the moved row. */
export const POSITION_GAP = 1024
