// Serverless handler that turns a free-text recipient description into a
// structured garden of 3–5 invented flowers, using Gemini's function
// calling to guarantee a valid schema.
//
// Architecture decisions, in case you're reading this in a code review:
//
// 1. Why Gemini? It has a genuinely free API tier (no credit card,
//    1500 requests/day on 2.0 Flash). For a side-project demo where
//    the URL might be shared with strangers, "no risk of accidental
//    bill" is worth more than a small quality edge. The schema-driven
//    approach below would work identically against Claude or GPT-4o
//    with ~30 lines of changes to this file (see README → swapping
//    providers).
//
// 2. Function calling, not "give me JSON in text." With a function
//    schema + mode=ANY we get validated, typed input back from the
//    model with no parsing cruft. Forcing function-call mode removes
//    the "should I answer in prose?" failure mode entirely.
//
// 3. Streaming. A creative generation call on Gemini 2.0 Flash is
//    typically 3–8 seconds; streaming lets us surface progress to the
//    UI as chunks arrive rather than block-then-render.
//
// 4. Schema validation. Gemini's schema subset can't enforce regex on
//    hex colors or strict array bounds. We validate post-hoc in
//    api/prompt.ts → validateGarden() and surface a useful error if
//    the model returns something off-shape.
//
// 5. The handler is written against the Web standard Request/Response
//    pair, not Vercel/Express-specific types. That way it runs
//    unchanged under (a) Vercel Edge, (b) Vite's dev middleware via
//    the adapter in vite.config.ts, or (c) any other host that speaks
//    fetch.
//
// 6. Rate limiting is in-memory and per-IP. For a public deployment
//    you'd swap this for Vercel KV / Upstash. Kept minimal here to
//    avoid pulling in a stateful dependency for a demo.

import {
  GoogleGenerativeAI,
  FunctionCallingMode,
  type FunctionCall,
} from '@google/generative-ai'
import { FLOWER_DESIGN_FUNCTION, SYSTEM_PROMPT, validateGarden } from './prompt'

export const config = { runtime: 'edge' }

// --- Rate limiting -------------------------------------------------------

const RATE_LIMIT_PER_MINUTE = 8
const rateBuckets = new Map<string, { count: number; resetAt: number }>()

function rateLimit(ip: string): { allowed: boolean; retryAfter: number } {
  const now = Date.now()
  const bucket = rateBuckets.get(ip)
  if (!bucket || bucket.resetAt < now) {
    rateBuckets.set(ip, { count: 1, resetAt: now + 60_000 })
    return { allowed: true, retryAfter: 0 }
  }
  if (bucket.count >= RATE_LIMIT_PER_MINUTE) {
    return { allowed: false, retryAfter: Math.ceil((bucket.resetAt - now) / 1000) }
  }
  bucket.count++
  return { allowed: true, retryAfter: 0 }
}

// --- Request body --------------------------------------------------------
//
// The shape mirrors the form the user actually fills out: a note they
// wrote (message), addressed to someone (recipient), from themselves
// (from). The AI's job is to read the note as the user wrote it and
// infer everything else.

interface RequestBody {
  message: string
  recipient: string
  from?: string
}

function validateBody(raw: unknown): { ok: true; body: RequestBody } | { ok: false; error: string } {
  if (!raw || typeof raw !== 'object') return { ok: false, error: 'Body must be JSON.' }
  const body = raw as Record<string, unknown>
  const message = typeof body.message === 'string' ? body.message.trim() : ''
  if (message.length < 4) return { ok: false, error: 'Write a note first — even a short one.' }
  if (message.length > 400) return { ok: false, error: 'Please keep your note under 400 characters.' }
  const recipient = typeof body.recipient === 'string' ? body.recipient.trim().slice(0, 60) : ''
  if (recipient.length < 1) return { ok: false, error: 'Who is this for?' }
  const from = typeof body.from === 'string' ? body.from.trim().slice(0, 60) : undefined
  return { ok: true, body: { message, recipient, from: from || undefined } }
}

// --- SSE helpers ---------------------------------------------------------

function sseLine(event: string, data: unknown): string {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`
}

// --- Handler -------------------------------------------------------------

export default async function handler(req: Request): Promise<Response> {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 })
  }

  const ip =
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    req.headers.get('x-real-ip') ||
    'unknown'

  const rl = rateLimit(ip)
  if (!rl.allowed) {
    return new Response(
      JSON.stringify({ error: `Rate limit reached. Try again in ${rl.retryAfter}s.` }),
      { status: 429, headers: { 'Content-Type': 'application/json', 'Retry-After': String(rl.retryAfter) } },
    )
  }

  let raw: unknown
  try {
    raw = await req.json()
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON.' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const parsed = validateBody(raw)
  if (!parsed.ok) {
    return new Response(JSON.stringify({ error: parsed.error }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const apiKey = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env?.GEMINI_API_KEY
  if (!apiKey) {
    return new Response(
      JSON.stringify({ error: 'Server is missing GEMINI_API_KEY. Set it in your environment.' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } },
    )
  }

  const client = new GoogleGenerativeAI(apiKey)
  const model = client.getGenerativeModel({
    // Current GA mid-tier model. `gemini-2.5-flash-lite` is the
    // cheaper option if you're rate-limited; `gemini-2.5-pro` is the
    // higher-quality option if you've upgraded past the free tier.
    model: 'gemini-2.5-flash',
    systemInstruction: SYSTEM_PROMPT,
    tools: [{ functionDeclarations: [FLOWER_DESIGN_FUNCTION] }],
    // ANY = the model must call one of the declared functions. With
    // only one function declared this is effectively "must call
    // design_garden", which is what we want.
    toolConfig: {
      functionCallingConfig: {
        mode: FunctionCallingMode.ANY,
        allowedFunctionNames: ['design_garden'],
      },
    },
  })

  // The user wrote a real note. Hand it to the AI exactly as written;
  // let the model do the inference. `from` is included when present so
  // the bouquet note can be written naturally in the sender's voice.
  const fromLine = parsed.body.from ? `From: ${parsed.body.from}\n` : ''
  const userPrompt = `${fromLine}To: ${parsed.body.recipient}\n\nTheir note:\n${parsed.body.message}`

  // Stream Gemini's response and forward progress events to the client
  // via SSE. We close the stream as soon as we have the validated tool
  // call; if anything goes wrong we emit an `error` event so the
  // frontend can surface it cleanly instead of dying on an HTTP-level
  // failure.
  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder()
      const send = (event: string, data: unknown) => controller.enqueue(encoder.encode(sseLine(event, data)))

      try {
        send('start', { ok: true })

        const streamResp = await model.generateContentStream({
          contents: [{ role: 'user', parts: [{ text: userPrompt }] }],
        })

        // Progress signaling. We can't peek into the function-call
        // arguments mid-stream (Gemini returns them assembled, not as
        // partial JSON deltas), so we proxy "thinking" on stream start
        // and update progress when the final function-call arrives.
        // For Gemini 2.0 Flash this whole call is fast enough (3–8s)
        // that a single status update is fine UX-wise.
        send('thinking', {})

        let lastChunkAt = Date.now()
        for await (const chunk of streamResp.stream) {
          lastChunkAt = Date.now()
          // We keep the loop alive to ensure backpressure works and
          // so abandoned connections cancel the underlying call.
          // We still extract the function call from the aggregated
          // response below — chunks may carry partial function-call
          // metadata that's only complete on the final chunk.
          void chunk
        }
        void lastChunkAt

        const final = await streamResp.response
        const calls: FunctionCall[] | undefined = final.functionCalls()
        const call = calls?.[0]
        if (!call || call.name !== 'design_garden') {
          send('error', { error: 'The model did not return a garden. Please try again.' })
          controller.close()
          return
        }

        let garden
        try {
          garden = validateGarden(call.args)
        } catch (err) {
          const message = err instanceof Error ? err.message : 'Validation failed.'
          send('error', { error: `The model returned an invalid garden: ${message}` })
          controller.close()
          return
        }

        // Emit progress retroactively so the dots animate to full
        // before "complete" lands — small UI nicety, no extra cost.
        for (let i = 1; i <= garden.flowers.length; i++) {
          send('progress', { designed: i })
        }

        send('complete', {
          garden: {
            bouquet_note: garden.bouquet_note,
            flowers: garden.flowers,
          },
        })
        controller.close()
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error.'
        send('error', { error: message })
        controller.close()
      }
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  })
}
