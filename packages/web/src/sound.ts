let ctx: AudioContext | null = null
let unlockInstalled = false

// Reads and writes are guarded: localStorage throws in private-mode Safari and is absent under
// SSR. A failure just means the preference doesn't persist. Sound is never load-bearing.

const MUTE_KEY = 'bloomnote:muted'
const LEGACY_MUTE_KEY = 'blossom:muted'

function readMuted(): boolean {
  if (typeof window === 'undefined') return false
  try {
    const v = window.localStorage.getItem(MUTE_KEY) ?? window.localStorage.getItem(LEGACY_MUTE_KEY)
    return v === '1'
  } catch {
    return false
  }
}

let muted = readMuted()

export function isSoundEnabled(): boolean {
  return !muted
}

export function setSoundEnabled(enabled: boolean): void {
  muted = !enabled
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(MUTE_KEY, muted ? '1' : '0')
  } catch {
    // Storage disabled. The preference won't persist, which is not fatal.
  }
}

export function toggleSound(): boolean {
  setSoundEnabled(muted)
  return !muted
}

function getCtx(): AudioContext {
  if (!ctx) {
    // Older iOS Safari only exposes the prefixed constructor.
    const Ctor =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    ctx = new Ctor()
  }
  return ctx
}

let bufferUnlocked = false

export function unlockAudio(): void {
  if (unlockInstalled || typeof window === 'undefined') return
  unlockInstalled = true
  const unlock = () => {
    const ac = getCtx()
    // iOS Safari won't produce sound until a node is actually started inside a user gesture.
    // resume() alone leaves every later play silent, so unlock with a one-sample silent buffer.
    if (!bufferUnlocked) {
      try {
        const src = ac.createBufferSource()
        src.buffer = ac.createBuffer(1, 1, 22050)
        src.connect(ac.destination)
        src.start(0)
        bufferUnlocked = true
      } catch {
        // createBuffer/start can throw before the context is ready. A later gesture retries.
      }
    }
    // Re-resume on every gesture, not just the first: iOS re-suspends the context when the tab is
    // backgrounded, and the composer plays its chime about 15s after the "grow" tap.
    if (ac.state === 'suspended') {
      ac.resume().catch(() => {
        // Some browsers throw if resume runs outside a gesture. The next gesture retries.
      })
    }
  }
  window.addEventListener('click', unlock)
  window.addEventListener('touchstart', unlock)
  window.addEventListener('keydown', unlock)
}

unlockAudio()

/* Schedule slightly ahead of now, never at now. The audio thread has already rendered up to
   currentTime, so anything scheduled there is dropped. */
const LOOKAHEAD = 0.02

interface ToneOptions {
  freq?: number
  type?: OscillatorType
  duration?: number
  gain?: number
  delay?: number
}

function playTone({ freq = 440, type = 'sine', duration = 0.4, gain = 0.15, delay = 0 }: ToneOptions): void {
  const ac = getCtx()
  const start = ac.currentTime + LOOKAHEAD
  const osc = ac.createOscillator()
  const gainNode = ac.createGain()

  osc.connect(gainNode)
  gainNode.connect(ac.destination)

  osc.type = type
  osc.frequency.setValueAtTime(freq, start + delay)
  osc.frequency.exponentialRampToValueAtTime(freq * 0.95, start + delay + duration)

  gainNode.gain.setValueAtTime(0, start + delay)
  gainNode.gain.linearRampToValueAtTime(gain, start + delay + 0.02)
  gainNode.gain.exponentialRampToValueAtTime(0.001, start + delay + duration)

  osc.start(start + delay)
  osc.stop(start + delay + duration)
}

export function playBloom(index: number = 0): void {
  if (muted) return
  const notes = [523, 659, 784, 880, 1047, 1175]
  const freq = notes[index % notes.length]!
  playTone({ freq, type: 'sine', duration: 0.6, gain: 0.12 })
  playTone({ freq: freq * 1.5, type: 'sine', duration: 0.4, gain: 0.05, delay: 0.05 })
}

export function pulse(): void {
  if (muted) return
  if (typeof navigator === 'undefined') return
  if (typeof navigator.vibrate !== 'function') return
  try {
    navigator.vibrate(25)
  } catch {
    // Some browsers gate vibrate behind a user gesture or HTTPS and throw rather than no-op.
  }
}

export function playChime(): void {
  if (muted) return
  const chord = [523, 659, 784]
  chord.forEach((freq, i) => {
    playTone({ freq, type: 'sine', duration: 1.2, gain: 0.08, delay: i * 0.08 })
  })
}

/* Written out rather than routed through playTone: three drops need their own envelope. */
export function playWater(): void {
  if (muted) return
  const ac = getCtx()
  const drops = [
    { from: 620, to: 1180, at: 0, gain: 0.09 },
    { from: 520, to: 980, at: 0.09, gain: 0.07 },
    { from: 700, to: 1320, at: 0.21, gain: 0.05 },
  ]
  for (const d of drops) {
    const osc = ac.createOscillator()
    const env = ac.createGain()
    const t = ac.currentTime + LOOKAHEAD + d.at
    osc.type = 'sine'
    osc.frequency.setValueAtTime(d.from, t)
    osc.frequency.exponentialRampToValueAtTime(d.to, t + 0.06)
    env.gain.setValueAtTime(0, t)
    env.gain.linearRampToValueAtTime(d.gain, t + 0.006)
    env.gain.exponentialRampToValueAtTime(0.0001, t + 0.13)
    osc.connect(env)
    env.connect(ac.destination)
    osc.start(t)
    osc.stop(t + 0.15)
  }
}

export function playSuccess(): void {
  if (muted) return
  const melody = [784, 880, 1047]
  melody.forEach((freq, i) => {
    playTone({ freq, type: 'sine', duration: 0.5, gain: 0.1, delay: i * 0.15 })
  })
}

export function playWhoosh(): void {
  if (muted) return
  const ac = getCtx()
  const bufferSize = ac.sampleRate * 0.3
  const buffer = ac.createBuffer(1, bufferSize, ac.sampleRate)
  const data = buffer.getChannelData(0)
  for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1

  const source = ac.createBufferSource()
  source.buffer = buffer

  const filter = ac.createBiquadFilter()
  filter.type = 'bandpass'
  filter.frequency.setValueAtTime(2000, ac.currentTime)
  filter.frequency.exponentialRampToValueAtTime(200, ac.currentTime + 0.3)
  filter.Q.value = 0.5

  const gainNode = ac.createGain()
  gainNode.gain.setValueAtTime(0.08, ac.currentTime)
  gainNode.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + 0.3)

  source.connect(filter)
  filter.connect(gainNode)
  gainNode.connect(ac.destination)
  source.start()
}
