import { env } from '../../env'
import type { Tool } from './types'

const GEMINI_ENDPOINT = 'https://generativelanguage.googleapis.com/v1beta/models'

function readQuery(input: unknown): string {
  if (typeof input === 'string') {
    const text = input.trim()
    if (text.startsWith('{')) {
      try {
        return readQuery(JSON.parse(text))
      } catch {
        // fall through
      }
    }
    return text.replace(/^query\s*[:=]\s*"?/i, '').replace(/"$/, '')
  }
  if (input && typeof input === 'object') {
    const record = input as Record<string, unknown>
    for (const key of ['query', 'q', 'search', 'text']) {
      if (typeof record[key] === 'string') return record[key] as string
    }
  }
  throw new Error('web_search needs a query string')
}

type GroundingChunk = { web?: { title?: string; uri?: string } }

/**
 * Search via Gemini's Google Search grounding, so no second API key is needed.
 *
 * Grounding has its own (small) free-tier quota, separate from ordinary
 * generation. When it runs out the call fails with 429 — surfaced as a clear
 * message rather than silently returning nothing, so the run records that the
 * search did not happen instead of implying it did.
 */
export const webSearch: Tool = {
  name: 'web_search',

  // Read-only: nothing changes, so nothing to approve.
  async requiresConfirmation() {
    return false
  },

  async describeConsequence(input) {
    return `Search the web for "${readQuery(input)}".`
  },

  async execute(input) {
    const query = readQuery(input)

    const response = await fetch(
      `${GEMINI_ENDPOINT}/${env.GEMINI_MODEL}:generateContent?key=${env.GEMINI_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [
            {
              role: 'user',
              parts: [
                {
                  text:
                    `Search the web and answer concisely, in at most 6 short bullet points: ${query}`,
                },
              ],
            },
          ],
          tools: [{ google_search: {} }],
          generationConfig: { temperature: 0.2 },
        }),
      },
    )

    if (!response.ok) {
      const detail = await response.text()
      console.error(`[web_search] ${response.status}: ${detail.slice(0, 300)}`)
      if (response.status === 429) {
        throw new Error('Web search is out of quota for now, so nothing was searched.')
      }
      throw new Error(`Web search failed (${response.status}).`)
    }

    const body = (await response.json()) as {
      candidates?: {
        content?: { parts?: { text?: string }[] }
        groundingMetadata?: { groundingChunks?: GroundingChunk[] }
      }[]
    }

    const candidate = body.candidates?.[0]
    const text = (candidate?.content?.parts ?? []).map((part) => part.text ?? '').join('').trim()
    if (!text) throw new Error('Web search returned nothing usable.')

    const sources = (candidate?.groundingMetadata?.groundingChunks ?? [])
      .map((chunk) => chunk.web?.title)
      .filter((title): title is string => Boolean(title))
      .slice(0, 4)

    return sources.length > 0 ? `${text}\n\nSources: ${sources.join('; ')}` : text
  },
}
