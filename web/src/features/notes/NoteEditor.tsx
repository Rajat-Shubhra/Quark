import { useEffect, useState } from 'react'
import type { Block } from '@blocknote/core'
import { useCreateBlockNote } from '@blocknote/react'
import { BlockNoteView } from '@blocknote/mantine'
import '@blocknote/core/fonts/inter.css'
import '@blocknote/mantine/style.css'
import type { SaveState } from './useNote'

export function useColorScheme(): 'light' | 'dark' {
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

export const SAVE_LABEL: Record<SaveState, string> = {
  idle: '',
  saving: 'Saving…',
  saved: 'Saved',
  error: 'Save failed',
}

/**
 * The editor itself, shared by task notes and standalone pages. Kept separate
 * because useCreateBlockNote only reads initialContent when it builds the
 * editor — so this must be mounted with its content already loaded.
 */
export function NoteEditor({
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
    <BlockNoteView
      editor={editor}
      theme={theme}
      onChange={() => onChange(editor.document as Block[])}
    />
  )
}
