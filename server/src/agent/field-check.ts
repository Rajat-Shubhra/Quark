// Temporary: check draft field parsing against the shapes seen in real runs.
import { draftEmail, draftDocument } from './tools/drafts'
import type { ToolContext } from './tools/types'

function capture() {
  let saved: Record<string, unknown> = {}
  const supabase = {
    from() {
      return {
        async insert(row: { content: Record<string, unknown> }) {
          saved = row.content
          return { error: null }
        },
      }
    },
  } as unknown as ToolContext['supabase']
  return { ctx: { supabase, userId: 'u', taskId: 't', taskTitle: 'T', runId: 'r' }, saved: () => saved }
}

const emailCases: [string, unknown][] = [
  ['object form', { to: 'dr.mensah@uni.ac.uk', subject: 'Reschedule Thursday', body: 'Dear Dr Mensah,\n\nCould we move it?\n\nThanks' }],
  ['one packed line', 'to: Dr. Mensah, subject: Request to Reschedule Meeting - Thursday Clash, body: Dear Dr. Mensah, I am writing to ask...'],
  ['json string', '{"to":"a@b.com","subject":"Hi","body":"Line one\\nLine two"}'],
]

for (const [label, input] of emailCases) {
  const { ctx, saved } = capture()
  await draftEmail.execute(input, ctx)
  const c = saved()
  console.log(`--- email: ${label} ---`)
  console.log('  to:     ', JSON.stringify(c.to))
  console.log('  subject:', JSON.stringify(c.subject))
  console.log('  body:   ', JSON.stringify(String(c.body).slice(0, 70)))
}

const { ctx, saved } = capture()
await draftDocument.execute('title: Reading list, content: # Sources\n- Kolb 1984\n- Schon 1983', ctx)
console.log('\n--- document: packed line ---')
console.log('  title:  ', JSON.stringify(saved().title))
console.log('  content:', JSON.stringify(String(saved().content).slice(0, 70)))
