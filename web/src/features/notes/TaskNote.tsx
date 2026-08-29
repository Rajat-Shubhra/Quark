import { NoteEditor, SAVE_LABEL, useColorScheme } from './NoteEditor'
import { useNote } from './useNote'

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
        <span className={`save-state ${saveState}`}>{SAVE_LABEL[saveState]}</span>
      </div>

      {loading ? (
        <p className="muted">Loading note…</p>
      ) : (
        // Remount per task so each opens with its own content.
        <NoteEditor key={taskId} initialContent={initialContent} theme={theme} onChange={save} />
      )}
    </section>
  )
}
