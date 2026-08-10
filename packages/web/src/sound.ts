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
	if (!ctx) {
		// Older iOS Safari only exposes the prefixed constructor.
		const Ctor =
			window.AudioContext ??
			(window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
		ctx = new Ctor()
	}
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
let bufferUnlocked = false

export function unlockAudio(): void {
	if (unlockInstalled || typeof window === 'undefined') return
	unlockInstalled = true
	const unlock = () => {
		const ac = getCtx()
		// iOS Safari won't produce sound until a node is actually *started* inside a user gesture —
		// resume() alone leaves later plays silent. Play a one-sample silent buffer once to unlock it.
		if (!bufferUnlocked) {
			try {
				const src = ac.createBufferSource()
				src.buffer = ac.createBuffer(1, 1, 22050)
				src.connect(ac.destination)
				src.start(0)
				bufferUnlocked = true
			} catch {
				// createBuffer/start can throw before the context is ready; a later gesture retries.
			}
		}
		// Re-resume on every gesture, not just the first: iOS re-suspends the context when the tab is
		// backgrounded, and the composer plays its chime ~15s after the "grow" tap. Listeners stay
		// installed so any later interaction re-arms audio. resume() is a cheap no-op when running.
		if (ac.state === 'suspended') {
			ac.resume().catch(() => {
				// Some browsers throw if resume runs outside a gesture — the next gesture retries.
			})
		}
	}
	window.addEventListener('click', unlock)
	window.addEventListener('touchstart', unlock)
	window.addEventListener('keydown', unlock)
}

// Install the global unlock listener at module load — it's harmless on
// pages that allow autoplay already.
unlockAudio()

/*
 * Schedule slightly ahead of now, never at now. The audio thread has already rendered up to
 * currentTime by the time a play function runs, so a note booked for exactly currentTime lands in
 * the past and the hardware skips what it missed. That doesn't silence the note, which is why it's
 * easy to miss: it eats the attack and leaves the tail.
 */
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

/**
 * Three drops landing, for watering someone's garden.
 *
 * Written out rather than routed through playTone because a drop bends the wrong way for it: a
 * falling droplet's pitch *rises* as the air bubble it traps collapses, which is the whole reason
 * a plink sounds like water and not like a bell. playTone bends every note down by design.
 *
 * The three are staggered unevenly on purpose. Even spacing reads as a machine; water doesn't
 * arrive on a metronome.
 */
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
