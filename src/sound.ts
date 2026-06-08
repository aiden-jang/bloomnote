let ctx: AudioContext | null = null

function getCtx(): AudioContext {
	if (!ctx) ctx = new AudioContext()
	return ctx
}

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
	const notes = [523, 659, 784, 880, 1047, 1175]
	const freq = notes[index % notes.length]
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
	const chord = [523, 659, 784]
	chord.forEach((freq, i) => {
	playTone({ freq, type: 'sine', duration: 1.2, gain: 0.08, delay: i * 0.08 })
	})
}

export function playSuccess(): void {
	const melody = [784, 880, 1047]
	melody.forEach((freq, i) => {
	playTone({ freq, type: 'sine', duration: 0.5, gain: 0.1, delay: i * 0.15 })
	})
}

export function playWhoosh(): void {
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
