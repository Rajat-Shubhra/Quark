import { z } from 'zod'

/**
 * The agent's contract. Everything the UI renders comes from here — it never
 * parses prose. Anything that doesn't validate is treated as a failed run
 * rather than passed along half-understood.
 */
export const classificationSchema = z.enum(['CAN_DO', 'PARTIAL', 'HUMAN_ONLY'])
export type Classification = z.infer<typeof classificationSchema>

export const agentActionSchema = z.object({
  tool: z.string(),
  // The prompt asks for "what you passed", which may be a bare string or an
  // object depending on the tool.
  input: z.union([z.string(), z.record(z.string(), z.unknown())]).default(''),
  result: z.string().default(''),
})
export type AgentAction = z.infer<typeof agentActionSchema>

// Arrays and strings get defaults: the prompt says never omit a field, but a
// missing `plan` shouldn't sink an otherwise usable answer. `classification`
// and `confirmation_required` have no defaults on purpose — those two decide
// what the UI shows and whether we gate, so a malformed one must fail loudly.
export const agentResponseSchema = z.object({
  understanding: z.string().default(''),
  classification: classificationSchema,
  reasoning: z.string().default(''),
  plan: z.array(z.string()).default([]),
  actions_taken: z.array(agentActionSchema).default([]),
  confirmation_required: z.boolean(),
  confirmation_prompt: z.string().default(''),
  human_steps: z.array(z.string()).default([]),
  result_summary: z.string().default(''),
})
export type AgentResponse = z.infer<typeof agentResponseSchema>

/**
 * Models wrap JSON in code fences or add a sentence of preamble often enough
 * that trusting them not to is a bug waiting to happen. Take everything
 * between the first { and the last }.
 */
export function extractJson(raw: string): unknown {
  const start = raw.indexOf('{')
  const end = raw.lastIndexOf('}')
  if (start === -1 || end === -1 || end < start) {
    throw new Error(`No JSON object found in model output: ${raw.slice(0, 200)}`)
  }
  return JSON.parse(raw.slice(start, end + 1))
}

export function parseAgentResponse(raw: string): AgentResponse {
  return agentResponseSchema.parse(extractJson(raw))
}
