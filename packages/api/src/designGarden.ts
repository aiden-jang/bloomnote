import type { WindowResult } from './counters.js'
import type { Env } from './env.js'
import { FLOWER_DESIGN_FUNCTION, SYSTEM_PROMPT, validateGarden, type ValidatedGarden } from './prompt.js'

// Mirrors src/lib/occasions.ts and moods.ts on the web. Duplicated so the API doesn't reach into
// the frontend tree; if either list changes, update both.
const KNOWN_OCCASIONS: Record<string, string> = {
  'just-because': 'Just because',
  birthday: 'Birthday',
  'thank-you': 'Thank you',
  anniversary: 'Anniversary',
  congrats: 'Congratulations',
  'get-well': 'Get well soon',
  sympathy: 'Sympathy',
}

const KNOWN_MOODS: Record<string, string> = {
  tender:
    'Tender tone. Affection, intimacy, quiet warmth. Use soft pastels (pale pinks, ivories, washed lavenders). Petal shapes should lean round and small. The bouquet note should read like a held breath.',
  playful:
    'Playful tone. Joy, mischief, inside jokes. Use brighter palettes (warm yellows, coral pinks, unexpected pops of color). Petal shapes can mix (star, round, elongated). The bouquet note should have the energy of a wink.',
  wistful:
    'Wistful tone. Missing someone, sentimental, slightly bittersweet. Use muted palettes (dusty blues, faded mauves, soft sages). Petal shapes should lean elongated and bell. The bouquet note should feel like the moment before remembering.',
  celebratory:
    'Celebratory tone. Joy, achievement, big energy. Use vivid palettes (golden yellows, deep magentas, hot oranges). Higher petal counts, taller stems. The bouquet note should have lift to it, like raising a glass.',
  steady:
    'Steady tone. Solidarity, quiet support, "I am here." Use grounded palettes (forest greens, terracotta, deep cream). Petal shapes should be round and consistent across the bouquet. The bouquet note should read like a hand on the shoulder.',
}

export interface DesignBody {
  message: string
  recipient: string
  from?: string
  occasion?: string
  mood?: string
}

export function validateBody(raw: unknown): { ok: true; body: DesignBody } | { ok: false; error: string } {
  if (!raw || typeof raw !== 'object') return { ok: false, error: 'Body must be JSON.' }
  const body = raw as Record<string, unknown>
  const message = typeof body.message === 'string' ? body.message.trim() : ''
  if (message.length < 4) return { ok: false, error: 'write something first.' }
  if (message.length > 400) return { ok: false, error: 'keep it under 400 chars.' }
  const recipient = typeof body.recipient === 'string' ? body.recipient.trim().slice(0, 60) : ''
  if (recipient.length < 1) return { ok: false, error: 'who is this for?' }
  const from = typeof body.from === 'string' ? body.from.trim().slice(0, 60) : ''
  const occasionRaw = typeof body.occasion === 'string' ? body.occasion : ''
  const moodRaw = typeof body.mood === 'string' ? body.mood : ''
  const out: DesignBody = { message, recipient }
  if (from) out.from = from
  // Object.hasOwn, not `in`, or '__proto__' passes the allowlist it exists to enforce.
  if (Object.hasOwn(KNOWN_OCCASIONS, occasionRaw)) out.occasion = occasionRaw
  if (Object.hasOwn(KNOWN_MOODS, moodRaw)) out.mood = moodRaw
  return { ok: true, body: out }
}

/** Fixed, not a random nonce: the eval and the tests need the same inputs to build the same
    prompt. Any copy of it inside the note is stripped below, so a note cannot close its own fence. */
export const NOTE_FENCE = '-----NOTE-----'

/** A name with a newline in it would otherwise write its own `Occasion:` line into the labelled
    block above the note. */
function oneLine(value: string): string {
  return value.replace(/\s+/g, ' ').trim()
}

export function buildPrompt(body: DesignBody): string {
  const fromLine = body.from ? `From: ${oneLine(body.from)}\n` : ''
  const occasionLine = body.occasion ? `Occasion: ${KNOWN_OCCASIONS[body.occasion]}\n` : ''
  const moodLine = body.mood ? `Mood guidance: ${KNOWN_MOODS[body.mood]}\n` : ''
  const note = body.message.split(NOTE_FENCE).join('')
  return (
    `${fromLine}To: ${oneLine(body.recipient)}\n${occasionLine}${moodLine}\n` +
    `Their note, between the markers:\n${NOTE_FENCE}\n${note}\n${NOTE_FENCE}`
  )
}

/** Gemini's free tier for this key: 5 requests a minute, 20 a day, both per project. */
export const PER_IP_PER_MINUTE = 5
export const DAILY_CAP = 15
const DAILY_BUDGET_INSTANCE = 'daily-budget'

export type BudgetResult =
  { ok: true } | { ok: false; status: 429 | 503; retryAfter: number; message: string }

export async function checkBudget(env: Env, ip: string): Promise<BudgetResult> {
  try {
    const perIp = env.COUNTERS.get(env.COUNTERS.idFromName(ip))
    const burst = await perIp.bump('design', PER_IP_PER_MINUTE, 60)
    if (!burst.ok) {
      return {
        ok: false,
        status: 429,
        retryAfter: burst.retryAfter,
        message: 'Rate limit reached. Give it a minute.',
      }
    }
  } catch {
    // One user's request is not worth failing over an unreachable counter.
  }

  // Fails CLOSED, unlike the burst above: this cap is the only bound on what Gemini costs.
  let spend: WindowResult
  try {
    const daily = env.COUNTERS.get(env.COUNTERS.idFromName(DAILY_BUDGET_INSTANCE))
    spend = await daily.bump('design-daily', DAILY_CAP, 86_400)
  } catch {
    spend = { ok: false, retryAfter: 3600 }
  }
  if (!spend.ok) {
    return {
      ok: false,
      status: 503,
      retryAfter: spend.retryAfter,
      message: 'bloomnote is at capacity for today. try again tomorrow.',
    }
  }
  return { ok: true }
}

interface GeminiResponse {
  candidates?: { content?: { parts?: { functionCall?: { name?: string; args?: unknown } }[] } }[]
}

// Gemini intermittently returns 503 "model overloaded" under load, so a single attempt surfaces
// a spurious error. Retry those a couple of times; anything else still throws.
const RETRYABLE_STATUS = new Set([429, 500, 502, 503, 504])
const MAX_ATTEMPTS = 3
// fetch has no default timeout, so cap the call or a hung request leaves the user staring at
// "growing…" forever.
const REQUEST_TIMEOUT_MS = 20_000

async function isDailyQuotaExhausted(res: Response): Promise<boolean> {
  try {
    const body = (await res.clone().json()) as {
      error?: { details?: { '@type'?: string; violations?: { quotaId?: string }[] }[] }
    }
    return (body.error?.details ?? []).some((d) =>
      (d.violations ?? []).some((v) => (v.quotaId ?? '').includes('PerDay')),
    )
  } catch {
    return false
  }
}

export async function generateGarden(apiKey: string, userPrompt: string): Promise<ValidatedGarden> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`
  const body = JSON.stringify({
    systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
    contents: [{ role: 'user', parts: [{ text: userPrompt }] }],
    tools: [{ functionDeclarations: [FLOWER_DESIGN_FUNCTION] }],
    toolConfig: { functionCallingConfig: { mode: 'ANY', allowedFunctionNames: ['design_garden'] } },
  })

  for (let attempt = 0; ; attempt++) {
    let res: Response
    try {
      res = await fetch(url, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body,
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      })
    } catch {
      if (attempt >= MAX_ATTEMPTS - 1) {
        throw new Error('the garden took too long to grow. give it another go.')
      }
      await new Promise((resolve) => setTimeout(resolve, 500 * (attempt + 1)))
      continue
    }
    if (res.ok) {
      const data = (await res.json()) as GeminiResponse
      const parts = data.candidates?.[0]?.content?.parts ?? []
      const call = parts.map((p) => p.functionCall).find((fc) => fc?.name === 'design_garden')
      if (!call) throw new Error('that one came back empty-handed. try again?')
      return validateGarden(call.args)
    }
    // A 429 comes in two flavours that want opposite handling. A per-minute burst clears in
    // seconds and is worth retrying; the per-day project quota does not clear until midnight
    // Pacific, so retrying only spends two more seconds to fail identically, and telling the user
    // to "try again" is actively wrong. Gemini distinguishes them in the error body.
    if (res.status === 429 && (await isDailyQuotaExhausted(res))) {
      throw new Error('bloomnote is at capacity for today. try again tomorrow.')
    }
    if (attempt >= MAX_ATTEMPTS - 1 || !RETRYABLE_STATUS.has(res.status)) {
      throw new Error(`too many people planting at once (${res.status}). give it a second.`)
    }
    await new Promise((resolve) => setTimeout(resolve, 500 * (attempt + 1)))
  }
}
