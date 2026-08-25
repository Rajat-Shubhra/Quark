import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import { TOOL_DESCRIPTIONS } from './tools/index'

const repoRoot = fileURLToPath(new URL('../../..', import.meta.url))
const promptPath = path.join(repoRoot, 'task-agent-prompt.md')

const APP_NAME = 'Quark'
const TASK_DOMAIN =
  'student academic tasks: assignments, coursework, revision, reading, deadlines, ' +
  'and emails to professors or university staff'

/**
 * Builds the system prompt from task-agent-prompt.md.
 *
 * The file is the source of truth for the agent's behaviour, so this fills in
 * its placeholders rather than restating them. If the file is edited such that
 * a placeholder disappears, we throw — silently shipping a prompt that still
 * says "[LIST YOUR REAL TOOLS HERE]" would make the model classify against
 * tools it doesn't have.
 */
function buildSystemPrompt(): string {
  const file = readFileSync(promptPath, 'utf8')

  // Everything above this line is provider setup notes addressed to the
  // developer ("read once, then delete"), not instructions for the model.
  const startIndex = file.indexOf('You are the task agent inside')
  if (startIndex === -1) {
    throw new Error('task-agent-prompt.md: could not find the start of the system prompt')
  }
  let prompt = file.slice(startIndex)

  prompt = replaceOrThrow(prompt, '[APP_NAME]', APP_NAME)

  // The domain placeholder carries an inline example, so match the whole thing.
  const domainMatch = prompt.match(/\*\*\[TASK_DOMAIN[^\]]*\]\*\*/)
  if (!domainMatch) {
    throw new Error('task-agent-prompt.md: missing the [TASK_DOMAIN ...] placeholder')
  }
  prompt = prompt.replace(domainMatch[0], `**${TASK_DOMAIN}**`)

  // The tool list placeholder spans several lines inside one bracket pair.
  const toolsMatch = prompt.match(/\[LIST YOUR REAL TOOLS HERE[\s\S]*?\]\n/)
  if (!toolsMatch) {
    throw new Error('task-agent-prompt.md: missing the [LIST YOUR REAL TOOLS HERE ...] placeholder')
  }
  prompt = prompt.replace(toolsMatch[0], `${TOOL_DESCRIPTIONS}\n`)

  return prompt.trim()
}

function replaceOrThrow(text: string, needle: string, value: string): string {
  if (!text.includes(needle)) {
    throw new Error(`task-agent-prompt.md: missing the ${needle} placeholder`)
  }
  return text.replaceAll(needle, value)
}

// Read once at startup so a broken prompt fails on boot, not mid-request.
export const SYSTEM_PROMPT = buildSystemPrompt()

export type TaskContext = {
  id: string
  title: string
  description: string
  status: string
  noteText: string
}

/** The per-run user message: what the agent is being asked to act on. */
export function buildUserMessage(task: TaskContext): string {
  const lines = [
    `Task title: ${task.title}`,
    `Task description: ${task.description || '(none given)'}`,
    `Board status: ${task.status}`,
    `task_id: ${task.id}`,
  ]

  lines.push(
    task.noteText.trim()
      ? `\nThe note currently attached to this task:\n"""\n${task.noteText.slice(0, 4000)}\n"""`
      : '\nThis task has no note content yet.',
  )

  return lines.join('\n')
}
