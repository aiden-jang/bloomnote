/**
 * Prompt quality eval. NOT a unit test, and deliberately not named `*.test.ts` so the normal
 * `pnpm test` and CI never pick it up: every case here spends a real Gemini call and the results
 * are nondeterministic.
 *
 *   pnpm eval          (needs GEMINI_API_KEY in .dev.vars)
 *
 * Why it exists: the prompt is doing real work now, and none of it is visible to a type checker.
 * The rules that matter most are all statistical properties of generated prose, so the only honest
 * way to know they hold is to generate and measure. Before this, a prompt edit could quietly
 * regress the output and the entire suite would stay green.
 *
 * What it checks is the difference between the product's premise and a flower generator: does the
 * garden talk about the note the sender actually wrote? Given "you drove four hours in the rain to
 * sit in a hospital car park", the output should say four hours, or rain, or the car park, and not
 * "thank you for your unwavering support" — a line that would work for a stranger.
 *
 * Each fixture runs several times and needs a majority to pass, because a single sample of a
 * sampled model tells you very little and a hard fail on one unlucky roll would train everyone to
 * ignore this file.
 */
import { beforeAll, describe, expect, test } from 'vitest';
import { readFileSync } from 'node:fs';
import { generateGarden } from '../src/designGarden.js';
import { buildPrompt } from '../src/designGarden.js';
import type { ValidatedGarden } from '../src/prompt.js';

/**
 * Generations per fixture.
 *
 * One by default, which buys the whole run for four requests. That is deliberately stingy: the
 * Gemini free tier allows **20 generateContent requests per day** for this model, so the first
 * version of this file (three runs each, twelve requests) spent most of a day's budget per
 * invocation and then failed halfway through on the quota it had just eaten.
 *
 * Set EVAL_RUNS=3 when a prompt change is worth confirming properly. That is majority-of-three
 * voting, which is real evidence about a sampled model, and it costs twelve of the twenty. Worth
 * it occasionally, not on every edit.
 */
const RUNS = Number(process.env.EVAL_RUNS ?? 1);
/** How many runs must pass a check. A majority, so one unlucky roll isn't a regression. */
const NEEDED = Math.max(1, Math.ceil(RUNS / 2));

/**
 * Minimum spacing between calls, to stay clear of the per-minute limit. Small, because per-minute
 * is not the binding constraint here; the per-day cap is.
 */
const PACE_MS = Number(process.env.EVAL_PACE_MS ?? 4000);

/** One short retry, for a genuine per-minute burst. The per-day cap is handled separately. */
const BURST_WAIT_MS = 15_000;

let nextCallAt = 0;

async function sleep(ms: number): Promise<void> {
  if (ms > 0) await new Promise((r) => setTimeout(r, ms));
}

async function generatePaced(key: string, prompt: string): Promise<ValidatedGarden> {
  for (let attempt = 0; ; attempt++) {
    await sleep(nextCallAt - Date.now());
    nextCallAt = Date.now() + PACE_MS;
    try {
      return await generateGarden(key, prompt);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      // generateGarden already tells the two 429s apart and only uses this wording for the
      // per-day project quota, which will not clear until midnight Pacific. Waiting is pointless
      // and every retry spends another request out of a budget that is already gone.
      if (msg.includes('capacity for today')) {
        throw new Error(
          'Gemini daily free-tier quota (20 requests/day) is exhausted. This is a QUOTA failure, ' +
            'NOT a prompt regression: nothing here has told you anything about the prompt. ' +
            'Re-run tomorrow, or with a paid key.',
        );
      }
      const burst = msg.includes('(429)') || msg.includes('(503)');
      if (!burst || attempt > 0) throw new Error(msg);
      await sleep(BURST_WAIT_MS);
    }
  }
}

interface Fixture {
  label: string;
  body: { message: string; recipient: string; from: string; occasion?: string; mood?: string };
  /**
   * The concrete things in the note. Each entry is one detail, listed with the spellings that
   * count as naming it (numerals vs words, singular vs plural stem). A garden has to reach for at
   * least two of them, which is the bar the prompt sets.
   */
  details: string[][];
}

const FIXTURES: Fixture[] = [
  {
    label: 'hospital car park',
    body: {
      message:
        'you drove four hours in the rain to sit in a hospital car park with me and did not once make it a big deal. i think about it constantly.',
      recipient: 'Nadia',
      from: 'Aiden',
      occasion: 'thank-you',
      mood: 'steady',
    },
    details: [['four hour', '4 hour'], ['rain'], ['car park', 'parking lot', 'hospital'], ['drove', 'driving', 'drive']],
  },
  {
    label: 'eleven ugly dogs',
    body: {
      message:
        'you texted me a photo of every single ugly dog you saw in lisbon. eleven dogs. i have them all saved.',
      recipient: 'Priya',
      from: 'Aiden',
      occasion: 'just-because',
      mood: 'playful',
    },
    details: [['eleven', '11'], ['lisbon'], ['dog'], ['photo', 'picture', 'saved']],
  },
  {
    label: 'tide journal',
    body: {
      message:
        'happy birthday to the only person alive who keeps a tide journal and laughs too hard at her own jokes.',
      recipient: 'Sarah',
      from: 'Maya',
      occasion: 'birthday',
      mood: 'playful',
    },
    details: [['tide'], ['journal'], ['laugh'], ['joke']],
  },
  {
    /** A note with nothing concrete in it. The prompt says stay warm and general rather than
     *  invent details, so this one checks the register rules hold without a specificity bar. */
    label: 'deliberately vague',
    body: {
      message: 'happy birthday, miss you lots. hope this year is a kind one.',
      recipient: 'Jo',
      from: 'Sam',
      occasion: 'birthday',
      mood: 'tender',
    },
    details: [],
  },
];

/** The greeting-card register the prompt bans by name. Any of these is a fail. */
const BANNED = [
  'unwavering support',
  'always being there',
  'mean the world to me',
  'means the world to me',
  "words can't express",
  'words cannot express',
  'thank you for being there',
];

const prose = (g: ValidatedGarden): string[] => [g.bouquet_note, ...g.flowers.map((f) => f.meaning)];

function namesADetail(g: ValidatedGarden, details: string[][]): number {
  const text = prose(g).join(' ').toLowerCase();
  return details.filter((spellings) => spellings.some((s) => text.includes(s))).length;
}

/** Read GEMINI_API_KEY out of .dev.vars. Never logged — only its presence is ever reported. */
function apiKey(): string {
  try {
    const raw = readFileSync(new URL('../.dev.vars', import.meta.url), 'utf8');
    const line = raw.split('\n').find((l) => l.trim().startsWith('GEMINI_API_KEY'));
    return line?.split('=').slice(1).join('=').trim().replace(/^["']|["']$/g, '') ?? '';
  } catch {
    return process.env.GEMINI_API_KEY ?? '';
  }
}

const KEY = apiKey();

describe.skipIf(!KEY)('prompt quality', () => {
  if (!KEY) return;

  // Say the cost out loud before spending it. The budget is 20 requests a day, so "this run will
  // use 4 of them" is the difference between a tool you reach for and one that strands you.
  const withDetails = FIXTURES.filter((f) => f.details.length > 0).length;
  console.log(
    `[eval] ${FIXTURES.length} fixtures x ${RUNS} run(s) = ${FIXTURES.length * RUNS} Gemini requests ` +
      `(free tier allows 20/day). ${withDetails} fixtures check specificity. ` +
      `Needing ${NEEDED}/${RUNS} to pass each check.`,
  );

  for (const fx of FIXTURES) {
    describe(fx.label, () => {
      const gardens: ValidatedGarden[] = [];

      beforeAll(async () => {
        // Sequential and paced: the design endpoint is rate-limited per IP in production and
        // there is no reason for an eval to be the thing that discovers that.
        for (let i = 0; i < RUNS; i++) {
          gardens.push(await generatePaced(KEY, buildPrompt(fx.body)));
        }
      }, 600_000);

      /** How many of the RUNS satisfy `ok`. */
      const scoring = (ok: (g: ValidatedGarden) => boolean): number => gardens.filter(ok).length;

      if (fx.details.length > 0) {
        test(`names at least two details from the note (${NEEDED}/${RUNS})`, () => {
          const passed = scoring((g) => namesADetail(g, fx.details) >= 2);
          expect(
            passed,
            gardens.map((g) => `[${namesADetail(g, fx.details)} details] ${prose(g).join(' / ')}`).join('\n'),
          ).toBeGreaterThanOrEqual(NEEDED);
        });
      }

      test('avoids the greeting-card register', () => {
        const passed = scoring((g) => {
          const text = prose(g).join(' ').toLowerCase();
          return !BANNED.some((p) => text.includes(p));
        });
        expect(passed, gardens.map((g) => prose(g).join(' / ')).join('\n')).toBeGreaterThanOrEqual(NEEDED);
      });

      test('writes no em dashes', () => {
        const passed = scoring((g) => !prose(g).some((t) => t.includes('—')));
        expect(passed, gardens.map((g) => prose(g).join(' / ')).join('\n')).toBeGreaterThanOrEqual(NEEDED);
      });

      test('does not repeat the flower name inside its meaning', () => {
        const passed = scoring((g) =>
          g.flowers.every((f) => !f.meaning.toLowerCase().startsWith(f.name.toLowerCase())),
        );
        expect(
          passed,
          gardens.map((g) => g.flowers.map((f) => `${f.name}: ${f.meaning}`).join(' / ')).join('\n'),
        ).toBeGreaterThanOrEqual(NEEDED);
      });

      test('uses distinct flowers', () => {
        const passed = scoring((g) => new Set(g.flowers.map((f) => f.name.toLowerCase())).size === g.flowers.length);
        expect(passed).toBeGreaterThanOrEqual(NEEDED);
      });
    });
  }
});
