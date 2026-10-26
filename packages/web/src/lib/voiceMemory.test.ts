import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  canRecord,
  MAX_SECONDS,
  saveVoiceMemory,
  loadVoiceMemory,
  voiceMemoryIds,
  startRecording,
} from './voiceMemory'

/*
 * The storage layer has no browser here, which is exactly the case worth testing.
 *
 * Private browsing, an old device and a locked-down profile all give a page something less than a working
 * IndexedDB, and every one of those has to end with "no voice memories" rather than an exception. A journal
 * that throws while listing itself is a much worse outcome than one that quietly cannot record.
 */

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

describe('when there is no IndexedDB at all', () => {
  it('reads as empty instead of throwing', async () => {
    // node has no indexedDB, which is the same shape as a browser that denies it.
    await expect(voiceMemoryIds()).resolves.toEqual(new Set())
    await expect(loadVoiceMemory('anything')).resolves.toBeNull()
  })

  it('returns null rather than undefined for a missing memory', async () => {
    // A `get` on an absent key succeeds with `undefined`, and the cast in withStore would pass that off
    // as a VoiceMemory. The declared type says null, so null is what has to come back.
    const missing = await loadVoiceMemory('never-recorded')
    expect(missing).toBeNull()
    expect(missing).not.toBeUndefined()
  })

  it('reports a failed save rather than pretending it worked', async () => {
    // The caller shows "could not keep that recording", which is the only honest thing to say.
    const saved = await saveVoiceMemory({
      entryId: 'e1',
      blob: new Blob(['x']),
      seconds: 3,
      savedAt: new Date().toISOString(),
    })
    expect(saved).toBe(false)
  })
})

describe('when opening the database throws outright', () => {
  it('still resolves', async () => {
    // Firefox in private mode throws from indexedDB.open rather than failing the request object.
    vi.stubGlobal('indexedDB', {
      open: () => {
        throw new Error('denied')
      },
    })
    await expect(voiceMemoryIds()).resolves.toEqual(new Set())
  })

  it('does not hang when an upgrade is blocked', async () => {
    /*
     * A blocked upgrade fires neither onsuccess nor onerror, so anything awaiting only those two waits
     * forever and the journal never finishes rendering. onblocked has to resolve too.
     */
    const request: Record<string, unknown> = {}
    vi.stubGlobal('indexedDB', {
      open: () => {
        setTimeout(() => (request.onblocked as () => void)?.(), 0)
        return request
      },
    })
    await expect(voiceMemoryIds()).resolves.toEqual(new Set())
  })
})

describe('capability checks', () => {
  it('says no when there is no microphone API', () => {
    // Gates the button's existence, so it must never claim recording is possible when it is not.
    expect(canRecord()).toBe(false)
  })

  it('says no when getUserMedia exists but MediaRecorder does not', () => {
    // Real combination on older iOS, and the half that throws is the one people forget to check.
    vi.stubGlobal('navigator', { mediaDevices: { getUserMedia: () => undefined } })
    expect(canRecord()).toBe(false)
  })

  it('says yes only when both halves are present', () => {
    vi.stubGlobal('navigator', { mediaDevices: { getUserMedia: () => undefined } })
    vi.stubGlobal('MediaRecorder', class {})
    expect(canRecord()).toBe(true)
  })
})

describe('the recording cap', () => {
  it('is short enough that a forgotten tab cannot fill a disk', () => {
    // Enforced in startRecording with a timer rather than trusted to the UI.
    expect(MAX_SECONDS).toBeGreaterThan(15)
    expect(MAX_SECONDS).toBeLessThanOrEqual(120)
  })

  it('releases the microphone when the cap stops recording without another user action', async () => {
    vi.useFakeTimers()
    const stop = vi.fn()
    vi.stubGlobal('window', { setTimeout, clearTimeout })
    vi.stubGlobal('navigator', {
      mediaDevices: { getUserMedia: async () => ({ getTracks: () => [{ stop }] }) },
    })
    vi.stubGlobal(
      'MediaRecorder',
      class extends EventTarget {
        state = 'inactive'
        static isTypeSupported() {
          return true
        }
        start() {
          this.state = 'recording'
        }
        stop() {
          this.state = 'inactive'
          this.dispatchEvent(new Event('stop'))
        }
      },
    )
    const recording = await startRecording(2)
    vi.advanceTimersByTime(2000)
    expect(stop).toHaveBeenCalledOnce()
    await recording.stop()
    expect(stop).toHaveBeenCalledOnce()
  })

  it('releases the microphone if the recorder cannot start', async () => {
    const stop = vi.fn()
    vi.stubGlobal('navigator', {
      mediaDevices: { getUserMedia: async () => ({ getTracks: () => [{ stop }] }) },
    })
    vi.stubGlobal(
      'MediaRecorder',
      class extends EventTarget {
        static isTypeSupported() {
          return true
        }
        start() {
          throw new Error('Recorder unavailable')
        }
      },
    )
    await expect(startRecording()).rejects.toThrow('Recorder unavailable')
    expect(stop).toHaveBeenCalledOnce()
  })
})

it('does not report a voice memory saved when its transaction aborts after the write', async () => {
  const request: Record<string, unknown> = { result: 'e1' }
  const tx: Record<string, unknown> = { objectStore: () => ({ put: () => request }) }
  const opening: Record<string, unknown> = { result: { transaction: () => tx, close: () => {} } }
  vi.stubGlobal('indexedDB', {
    open: () => {
      queueMicrotask(() => (opening.onsuccess as () => void)())
      return opening
    },
  })
  const saving = saveVoiceMemory({
    entryId: 'e1',
    blob: new Blob(['x']),
    seconds: 1,
    savedAt: new Date().toISOString(),
  })
  await Promise.resolve()
  await Promise.resolve()
  ;(request.onsuccess as () => void)()
  ;(tx.onabort as () => void)()
  await expect(saving).resolves.toBe(false)
})

it('confirms a voice memory only after its transaction commits', async () => {
  const request: Record<string, unknown> = { result: 'e1' }
  const tx: Record<string, unknown> = { objectStore: () => ({ put: () => request }) }
  const opening: Record<string, unknown> = { result: { transaction: () => tx, close: () => {} } }
  vi.stubGlobal('indexedDB', {
    open: () => {
      queueMicrotask(() => (opening.onsuccess as () => void)())
      return opening
    },
  })
  let completed = false
  const saving = saveVoiceMemory({
    entryId: 'e1',
    blob: new Blob(['x']),
    seconds: 1,
    savedAt: new Date().toISOString(),
  }).then((saved) => {
    completed = true
    return saved
  })
  await Promise.resolve()
  await Promise.resolve()
  ;(request.onsuccess as () => void)()
  await Promise.resolve()
  expect(completed).toBe(false)
  ;(tx.oncomplete as () => void)()
  await expect(saving).resolves.toBe(true)
})
