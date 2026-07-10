import { describe, expect, test } from 'vitest';
import { buildPrompt, checkBudget, validateBody } from '../src/designGarden.js';
import { validateGarden } from '../src/prompt.js';
import { testEnv } from './helpers.js';

// A well-formed flower the way Gemini's function call is supposed to return it.
const flower = () => ({
  name: 'Rose',
  meaning: 'steady love',
  petalColors: ['#e11d48', '#f43f5e', '#fb7185'],
  centerColor: '#facc15',
  stemColor: '#16a34a',
  petalShape: 'round',
  petalCount: 8,
  stemHeight: 90,
});
const garden = (n = 3) => ({ bouquet_note: 'a little garden for you', flowers: Array.from({ length: n }, flower) });

describe('validateGarden (model-output guard)', () => {
  test('accepts a well-formed garden', () => {
    const g = validateGarden(garden(3));
    expect(g.flowers).toHaveLength(3);
    expect(g.bouquet_note).toContain('garden');
  });

  test('rejects fewer than 3 or more than 5 flowers', () => {
    expect(() => validateGarden(garden(2))).toThrow(/Expected/);
    expect(() => validateGarden(garden(6))).toThrow(/Expected/);
  });

  test('rejects a non-array flowers field', () => {
    expect(() => validateGarden({ bouquet_note: 'x', flowers: 'nope' })).toThrow(/not an array/);
  });

  test('rejects a missing bouquet_note', () => {
    expect(() => validateGarden({ flowers: garden(3).flowers })).toThrow(/bouquet_note/);
  });

  test('rejects an out-of-range petalCount', () => {
    const bad = garden(3);
    bad.flowers[0].petalCount = 99; // schema allows 5–14
    expect(() => validateGarden(bad)).toThrow(/petalCount/);
  });

  test('rejects a bad hex color and an unknown petal shape', () => {
    const badHex = garden(3);
    badHex.flowers[0].centerColor = 'red';
    expect(() => validateGarden(badHex)).toThrow(/centerColor/);

    const badShape = garden(3);
    badShape.flowers[0].petalShape = 'spiky';
    expect(() => validateGarden(badShape)).toThrow(/shape/);
  });
});

describe('validateBody (request guard)', () => {
  test('accepts a valid body and keeps known occasion/mood', () => {
    const r = validateBody({ message: 'thinking of you today', recipient: 'Sam', from: 'Jo', occasion: 'birthday', mood: 'tender' });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.body.recipient).toBe('Sam');
    expect(r.body.from).toBe('Jo');
    expect(r.body.occasion).toBe('birthday');
    expect(r.body.mood).toBe('tender');
  });

  test('drops unknown occasion/mood but still succeeds', () => {
    const r = validateBody({ message: 'thinking of you', recipient: 'Sam', occasion: 'quinceanera', mood: 'zzz' });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.body.occasion).toBeUndefined();
    expect(r.body.mood).toBeUndefined();
  });

  test('rejects a too-short message, missing recipient, and non-object body', () => {
    expect(validateBody({ message: 'hi', recipient: 'Sam' }).ok).toBe(false);
    expect(validateBody({ message: 'a real message', recipient: '' }).ok).toBe(false);
    expect(validateBody('nope').ok).toBe(false);
  });
});

describe('buildPrompt', () => {
  test('includes recipient, sender, note, and occasion guidance', () => {
    const p = buildPrompt({ message: 'you carried me this year', recipient: 'Jordan', from: 'Sam', occasion: 'thank-you', mood: 'tender' });
    expect(p).toContain('To: Jordan');
    expect(p).toContain('From: Sam');
    expect(p).toContain('you carried me this year');
    expect(p).toContain('Thank you'); // KNOWN_OCCASIONS['thank-you']
  });
});

describe('checkBudget (KV cost guard)', () => {
  test('allows up to the per-IP minute limit, then 429s', async () => {
    const ip = `test-${Math.random().toString(36).slice(2)}`;
    for (let i = 0; i < 8; i++) {
      expect((await checkBudget(testEnv, ip)).ok).toBe(true);
    }
    const blocked = await checkBudget(testEnv, ip);
    expect(blocked.ok).toBe(false);
    if (!blocked.ok) expect(blocked.status).toBe(429);
  });
});
