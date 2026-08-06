import { describe, expect, test } from 'vitest';
import { buildPrompt, validateBody } from '../src/designGarden.js';
import { FLOWER_DESIGN_FUNCTION, SYSTEM_PROMPT, validateGarden } from '../src/prompt.js';

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

/**
 * The prompt asks the model not to use em dashes in the copy it writes, because an em dash in a
 * short heartfelt line is the clearest tell that a machine wrote it, and the bouquet note is the
 * one thing a recipient reads in the sender's voice.
 *
 * The prompt also can't use them itself. A model mirrors the register of its instructions, so a
 * system prompt written in em dashes was quietly undercutting the rule it now states. This guards
 * both halves: the instruction has to be present, and the prose around it has to follow it.
 */
describe('prompt style', () => {
  test('forbids em dashes in the generated copy', () => {
    expect(SYSTEM_PROMPT.toLowerCase()).toContain('never use an em dash');
  });

  test('the prompt itself contains none', () => {
    expect(SYSTEM_PROMPT).not.toContain('—');
  });

  test('does not tell the model to invent flower names', () => {
    // The tool description used to say "Invent the flowers from scratch" while the system prompt
    // said the opposite, in the same request.
    const schema = JSON.stringify(FLOWER_DESIGN_FUNCTION).toLowerCase();
    expect(schema).not.toContain('invent the flowers');
    expect(SYSTEM_PROMPT).toContain('Never invent names');
  });
});
