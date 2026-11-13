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
  strict = false,
): Promise<T | null> {
  const db = await openDb()
  if (!db) {
    if (strict)
      throw new Error(
        'Could not read voice storage. Allow site storage, or leave device voices out of this backup.',
      )
    return null
  }
  return new Promise((resolve, reject) => {
    try {
      const tx = db.transaction(STORE, mode)
      const request = run(tx.objectStore(STORE))
      let value: T | null = null
      // A successful request can still be rolled back by its transaction.
      request.onsuccess = () => {
        value = (request.result ?? null) as T | null
      }
      tx.oncomplete = () => resolve(value)
      const failed = () =>
        strict
          ? reject(new Error('Could not read every voice memory. Try again before continuing.'))
          : resolve(null)
      request.onerror = failed
      tx.onabort = failed
    } catch {
      if (strict) reject(new Error('Could not read voice storage. Allow site storage before continuing.'))
      else resolve(null)
    } finally {
      // Safe to schedule immediately: the transaction keeps its own reference.
      db.close()
    }
  })
}

type StoredVoice = Omit<VoiceMemory, 'blob'> & { bytes?: ArrayBuffer; type?: string; blob?: Blob }

export async function saveVoiceMemory(memory: VoiceMemory): Promise<boolean> {
  try {
    // WebKit can reject Blob persistence even when IndexedDB itself is available. Store the
    // identical bytes, not a re-encoded recording; older Blob records remain readable below.
    const { blob, ...fields } = memory
    const bytes = await blob.arrayBuffer()
    const result = await withStore<IDBValidKey>('readwrite', (store) =>
      store.put({ ...fields, bytes, type: blob.type }),
    )
    return result !== null
  } catch {
    return false
  }
}

async function readVoice(entryId: string, strict = false): Promise<VoiceMemory | null> {
  const stored = await withStore<StoredVoice>('readonly', (store) => store.get(entryId), strict)
  if (!stored) return null
  const blob =
    stored.blob instanceof Blob
      ? stored.blob
      : stored.bytes instanceof ArrayBuffer && typeof stored.type === 'string'
        ? new Blob([stored.bytes], { type: stored.type })
        : null
  if (
    !blob ||
    stored.entryId !== entryId ||
    typeof stored.seconds !== 'number' ||
    typeof stored.savedAt !== 'string'
  ) {
    if (strict)
      throw new Error('A voice memory could not be read. Keep the original device data and try again.')
    return null
  }
  return { entryId, blob, seconds: stored.seconds, savedAt: stored.savedAt }
}

export async function loadVoiceMemory(entryId: string): Promise<VoiceMemory | null> {
  return readVoice(entryId)
}

export async function loadVoiceForBackup(entryId: string): Promise<VoiceMemory | null> {
  return readVoice(entryId, true)
}

export async function deleteVoiceMemory(entryId: string): Promise<boolean> {
  try {
    await withStore('readwrite', (store) => store.delete(entryId), true)
    return true
  } catch {
    return false
  }
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

/** Request microphone access and start a capped recording; callers handle denial or startup failure. */
export async function startRecording(maxSeconds = MAX_SECONDS): Promise<Recording> {
  const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
  let cap: number | null = null
  let released = false
  const release = (): void => {
    if (released) return
    released = true
    if (cap !== null) window.clearTimeout(cap)
    for (const track of stream.getTracks()) track.stop()
  }
  let recorder: MediaRecorder
  const chunks: Blob[] = []
  const startedAt = Date.now()
  let mimeType: string | undefined
  try {
    mimeType = bestMimeType()
    recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined)
    recorder.ondataavailable = (event) => {
      if (event.data.size > 0) chunks.push(event.data)
    }
    recorder.addEventListener('stop', release, { once: true })
    recorder.addEventListener('error', release, { once: true })
    recorder.start()
  } catch (error) {
    release()
    throw error
  }

  // Enforced here rather than trusted to the UI, so a forgotten tab cannot record forever.
  cap = window.setTimeout(() => {
    if (recorder.state === 'recording') recorder.stop()
  }, maxSeconds * 1000)

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
