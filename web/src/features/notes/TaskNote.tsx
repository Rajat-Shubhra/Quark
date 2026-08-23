import { useEffect, useState } from 'react'
import type { Block } from '@blocknote/core'
import { useCreateBlockNote } from '@blocknote/react'
import { BlockNoteView } from '@blocknote/mantine'
import '@blocknote/core/fonts/inter.css'
import '@blocknote/mantine/style.css'
import { useNote, type SaveState } from './useNote'

function useColorScheme(): 'light' | 'dark' {
  const [scheme, setScheme] = useState<'light' | 'dark'>(() =>
    window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light',
  )

  useEffect(() => {
    const query = window.matchMedia('(prefers-color-scheme: dark)')
    const onChange = (event: MediaQueryListEvent) => setScheme(event.matches ? 'dark' : 'light')
    query.addEventListener('change', onChange)
    return () => query.removeEventListener('change', onChange)
  }, [])

  return scheme
}

const SAVE_LABEL: Record<SaveState, string> = {
  idle: '',
  saving: 'Saving…',
  saved: 'Saved',
  error: 'Save failed',
}

/**
 * Split out so the editor is constructed once with its loaded content —
 * useCreateBlockNote only reads initialContent when it creates the editor.
 */
function Editor({
  initialContent,
  theme,
  onChange,
}: {
  initialContent: Block[] | undefined
  theme: 'light' | 'dark'
  onChange: (blocks: Block[]) => void
}) {
  const editor = useCreateBlockNote({ initialContent })

  return (
    <BlockNoteView editor={editor} theme={theme} onChange={() => onChange(editor.document as Block[])} />
  )
}

export function TaskNote({
  taskId,
  userId,
  taskTitle,
}: {
  taskId: string
  userId: string
  taskTitle: string
}) {
  const { initialContent, loading, saveState, save } = useNote(taskId, userId, taskTitle)
  const theme = useColorScheme()

  return (
    <section className="note">
      <div className="note-header">
        <span className="note-label">Note</span>
        <span className={`save-state ${saveState}`}>{SAVE_LABEL[saveState]}</span>
      </div>

      {loading ? (
        <p className="muted">Loading note…</p>
      ) : (
        // Remount per task so each opens with its own content.
        <Editor key={taskId} initialContent={initialContent} theme={theme} onChange={save} />
      )}
    </section>
  )
}
