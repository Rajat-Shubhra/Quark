import { writeNote } from './writeNote'
import { createSubtasks } from './createSubtasks'
import { draftEmail, draftDocument } from './drafts'
import { webSearch } from './webSearch'
import type { Tool } from './types'

export type { Tool, ToolContext } from './types'

/**
 * The agent's entire capability. It classifies CAN_DO / PARTIAL / HUMAN_ONLY
 * relative to exactly this list, so adding an entry here without implementing
 * it would make it overclaim.
 */
export const TOOLS: Record<string, Tool> = {
  [writeNote.name]: writeNote,
  [createSubtasks.name]: createSubtasks,
  [draftEmail.name]: draftEmail,
  [draftDocument.name]: draftDocument,
  [webSearch.name]: webSearch,
}

/** Read-only tools run before the confirmation gate, and feed a second turn. */
export const READ_ONLY_TOOLS = new Set([webSearch.name])

/** Rendered into the system prompt's tool section — keep it in step with TOOLS. */
export const TOOL_DESCRIPTIONS = [
  '- web_search(query): search the web and get a short summary with sources.',
  '  If you need facts you do not have, request this first: the results are handed',
  '  back to you and you then produce your final answer using them.',
  '  You MUST use it whenever the task depends on facts that change over time —',
  '  rules, fees, deadlines, entry requirements, prices, opening hours, current events.',
  '  Answering those from memory is fabrication: your training data may be out of date',
  '  and you cannot tell. If a search fails or you did not run one, do not present such',
  '  facts as current — say what you could not verify and leave checking it to the human.',
  '',
  '- write_note(content): replace the note attached to this task with `content`.',
  '  The task is already known, so pass ONLY the note text as `input` — do not include',
  '  the task_id, and do not wrap it in quotes or a JSON object.',
  '  Use real line breaks (not the characters backslash-n), "# " / "## " for headings,',
  '  "- " for bullets, "1. " for numbered steps, and **double asterisks** for bold.',
  '',
  '- create_subtasks(items): add subtasks under this task on the board.',
  '  Pass `input` as a JSON array of short titles: ["First step", "Second step"].',
  '',
  '- draft_email(to, subject, body): save an email draft against this task.',
  '  Pass `input` as a JSON object with all three fields:',
  '  {"to": "...", "subject": "...", "body": "the complete email text"}',
  '  It is ONLY ever a draft — you cannot send email, and nothing you write here',
  '  reaches anyone. The user sends it themselves.',
  '',
  '- draft_document(title, content): save a longer document draft against this task.',
  '  Pass `input` as a JSON object with BOTH fields:',
  '  {"title": "...", "content": "the complete document text"}',
  '  `content` must be the whole document — the actual script, essay or outline the',
  '  user asked for, written out in full. Passing only a title saves nothing useful.',
  '',
  'You have no other tools. You cannot send email, post anything, browse or log into',
  "the user's accounts, touch files on their computer, or act in the physical world.",
  'Tasks needing those are PARTIAL at best — do the part you can and leave the rest as',
  'human_steps.',
].join('\n')
