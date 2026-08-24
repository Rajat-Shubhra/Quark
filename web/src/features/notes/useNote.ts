import { useCallback, useEffect, useRef, useState } from 'react'
import type { Block } from '@blocknote/core'
import { supabase } from '../../lib/supabase'

export type SaveState = 'idle' | 'saving' | 'saved' | 'error'

const SAVE_DEBOUNCE_MS = 700

/**
 * Loads the note attached to a task and autosaves edits back into
 * `notes.content`. The row is created lazily on the first edit, so opening a
 * task you never write in doesn't litter the table with empty notes.
 */
export function useNote(taskId: string, userId: string, taskTitle: string) {
  const [initialContent, setInitialContent] = useState<Block[] | undefined>()
  const [loading, setLoading] = useState(true)
  const [saveState, setSaveState] = useState<SaveState>('idle')

  const timer = useRef<number | undefined>(undefined)
  const pending = useRef<Block[] | null>(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setSaveState('idle')

    supabase
      .from('notes')
      .select('content')
      .eq('task_id', taskId)
      .maybeSingle()
      .then(({ data, error }) => {
        if (cancelled) return
        const blocks = data?.content as Block[] | undefined
        // BlockNote wants undefined (not []) for an empty document.
        setInitialContent(blocks && blocks.length > 0 ? blocks : undefined)
        if (error) setSaveState('error')
        setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [taskId])

  const flush = useCallback(async () => {
    const content = pending.current
    if (!content) return
    pending.current = null

    // Upsert on task_id: the unique constraint makes this idempotent, so two
    // saves racing before the first insert returns can't create a second note.
    const { error } = await supabase
      .from('notes')
      .upsert({ user_id: userId, task_id: taskId, title: taskTitle, content }, { onConflict: 'task_id' })

    setSaveState(error ? 'error' : 'saved')
  }, [taskId, userId, taskTitle])

  const save = useCallback(
    (content: Block[]) => {
      pending.current = content
      setSaveState('saving')
      window.clearTimeout(timer.current)
      timer.current = window.setTimeout(() => void flush(), SAVE_DEBOUNCE_MS)
    },
    [flush],
  )

  // Closing the drawer unmounts the editor — write out anything still pending
  // rather than losing the last few keystrokes.
  useEffect(() => {
    return () => {
      window.clearTimeout(timer.current)
      void flush()
    }
  }, [flush])

  return { initialContent, loading, saveState, save }
}
