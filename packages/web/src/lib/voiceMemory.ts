const DB_NAME = 'bloomnote-voice'
const STORE = 'memories'
const DB_VERSION = 1

export const MAX_SECONDS = 60

export interface VoiceMemory {
  entryId: string
  blob: Blob
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

async function withStore<T>(
  mode: IDBTransactionMode,
  run: (store: IDBObjectStore) => IDBRequest,
): Promise<T | null> {
  const db = await openDb()
  if (!db) return null
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(STORE, mode)
      const request = run(tx.objectStore(STORE))
      // A `get` on a missing key succeeds with undefined, and the cast below would pass that off as a
      // VoiceMemory. The declared type says null.
      request.onsuccess = () => resolve((request.result ?? null) as T | null)
      request.onerror = () => resolve(null)
      tx.onabort = () => resolve(null)
    } catch {
      resolve(null)
    } finally {
      // Safe to schedule immediately: the transaction keeps its own reference.
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

export async function voiceMemoryIds(): Promise<Set<string>> {
  const keys = await withStore<IDBValidKey[]>('readonly', (store) => store.getAllKeys())
  return new Set((keys ?? []).filter((key): key is string => typeof key === 'string'))
}

export function canRecord(): boolean {
  return (
    typeof navigator !== 'undefined' &&
    typeof navigator.mediaDevices?.getUserMedia === 'function' &&
    typeof MediaRecorder !== 'undefined'
  )
}

/** An unsupported mimeType makes MediaRecorder throw rather than fall back. */
function bestMimeType(): string | undefined {
  const candidates = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4']
  return candidates.find((type) => MediaRecorder.isTypeSupported?.(type))
}

export interface Recording {
  stop: () => Promise<{ blob: Blob; seconds: number } | null>
  cancel: () => void
  stream: MediaStream
}

/** Throws only for a refused microphone, which is a normal outcome, not an error worth showing. */
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

  // Enforced here rather than trusted to the UI, so a forgotten tab cannot record forever.
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
