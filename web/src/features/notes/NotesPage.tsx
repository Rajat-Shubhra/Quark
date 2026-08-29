import { useEffect, useState } from 'react'
import type { Block } from '@blocknote/core'
import { NoteEditor, SAVE_LABEL, useColorScheme } from './NoteEditor'
import { usePages } from './usePages'

/** Notes that stand on their own, alongside the board. */
export function NotesPage({ userId }: { userId: string }) {
  const { pages, loading, error, saveState, createPage, renamePage, deletePage, savePage } =
    usePages(userId)
  const [openId, setOpenId] = useState<string | null>(null)
  const [confirmingDelete, setConfirmingDelete] = useState<string | null>(null)
  const theme = useColorScheme()

  // Open the most recent page once they've loaded.
  useEffect(() => {
    if (!openId && pages.length > 0) setOpenId(pages[0].id)
  }, [pages, openId])

  const open = pages.find((page) => page.id === openId)

  async function handleCreate() {
    const page = await createPage()
    if (page) setOpenId(page.id)
  }

  return (
    <div className="pages">
      <aside className="page-list">
        <div className="page-list-header">
          <h3>Notes</h3>
          <button type="button" onClick={handleCreate}>
            New
          </button>
        </div>

        {loading ? (
          <p className="muted">Loading…</p>
        ) : pages.length === 0 ? (
          <p className="muted">No notes yet. Create one to start writing.</p>
        ) : (
          <ul>
            {pages.map((page) => (
              <li key={page.id}>
                <button
                  type="button"
                  className={page.id === openId ? 'active' : ''}
                  onClick={() => setOpenId(page.id)}
                >
                  <span className="page-name">{page.title || 'Untitled'}</span>
                  <span className="page-date">
                    {new Date(page.updated_at).toLocaleDateString()}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </aside>

      <section className="page-body">
        {error && <p className="message error">{error}</p>}

        {open ? (
          <>
            <div className="page-body-header">
              <input
                className="page-title-input"
                aria-label="Note title"
                value={open.title}
                placeholder="Untitled"
                onChange={(e) => void renamePage(open.id, e.target.value)}
              />
              <span className={`save-state ${saveState}`}>{SAVE_LABEL[saveState]}</span>
              {confirmingDelete === open.id ? (
                <>
                  <button
                    type="button"
                    className="danger"
                    onClick={() => {
                      void deletePage(open.id)
                      setConfirmingDelete(null)
                      setOpenId(null)
                    }}
                  >
                    Yes, delete
                  </button>
                  <button type="button" onClick={() => setConfirmingDelete(null)}>
                    Cancel
                  </button>
                </>
              ) : (
                <button type="button" className="danger" onClick={() => setConfirmingDelete(open.id)}>
                  Delete
                </button>
              )}
            </div>

            <div className="note">
              {/* Remount per page so each opens with its own content. */}
              <NoteEditor
                key={open.id}
                initialContent={open.content?.length ? open.content : undefined}
                theme={theme}
                onChange={(blocks: Block[]) => savePage(open.id, blocks)}
              />
            </div>
          </>
        ) : (
          !loading && <p className="muted">Select a note, or create one.</p>
        )}
      </section>
    </div>
  )
}
