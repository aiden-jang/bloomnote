/*
 * The audio, which is almost entirely iOS Safari workarounds.
 *
 * The module reads storage and installs listeners at import, so every test imports it fresh against
 * a window it built first. That is the only way to reach `muted`, which is module state captured on
 * the way in.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'

interface FakeCtx {
  state: string
  currentTime: number
  started: number
  resumes: number
  /** Oscillators and gains built. Zero is what "muted" has to mean. */
  nodes: number
  resumeRejects?: boolean
  createBufferThrows?: boolean
}

/** A window with storage, listeners and an AudioContext we can inspect. */
function setupWindow(
  opts: { stored?: string; legacy?: string; storageThrows?: boolean; ctx?: Partial<FakeCtx> } = {},
) {
  const store = new Map<string, string>()
  if (opts.stored !== undefined) store.set('bloomnote:muted', opts.stored)
  if (opts.legacy !== undefined) store.set('blossom:muted', opts.legacy)

  const listeners = new Map<string, () => void>()
  const ctx: FakeCtx = { state: 'running', currentTime: 0, started: 0, resumes: 0, nodes: 0, ...opts.ctx }

  const node = () => {
    ctx.nodes += 1
    return {
      connect: () => {},
      type: '',
      frequency: { setValueAtTime: () => {}, exponentialRampToValueAtTime: () => {} },
      gain: {
        setValueAtTime: () => {},
        linearRampToValueAtTime: () => {},
        exponentialRampToValueAtTime: () => {},
      },
      start: () => {},
      stop: () => {},
    }
  }

  const AudioContextStub = function (this: unknown) {
    return {
      get state() {
        return ctx.state
      },
      currentTime: 0,
      destination: {},
      resume: () => {
        ctx.resumes += 1
        return opts.ctx?.resumeRejects ? Promise.reject(new Error('not a gesture')) : Promise.resolve()
      },
      createBuffer: () => {
        if (opts.ctx?.createBufferThrows) throw new Error('context not ready')
        return {}
      },
      createBufferSource: () => ({
        buffer: null,
        connect: () => {},
        start: () => {
          ctx.started += 1
        },
      }),
      createOscillator: node,
      createGain: node,
    }
  } as unknown as typeof AudioContext

  vi.stubGlobal('window', {
    AudioContext: AudioContextStub,
    localStorage: {
      getItem: (k: string) => {
        if (opts.storageThrows) throw new Error('private mode')
        return store.get(k) ?? null
      },
      setItem: (k: string, v: string) => {
        if (opts.storageThrows) throw new Error('private mode')
        store.set(k, v)
      },
    },
    addEventListener: (type: string, fn: () => void) => listeners.set(type, fn),
  })
  return { store, listeners, ctx }
}

/** Import the module fresh, so its load-time state is built against the current window. */
async function loadSound() {
  vi.resetModules()
  return await import('./sound')
}

afterEach(() => vi.unstubAllGlobals())

describe('the mute preference', () => {
  it('starts unmuted on a device that has never chosen', async () => {
    setupWindow()
    const sound = await loadSound()
    expect(sound.isSoundEnabled()).toBe(true)
  })

  it('honours a stored mute', async () => {
    setupWindow({ stored: '1' })
    expect((await loadSound()).isSoundEnabled()).toBe(false)
  })

  /* Renamed from blossom. Reading the old key means somebody who muted once stays muted. */
  it('reads the pre-rename key so the choice carries over', async () => {
    setupWindow({ legacy: '1' })
    expect((await loadSound()).isSoundEnabled()).toBe(false)
  })

  it('persists a change and reports the new state from toggle', async () => {
    const { store } = setupWindow()
    const sound = await loadSound()
    sound.setSoundEnabled(false)
    expect(store.get('bloomnote:muted')).toBe('1')
    expect(sound.isSoundEnabled()).toBe(false)
    expect(sound.toggleSound()).toBe(true)
    expect(store.get('bloomnote:muted')).toBe('0')
  })

  /* Private-mode Safari throws on both read and write. Sound is never load-bearing. */
  it('stays audible and does not throw when storage is unavailable', async () => {
    setupWindow({ storageThrows: true })
    const sound = await loadSound()
    expect(sound.isSoundEnabled()).toBe(true)
    expect(() => sound.setSoundEnabled(false)).not.toThrow()
  })
})

/*
 * The unlock is the reason this file is difficult.
 *
 * iOS will not produce sound until a node has actually been started inside a user gesture, and it
 * re-suspends the context whenever the tab goes to the background. resume() on its own leaves every
 * later play silent.
 */
describe('unlocking audio', () => {
  it('waits for a real gesture on click, touch or key', async () => {
    const { listeners } = setupWindow()
    await loadSound()
    expect([...listeners.keys()].sort()).toEqual(['click', 'keydown', 'touchstart'])
  })

  it('starts a silent buffer on the first gesture, and only once', async () => {
    const { listeners, ctx } = setupWindow()
    await loadSound()
    listeners.get('click')!()
    expect(ctx.started).toBe(1)
    listeners.get('click')!()
    expect(ctx.started).toBe(1)
  })

  it('resumes again on every later gesture, because the tab backgrounding re-suspends it', async () => {
    const { listeners, ctx } = setupWindow({ ctx: { state: 'suspended' } })
    await loadSound()
    listeners.get('click')!()
    listeners.get('touchstart')!()
    expect(ctx.resumes).toBe(2)
  })

  it('leaves a running context alone', async () => {
    const { listeners, ctx } = setupWindow({ ctx: { state: 'running' } })
    await loadSound()
    listeners.get('click')!()
    expect(ctx.resumes).toBe(0)
  })

  it('retries on a later gesture when the buffer could not be created', async () => {
    const { listeners, ctx } = setupWindow({ ctx: { createBufferThrows: true } })
    await loadSound()
    expect(() => listeners.get('click')!()).not.toThrow()
    expect(ctx.started).toBe(0)
  })

  it('swallows a rejected resume rather than leaving an unhandled rejection', async () => {
    const { listeners } = setupWindow({ ctx: { state: 'suspended', resumeRejects: true } })
    await loadSound()
    listeners.get('click')!()
    await new Promise((resolve) => setTimeout(resolve, 0))
  })
})

/* Muting is enforced in one place, so every audible path has to check the same flag. */
describe('mute is enforced at every audible call', () => {
  it('builds no audio nodes at all while muted', async () => {
    const { ctx } = setupWindow({ stored: '1' })
    const sound = await loadSound()
    const vibrate = vi.fn()
    vi.stubGlobal('navigator', { vibrate })

    sound.playBloom(0)
    sound.playChime()
    sound.playWater()
    sound.pulse()

    // Not "it did not throw": muted has to mean nothing was scheduled.
    expect(ctx.nodes).toBe(0)
    expect(vibrate).not.toHaveBeenCalled()
  })

  it('builds them once unmuted, so the check above is measuring something', async () => {
    const { ctx } = setupWindow()
    const sound = await loadSound()
    sound.playBloom(0)
    expect(ctx.nodes).toBeGreaterThan(0)
  })

  it('buzzes alongside the bloom when it is not muted', async () => {
    setupWindow()
    const sound = await loadSound()
    const vibrate = vi.fn()
    vi.stubGlobal('navigator', { vibrate })
    sound.pulse()
    expect(vibrate).toHaveBeenCalledWith(25)
  })

  /* Some browsers gate vibrate behind HTTPS or a gesture and throw rather than no-op. */
  it('survives a vibrate that throws', async () => {
    setupWindow()
    const sound = await loadSound()
    vi.stubGlobal('navigator', {
      vibrate: () => {
        throw new Error('requires a user gesture')
      },
    })
    expect(() => sound.pulse()).not.toThrow()
  })
})
