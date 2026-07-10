let ctx: AudioContext | null = null
let unlockInstalled = false

// --- Global mute -------------------------------------------------------
//
// A single source of truth for "should this device make noise." Every
// audible play function checks `muted` and bails early, so muting is
// enforced in one place rather than at each call site. Persisted to
// localStorage so the choice survives reloads and carries across the
// composer → recipient views.
//
// Reads/writes are guarded: localStorage throws in private-mode Safari
// and is absent under SSR. A failure just means the preference doesn't
// persist — sound still works, it's never load-bearing.

const MUTE_KEY = 'bloomnote:muted'
const LEGACY_MUTE_KEY = 'blossom:muted' // pre-rename; read as a fallback so the setting carries over

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

/** True when sound is currently allowed to play. */
export function isSoundEnabled(): boolean {
	return !muted
}

/** Set the on/off state and persist it. */
export function setSoundEnabled(enabled: boolean): void {
	muted = !enabled
	if (typeof window === 'undefined') return
	try {
		window.localStorage.setItem(MUTE_KEY, muted ? '1' : '0')
	} catch {
		// Storage disabled — preference won't persist; not fatal.
	}
}

/** Flip the state. Returns the new enabled value so callers can update
 *  their UI without a second read. */
export function toggleSound(): boolean {
	// `muted` is the current state; passing it to setSoundEnabled flips
	// us (enable when currently muted, disable when currently on).
	setSoundEnabled(muted)
	return !muted
}

function getCtx(): AudioContext {
	if (!ctx) ctx = new AudioContext()
	return ctx
}

/**
 * Browsers block AudioContext playback until a user gesture happens
 * on the current page. This installs one-shot listeners on click,
 * touchstart, and keydown — the first one fires, we resume the
 * context, then we remove the listeners. After this, all sound
 * functions in this module will actually be audible.
 *
 * Safe to call multiple times — the `unlockInstalled` flag dedupes.
 */
export function unlockAudio(): void {
	if (unlockInstalled || typeof window === 'undefined') return
	unlockInstalled = true
	const unlock = () => {
		const ac = getCtx()
		if (ac.state === 'suspended') {
			ac.resume().catch(() => {
				// Some browsers throw if resume is called from a non-gesture
				// context. Falling back silently — next gesture will retry.
			})
		}
		window.removeEventListener('click', unlock)
		window.removeEventListener('touchstart', unlock)
		window.removeEventListener('keydown', unlock)
	}
	window.addEventListener('click', unlock)
	window.addEventListener('touchstart', unlock)
	window.addEventListener('keydown', unlock)
}

// Install the global unlock listener at module load — it's harmless on
// pages that allow autoplay already.
unlockAudio()

interface ToneOptions {
	freq?: number
	type?: OscillatorType
	duration?: number
	gain?: number
	delay?: number
}

function playTone({ freq = 440, type = 'sine', duration = 0.4, gain = 0.15, delay = 0 }: ToneOptions): void {
	const ac = getCtx()
	const osc = ac.createOscillator()
	const gainNode = ac.createGain()

	osc.connect(gainNode)
	gainNode.connect(ac.destination)

	osc.type = type
	osc.frequency.setValueAtTime(freq, ac.currentTime + delay)
	osc.frequency.exponentialRampToValueAtTime(freq * 0.95, ac.currentTime + delay + duration)

	gainNode.gain.setValueAtTime(0, ac.currentTime + delay)
	gainNode.gain.linearRampToValueAtTime(gain, ac.currentTime + delay + 0.02)
	gainNode.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + delay + duration)

	osc.start(ac.currentTime + delay)
	osc.stop(ac.currentTime + delay + duration)
}

export function playBloom(index: number = 0): void {
	if (muted) return
	const notes = [523, 659, 784, 880, 1047, 1175]
	const freq = notes[index % notes.length]!
	playTone({ freq, type: 'sine', duration: 0.6, gain: 0.12 })
	playTone({ freq: freq * 1.5, type: 'sine', duration: 0.4, gain: 0.05, delay: 0.05 })
}

// Brief haptic pulse alongside the bloom chime. Android Chrome,
// Samsung Internet, and Chrome OS support navigator.vibrate; iOS
// Safari and desktop browsers silently no-op (Apple doesn't expose
// the API at all). 25ms is the threshold where the device buzz
// reads as a percussive accent without becoming intrusive.
//
// Failing silently is the correct behavior here — a missing haptic
// shouldn't break the experience, it just means the user is on
// hardware that doesn't support it.
export function pulse(): void {
	// The haptic is the bloom chime's percussive accent, so it follows
	// the same mute switch — a buzz alongside a silenced bloom would
	// feel inconsistent.
	if (muted) return
	if (typeof navigator === 'undefined') return
	if (typeof navigator.vibrate !== 'function') return
	try {
		navigator.vibrate(25)
	} catch {
		// Some browsers gate vibrate behind a user gesture or HTTPS
		// requirement and will throw rather than no-op. Either way:
		// don't surface the error, just skip the buzz.
	}
}

export function playChime(): void {
	if (muted) return
	const chord = [523, 659, 784]
	chord.forEach((freq, i) => {
	playTone({ freq, type: 'sine', duration: 1.2, gain: 0.08, delay: i * 0.08 })
	})
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
