import { describe, expect, it } from 'vitest'
import { friendlyError } from './designGarden'
const retry = 'Couldn’t grow the garden right now. Your note is still here. Try again.'
describe('friendlyError', () => {
  it('distinguishes overload from a generic backend failure', () => {
    for (const raw of [
      'Request failed (503): model is currently overloaded',
      '[GoogleGenerativeAI Error]: 503 high demand',
      'generativelanguage.googleapis.com returned 503',
    ])
      expect(friendlyError(raw)).toBe('Garden growing is busy right now. Try again in a moment.')
    expect(friendlyError('Request failed (500)')).toBe(retry)
    expect(friendlyError('Bad Gateway')).toBe(retry)
  })
  it('does not promise a short wait for an exhausted daily quota', () => {
    expect(friendlyError('429 rate limit exceeded')).toMatch(/wait a little/i)
    for (const raw of [
      'RESOURCE_EXHAUSTED: quota exceeded',
      '[GoogleGenerativeAI Error]: 429 quota exceeded',
      'GenerateContent free tier quota',
      'bloomnote is at capacity for today. try again tomorrow.',
    ])
      expect(friendlyError(raw)).toBe(
        'Garden growing has reached its daily limit. Your note is still here. Try again later.',
      )
  })
  it('gives recovery steps without asking the writer to fix a model response', () => {
    expect(friendlyError('Failed to fetch')).toMatch(/connection/i)
    expect(friendlyError('the request timed out')).toBe(
      'That took too long. Your note is still here. Try again.',
    )
    expect(friendlyError('404 not found for api version v1beta')).toBe(retry)
    expect(friendlyError('GEMINI_API_KEY is missing')).toMatch(/temporarily unavailable/)
    for (const raw of [
      'invalid garden: flowers[1].petalCount out of range',
      'stream ended without a garden',
      'that one came back empty-handed. try again?',
    ])
      expect(friendlyError(raw)).toBe('Couldn’t finish this garden. Your note is still here. Try again.')
  })
  it('never displays unknown raw prose, even when short and sentence-shaped', () => {
    for (const raw of [
      'TypeError: x is not a function',
      'e'.repeat(200),
      'Exception in thread',
      'failed on note: meet me at 8, love you.',
    ])
      expect(friendlyError(raw)).toBe(retry)
  })
  it('passes through only known input validation', () => {
    for (const text of ['write something first.', 'keep it under 400 chars.', 'who is this for?'])
      expect(friendlyError(text)).toBe(text)
  })
})
