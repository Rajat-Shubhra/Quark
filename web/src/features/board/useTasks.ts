import { useCallback, useEffect, useRef, useState } from 'react'
import type { PostgrestError } from '@supabase/supabase-js'
import { supabase } from '../../lib/supabase'
import { POSITION_GAP, type Task, type TaskStatus } from './types'

/** The tables aren't there yet — the migration in supabase/migrations hasn't been run. */
function isMissingTable(error: PostgrestError) {
  return (
    error.code === '42P01' ||
    error.code === 'PGRST205' ||
    /does not exist|schema cache/i.test(error.message)
  )
}

export function useTasks(userId: string) {
  const [tasks, setTasks] = useState<Task[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string>()
  const [needsMigration, setNeedsMigration] = useState(false)
  // Last position handed out per column. React state hasn't re-rendered yet when
  // two tasks are added in the same tick, so without this they'd collide on one
  // position and their order would be arbitrary.
  const lastPosition = useRef<Record<TaskStatus, number>>({ todo: 0, doing: 0, done: 0 })

  const load = useCallback(async () => {
    setLoading(true)
    const { data, error: loadError } = await supabase
      .from('tasks')
      .select('*')
      .order('position', { ascending: true })

    if (loadError) {
      setNeedsMigration(isMissingTable(loadError))
      setError(loadError.message)
    } else {
      setTasks(data as Task[])
      setError(undefined)
      setNeedsMigration(false)
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const createTask = useCallback(
    async (title: string, status: TaskStatus) => {
      const trimmed = title.trim()
      if (!trimmed) return

      // Append to the end of its column, past anything already handed out.
      const columnMax = tasks
        .filter((t) => t.status === status)
        .reduce((max, t) => Math.max(max, t.position), 0)
      const position = Math.max(columnMax, lastPosition.current[status]) + POSITION_GAP
      lastPosition.current[status] = position

      // RLS also derives ownership, but the column is NOT NULL so we set it.
      const { data, error: insertError } = await supabase
        .from('tasks')
        .insert({ user_id: userId, title: trimmed, status, position })
        .select()
        .single()

      if (insertError) setError(insertError.message)
      else setTasks((prev) => [...prev, data as Task])
    },
    [tasks, userId],
  )

  const updateTask = useCallback(async (id: string, patch: Partial<Task>) => {
    // Optimistic: the board (and drag-and-drop especially) should feel instant.
    let rollback: Task[] = []
    setTasks((prev) => {
      rollback = prev
      return prev.map((t) => (t.id === id ? { ...t, ...patch } : t))
    })

    const { error: updateError } = await supabase.from('tasks').update(patch).eq('id', id)
    if (updateError) {
      setTasks(rollback)
      setError(updateError.message)
    }
  }, [])

  const deleteTask = useCallback(async (id: string) => {
    let rollback: Task[] = []
    setTasks((prev) => {
      rollback = prev
      return prev.filter((t) => t.id !== id)
    })

    const { error: deleteError } = await supabase.from('tasks').delete().eq('id', id)
    if (deleteError) {
      setTasks(rollback)
      setError(deleteError.message)
    }
  }, [])

  return { tasks, loading, error, needsMigration, createTask, updateTask, deleteTask, reload: load }
}
