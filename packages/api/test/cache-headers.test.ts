import { SELF } from 'cloudflare:test';
import { describe, expect, it } from 'vitest';

const GARDEN = {
  flowers: [{ name: 'Rose', petalColors: ['#e11d48'] }],
  message: 'hi',
  from: 'Aria',
  to: 'Bo',
  occasion: 'birthday',
  createdAt: '2026-07-01T00:00:00.000Z',
};

/**
 * Two things at once, and the second is the reason this file exists.
 *
 * A GET with no Cache-Control is heuristically cacheable, which shipped in accounts and produced a real
 * sign-out bug, so responses here default to no-store. But /api/garden deliberately sends `immutable`
 * with a one-year lifetime, because a garden cannot change once created. A blanket no-store would have
 * silently undone that, turning a free permanent cache into a request on every open.
 *
 * The first version of this test was worthless. It guarded the create with `if (status !== 200) return`,
 * my body shape was wrong, the POST 400'd, and the assertion never ran: the over-eager version of the
 * fix passed it cleanly. There is no early return now. If creating a garden stops working, this fails
 * rather than quietly stops testing anything.
 */
describe('cache headers', () => {
  it('leaves an intentional immutable cache alone', async () => {
    const made = await SELF.fetch('https://x/api/garden', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(GARDEN),
    });
    expect(made.status, await made.clone().text()).toBe(200);

    const { id } = (await made.json()) as { id: string };
    const got = await SELF.fetch(`https://x/api/garden?id=${id}`);
    expect(got.status).toBe(200);
    expect(got.headers.get('cache-control')).toContain('immutable');
  });

  it('defaults everything else to no-store', async () => {
    const res = await SELF.fetch('https://x/api/garden'); // no id: per-request, must not be stored
    expect(res.headers.get('cache-control')).toContain('no-store');
  });
});
