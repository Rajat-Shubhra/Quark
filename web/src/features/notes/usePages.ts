import { useCallback, useEffect, useRef, useState } from 'react'
import type { Block } from '@blocknote/core'
import { supabase } from '../../lib/supabase'
import type { SaveState } from './useNote'

const SAVE_DEBOUNCE_MS = 700

export type NotePage = {
  id: string
  title: string
  content: Block[]
  updated_at: string
}

/**
 * Standalone note pages: rows in `notes` with no task_id. The column is
 * nullable precisely so a note can exist on its own rather than belonging to
 * a task.
 */
export function usePages(userId: string) {
  const [pages, setPages] = useState<NotePage[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string>()
  const [saveState, setSaveState] = useState<SaveState>('idle')

  const timer = useRef<number | undefined>(undefined)
  const pending = useRef<{ id: string; content: Block[] } | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    const { data, error: loadError } = await supabase
      .from('notes')
      .select('id, title, content, updated_at')
      .is('task_id', null)
      .order('updated_at', { ascending: false })

    if (loadError) setError(loadError.message)
    else setPages((data ?? []) as NotePage[])
    setLoading(false)
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const createPage = useCallback(async () => {
    const { data, error: insertError } = await supabase
      .from('notes')
      .insert({ user_id: userId, task_id: null, title: 'Untitled', content: [] })
      .select('id, title, content, updated_at')
      .single()

    if (insertError) {
      setError(insertError.message)
      return null
    }
    const page = data as NotePage
    setPages((prev) => [page, ...prev])
    return page
  }, [userId])

  const renamePage = useCallback(async (id: string, title: string) => {
    setPages((prev) => prev.map((page) => (page.id === id ? { ...page, title } : page)))
    const { error: updateError } = await supabase.from('notes').update({ title }).eq('id', id)
    if (updateError) setError(updateError.message)
  }, [])

  const deletePage = useCallback(async (id: string) => {
    let rollback: NotePage[] = []
    setPages((prev) => {
      rollback = prev
      return prev.filter((page) => page.id !== id)
    })
    const { error: deleteError } = await supabase.from('notes').delete().eq('id', id)
    if (deleteError) {
      setPages(rollback)
      setError(deleteError.message)
    }
  }, [])

  const flush = useCallback(async () => {
    const next = pending.current
    if (!next) return
    pending.current = null

    const { error: saveError } = await supabase
      .from('notes')
      .update({ content: next.content })
      .eq('id', next.id)

    setSaveState(saveError ? 'error' : 'saved')
    if (saveError) setError(saveError.message)
    else setPages((prev) => prev.map((p) => (p.id === next.id ? { ...p, content: next.content } : p)))
  }, [])

  /** Same debounce-then-flush shape as task notes. */
  const savePage = useCallback(
    (id: string, content: Block[]) => {
      pending.current = { id, content }
      setSaveState('saving')
      window.clearTimeout(timer.current)
      timer.current = window.setTimeout(() => void flush(), SAVE_DEBOUNCE_MS)
    },
    [flush],
  )

  // Don't lose the last keystrokes when the page unmounts.
  useEffect(() => {
    return () => {
      window.clearTimeout(timer.current)
      void flush()
    }
  }, [flush])

  return { pages, loading, error, saveState, createPage, renamePage, deletePage, savePage }
}
