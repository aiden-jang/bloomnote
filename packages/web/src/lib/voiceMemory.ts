/*
 * Spoken memories, kept on this device.
 *
 * Attached to a journal entry, never to a garden you send. That is a deliberate boundary rather than a
 * shortcut: audio on a sent garden needs object storage, and the only binding this app has is KV, where
 * writes are the scarce quota and megabytes of audio are the wrong shape entirely. It is also the better
 * product. The journal is the private half of bloomnote, and speaking is easier than typing when the
 * memory is the kind you would rather not compose a sentence about.
 *
 * IndexedDB rather than localStorage, because localStorage holds strings and has a ~5MB ceiling that one
 * minute of audio would eat. Everything here degrades to "no voice memories" rather than throwing: private
 * browsing, a denied microphone and a full disk are all ordinary, and none of them should break a journal.
 */

const DB_NAME = 'bloomnote-voice'
const STORE = 'memories'
const DB_VERSION = 1

/** Long enough for a real thought, short enough that a stray recording cannot fill a disk. */
export const MAX_SECONDS = 60

export interface VoiceMemory {
  /** The journal entry this belongs to. */
  entryId: string
  blob: Blob
  /** Seconds, as measured while recording rather than read back off the file. */
  seconds: number
  savedAt: string
}

function openDb(): Promise<IDBDatabase | null> {
  return new Promise((resolve) => {
    if (typeof indexedDB === 'undefined') return resolve(null)
    let request: IDBOpenDBRequest
    try {
      request = indexedDB.open(DB_NAME, DB_VERSION)
    } catch {
      // Firefox in private mode throws here rather than failing the request.
      return resolve(null)
    }
    request.onupgradeneeded = () => {
      const db = request.result
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE, { keyPath: 'entryId' })
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => resolve(null)
    // A blocked upgrade never settles either handler, and a journal must not hang on it.
    request.onblocked = () => resolve(null)
  })
}

async function withStore<T>(mode: IDBTransactionMode, run: (store: IDBObjectStore) => IDBRequest): Promise<T | null> {
  const db = await openDb()
  if (!db) return null
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(STORE, mode)
      const request = run(tx.objectStore(STORE))
      /*
       * `undefined` normalised to null on the way out.
       *
       * A `get` for a key that is not there succeeds with `result === undefined`, and the cast below would
       * happily hand that back as a VoiceMemory. Callers testing truthiness survived it; the declared type
       * did not, and the first `?? ` or `in` check written against it would have been wrong.
       */
      request.onsuccess = () => resolve((request.result ?? null) as T | null)
      request.onerror = () => resolve(null)
      tx.onabort = () => resolve(null)
    } catch {
      resolve(null)
    } finally {
      // Closing is safe to schedule immediately: the transaction keeps its own reference.
      db.close()
    }
  })
}

export async function saveVoiceMemory(memory: VoiceMemory): Promise<boolean> {
  const result = await withStore<IDBValidKey>('readwrite', (store) => store.put(memory))
  return result !== null
}

export async function loadVoiceMemory(entryId: string): Promise<VoiceMemory | null> {
  return withStore<VoiceMemory>('readonly', (store) => store.get(entryId))
}

export async function deleteVoiceMemory(entryId: string): Promise<void> {
  await withStore('readwrite', (store) => store.delete(entryId))
}

/** Which entries have a voice memory, so the journal can mark them without loading any audio. */
export async function voiceMemoryIds(): Promise<Set<string>> {
  const keys = await withStore<IDBValidKey[]>('readonly', (store) => store.getAllKeys())
  return new Set((keys ?? []).filter((key): key is string => typeof key === 'string'))
}

/** Whether recording is possible at all. Cheap and synchronous, so it can gate a button's existence. */
export function canRecord(): boolean {
  return (
    typeof navigator !== 'undefined' &&
    typeof navigator.mediaDevices?.getUserMedia === 'function' &&
    typeof MediaRecorder !== 'undefined'
  )
}

/**
 * The best container this browser will actually produce.
 *
 * Safari records mp4 and everything else prefers webm/opus, and passing an unsupported mimeType to
 * MediaRecorder throws rather than falling back. Returning undefined lets the browser choose, which is
 * the correct answer when none of the guesses is supported.
 */
function bestMimeType(): string | undefined {
  const candidates = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4']
  return candidates.find((type) => MediaRecorder.isTypeSupported?.(type))
}

export interface Recording {
  /** Resolves with the finished audio, or null if nothing usable was captured. */
  stop: () => Promise<{ blob: Blob; seconds: number } | null>
  /** Abandon it: stops the microphone and keeps nothing. */
  cancel: () => void
  /** The live stream, for driving the ring while recording. */
  stream: MediaStream
}

/**
 * Start recording.
 *
 * Throws only for a refused microphone, which the caller has to handle as a normal outcome: somebody
 * dismissing a permission prompt is not an error worth showing an error for.
 */
export async function startRecording(maxSeconds = MAX_SECONDS): Promise<Recording> {
  const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
  const mimeType = bestMimeType()
  const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined)
  const chunks: Blob[] = []
  const startedAt = Date.now()
  recorder.ondataavailable = (event) => {
    if (event.data.size > 0) chunks.push(event.data)
  }
  recorder.start()

  // A hard ceiling enforced here rather than trusted to the UI, so a forgotten tab cannot record forever.
  const cap = window.setTimeout(() => {
    if (recorder.state === 'recording') recorder.stop()
  }, maxSeconds * 1000)

  const release = (): void => {
    window.clearTimeout(cap)
    for (const track of stream.getTracks()) track.stop()
  }

  return {
    stream,
    cancel: () => {
      if (recorder.state !== 'inactive') recorder.stop()
      chunks.length = 0
      release()
    },
    stop: () =>
      new Promise((resolve) => {
        const finish = (): void => {
          release()
          if (chunks.length === 0) return resolve(null)
          const blob = new Blob(chunks, { type: chunks[0]!.type || mimeType || 'audio/webm' })
          // Measured from the clock, not read back: duration metadata on a streamed webm is frequently
          // Infinity, and a ring sized from Infinity draws nothing.
          resolve({ blob, seconds: Math.max(1, Math.round((Date.now() - startedAt) / 1000)) })
        }
        if (recorder.state === 'inactive') finish()
        else {
          recorder.onstop = finish
          recorder.stop()
        }
      }),
  }
}
