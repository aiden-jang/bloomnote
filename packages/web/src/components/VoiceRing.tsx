import { useCallback, useEffect, useRef, useState } from 'react'
import { prefersReducedMotion } from '../lib/motion'
import styles from './VoiceRing.module.css'

const PETALS = 24
const RADIUS = 30
const CENTRE = 40

const REACH = 7

function petalPoints(level: number, seconds: number, phase: number, still: boolean): string[] {
  // Longer recordings fill more of the ring, so a glance says "a sentence" or "a whole story".
  const filled = Math.max(4, Math.min(PETALS, Math.round((seconds / 60) * PETALS) + 4))
  return Array.from({ length: filled }, (_, i) => {
    const angle = (i / PETALS) * Math.PI * 2 - Math.PI / 2
    // A travelling wave rather than every petal moving together, which would read as a throb.
    const wave = still ? 0.35 : (Math.sin(phase + i * 0.5) + 1) / 2
    const reach = RADIUS + REACH * level * wave
    const x = CENTRE + Math.cos(angle) * reach
    const y = CENTRE + Math.sin(angle) * reach
    return `${x.toFixed(1)},${y.toFixed(1)}`
  })
}

export function VoiceRing({
  blob,
  seconds,
  liveStream,
  onDelete,
}: {
  blob?: Blob | undefined
  seconds: number
  liveStream?: MediaStream | undefined
  onDelete?: (() => void) | undefined
}) {
  const [level, setLevel] = useState(0)
  const [phase, setPhase] = useState(0)
  const [playing, setPlaying] = useState(false)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const url = useRef<string | null>(null)
  const still = prefersReducedMotion()

  // Torn down completely: an open AudioContext keeps the browser's mic indicator lit, which looks
  // exactly like an app still listening to you.
  const analyse = useCallback(
    (source: MediaStream | HTMLAudioElement) => {
      if (still) return () => undefined
      const Ctor =
        window.AudioContext ??
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
      if (!Ctor) return () => undefined
      let ctx: AudioContext
      try {
        ctx = new Ctor()
      } catch {
        return () => undefined
      }
      const analyser = ctx.createAnalyser()
      analyser.fftSize = 256
      const node =
        source instanceof MediaStream
          ? ctx.createMediaStreamSource(source)
          : ctx.createMediaElementSource(source)
      node.connect(analyser)
      // Playback still has to reach the speakers; a microphone must not, or it echoes.
      if (!(source instanceof MediaStream)) analyser.connect(ctx.destination)

      const buffer = new Float32Array(analyser.fftSize)
      let raf = 0
      let alive = true
      const tick = (): void => {
        if (!alive) return
        analyser.getFloatTimeDomainData(buffer)
        let sum = 0
        for (const sample of buffer) sum += sample * sample
        const rms = Math.sqrt(sum / buffer.length)
        // Eased upward and damped downward, so a consonant does not make the ring flicker.
        setLevel((previous) => Math.max(rms * 6, previous * 0.88))
        setPhase((p) => p + 0.15)
        raf = requestAnimationFrame(tick)
      }
      raf = requestAnimationFrame(tick)

      return () => {
        alive = false
        cancelAnimationFrame(raf)
        void ctx.close()
      }
    },
    [still],
  )

  useEffect(() => {
    if (!liveStream) return
    return analyse(liveStream)
  }, [liveStream, analyse])

  useEffect(() => {
    if (!blob) return
    const objectUrl = URL.createObjectURL(blob)
    url.current = objectUrl
    return () => {
      URL.revokeObjectURL(objectUrl)
      url.current = null
    }
  }, [blob])

  async function play(): Promise<void> {
    const audio = audioRef.current
    if (!audio) return
    if (playing) {
      audio.pause()
      return
    }
    // createMediaElementSource throws if called twice on one element, so a second tap on play would
    // break the player. Teardown waits for unmount for the same reason.
    if (!audio.dataset.wired) {
      audio.dataset.wired = 'yes'
      analyse(audio)
    }
    try {
      await audio.play()
    } catch {
      // Autoplay policy, or the blob will not decode in this browser. The ring stays still.
      setPlaying(false)
    }
  }

  const points = petalPoints(Math.min(1, level), seconds, phase, still || (!playing && !liveStream))

  return (
    <div className={styles.wrap}>
      <button
        type="button"
        className={styles.ring}
        onClick={() => void play()}
        disabled={!blob}
        aria-label={blob ? (playing ? 'Pause this voice memory' : 'Play this voice memory') : 'Listening'}
      >
        <svg viewBox="0 0 80 80" aria-hidden>
          {points.map((point, i) => {
            const [x, y] = point.split(',')
            return <circle key={i} cx={x} cy={y} r={2.4} className={styles.petal} />
          })}
          <circle cx={CENTRE} cy={CENTRE} r={9} className={styles.centre} />
          {!liveStream && (
            <text x={CENTRE} y={CENTRE + 3.5} className={styles.glyph} textAnchor="middle">
              {playing ? '❚❚' : '▶'}
            </text>
          )}
        </svg>
      </button>

      <span className={styles.meta}>
        {liveStream ? 'listening…' : `${seconds}s`}
        {onDelete && !liveStream && (
          <button
            type="button"
            className={styles.remove}
            onClick={onDelete}
            aria-label="Delete this voice memory"
          >
            remove
          </button>
        )}
      </span>

      {blob && (
        <audio
          ref={audioRef}
          src={url.current ?? undefined}
          onPlay={() => setPlaying(true)}
          onPause={() => setPlaying(false)}
          onEnded={() => setPlaying(false)}
        />
      )}
    </div>
  )
}
