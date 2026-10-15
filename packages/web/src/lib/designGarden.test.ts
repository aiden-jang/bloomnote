import { describe, expect, it } from 'vitest'
import { friendlyError } from './designGarden'

describe('friendlyError', () => {
  /*
   * The branch order is load-bearing, and this is the test that holds it.
   *
   * Gemini reports overload as a 503, and the generic 5xx branch further down matches `\b5\d{2}\b`,
   * so whichever runs first wins. Get it wrong and somebody waiting on an upstream hiccup is told
   * bloomnote broke, which sends them to the wrong conclusion about whose fault it is and whether
   * waiting will help.
   */
  it('blames Gemini, not the backend, for an upstream 503', () => {
    expect(friendlyError('Request failed (503): model is currently overloaded')).toMatch(/gemini/i)
    expect(friendlyError('[GoogleGenerativeAI Error]: 503 high demand')).toMatch(/gemini/i)
    expect(friendlyError('generativelanguage.googleapis.com returned 503')).toMatch(/gemini/i)
  })

  it('still reports a plain backend 5xx as our own', () => {
    expect(friendlyError('Request failed (500)')).toMatch(/on our end/i)
    expect(friendlyError('Bad Gateway')).toMatch(/on our end/i)
  })

  /*
   * The other order that matters. A per-day quota does not clear until midnight Pacific, so it must
   * never be phrased as "try again in a minute" the way the rate limit is.
   */
  it('tells a per-day quota apart from a per-minute rate limit', () => {
    expect(friendlyError('429 rate limit exceeded')).toMatch(/about a minute/i)
    expect(friendlyError('RESOURCE_EXHAUSTED: quota exceeded')).toMatch(/tomorrow/i)
    expect(friendlyError('GenerateContent free tier quota')).toMatch(/tomorrow/i)
  })

  it('names the recoverable cases in the caller-can-act sense', () => {
    expect(friendlyError('Failed to fetch')).toMatch(/connection/i)
    expect(friendlyError('the request timed out')).toMatch(/longer than expected/i)
    expect(friendlyError('404 not found for api version v1beta')).toMatch(/model isn/i)
    expect(friendlyError('GEMINI_API_KEY is missing')).toBe(
      'garden growing is temporarily unavailable. Your note is still here; try again later.',
    )
    expect(friendlyError('invalid garden: flowers[1].petalCount out of range')).toMatch(/confused/i)
    expect(friendlyError('stream ended without a garden')).toMatch(/didn't return a garden/i)
  })

  /*
   * A model error can carry pieces of the sender's note or the system prompt, and this string goes
   * on screen. Anything long or stack-shaped is replaced rather than shown.
   */
  it('never shows a stack trace or a long raw message', () => {
    const stack = 'TypeError: x is not a function\n    at design (/app/src/index.ts:12:3)'
    expect(friendlyError(stack)).toBe('something went wrong. give it another try in a moment.')
    expect(friendlyError('e'.repeat(200))).toBe('something went wrong. give it another try in a moment.')
    expect(friendlyError('Exception in thread')).toBe(
      'something went wrong. give it another try in a moment.',
    )
  })

  it('passes a short message that already reads like a sentence straight through', () => {
    // The backend writes its own validation copy, and it is already user-facing.
    expect(friendlyError('keep it under 400 chars.')).toBe('keep it under 400 chars.')
  })
})
