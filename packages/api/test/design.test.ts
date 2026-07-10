import { describe, expect, test } from 'vitest';
import { buildPrompt, validateBody } from '../src/designGarden.js';
import { validateGarden } from '../src/prompt.js';

describe('design-garden validation', () => {
  test('rejects a too-short message or missing recipient', () => {
    expect(validateBody({ message: 'hi', recipient: 'Mia' }).ok).toBe(false);
    expect(validateBody({ message: 'a real note here', recipient: '' }).ok).toBe(false);
  });

  test('accepts and normalizes a known occasion/mood, drops unknown', () => {
    const r = validateBody({
      message: 'happy birthday, you brilliant weirdo',
      recipient: 'Mia',
      from: 'Sam',
      occasion: 'birthday',
      mood: 'playful',
    });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.body.occasion).toBe('birthday');
    expect(r.body.from).toBe('Sam');
    expect(buildPrompt(r.body)).toContain('To: Mia');

    const unknown = validateBody({ message: 'a real note here', recipient: 'X', occasion: 'wedding' });
    expect(unknown.ok && unknown.body.occasion).toBeUndefined();
  });

  test('validateGarden rejects the wrong flower count', () => {
    expect(() => validateGarden({ bouquet_note: 'x', flowers: [] })).toThrow();
    expect(() => validateGarden({ flowers: [{ name: 'Rose' }] })).toThrow();
  });
});
