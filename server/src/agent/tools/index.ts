import { writeNote } from './writeNote'
import type { Tool } from './types'

export type { Tool, ToolContext } from './types'

/**
 * The agent's entire capability. It classifies CAN_DO / PARTIAL / HUMAN_ONLY
 * relative to exactly this list, so adding an entry here without implementing
 * it would make it overclaim.
 */
export const TOOLS: Record<string, Tool> = {
  [writeNote.name]: writeNote,
}

/** Rendered into the system prompt's tool section — keep it in step with TOOLS. */
export const TOOL_DESCRIPTIONS = [
  '- write_note(content): replace the note attached to this task with `content`.',
  '  The task is already known, so pass ONLY the note text as `input` — do not include',
  '  the task_id, and do not wrap it in quotes or a JSON object.',
  '  Use real line breaks (not the characters backslash-n), "# " / "## " for headings,',
  '  "- " for bullets, "1. " for numbered steps, and **double asterisks** for bold.',
  '  This is the only tool that changes anything, and it is the only way you can deliver',
  '  written work to the user.',
  '',
  'You have no other tools. You cannot search the web, send or draft email, create',
  'subtasks, read files, or take any action in the world. Tasks needing those are',
  'PARTIAL at best — do the part you can (thinking, drafting, structuring, planning)',
  'by writing it into the note, and leave the rest as human_steps.',
].join('\n')
