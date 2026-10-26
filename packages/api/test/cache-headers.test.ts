import { SELF } from 'cloudflare:test'
import { describe, expect, it } from 'vitest'

const GARDEN = {
  flowers: [
    {
      name: 'Rose',
      meaning: 'for the obvious reason',
      petalColors: ['#e11d48', '#f43f5e', '#fb7185'],
      centerColor: '#ffc53d',
      stemColor: '#7c9a6e',
      petalShape: 'round',
      petalCount: 8,
      stemHeight: 92,
    },
  ],
  message: 'hi',
  from: 'Aria',
  to: 'Bo',
  occasion: 'birthday',
  createdAt: '2026-07-01T00:00:00.000Z',
}

it('permits optional voice recording on this origin while keeping other device APIs disabled', async () => {
  const response = await SELF.fetch('https://x/health')
  const policy = response.headers.get('permissions-policy')
  expect(policy).toContain('microphone=(self)')
  expect(policy).toContain('camera=()')
  expect(policy).toContain('geolocation=()')
})

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
    })
    expect(made.status, await made.clone().text()).toBe(200)

    const { id } = (await made.json()) as { id: string }
    const got = await SELF.fetch(`https://x/api/garden?id=${id}`)
    expect(got.status).toBe(200)
    expect(got.headers.get('cache-control')).toContain('immutable')
  })

  it('defaults everything else to no-store', async () => {
    const res = await SELF.fetch('https://x/api/garden') // no id: per-request, must not be stored
    expect(res.headers.get('cache-control')).toContain('no-store')
  })
})

it.each(['/api/garden?id=AbCdEf', '/g/AbCdEf', '/r/AbCdEf', '/mine', '/og/AbCdEf.png'])(
  'keeps private garden and library route %s out of search indexing',
  async (path) => {
    const response = await SELF.fetch(`https://x${path}`)
    expect(response.headers.get('x-robots-tag')).toBe('noindex, nofollow')
  },
)

it('leaves the public homepage discoverable', async () => {
  const response = await SELF.fetch('https://x/')
  expect(response.headers.get('x-robots-tag')).toBeNull()
})
