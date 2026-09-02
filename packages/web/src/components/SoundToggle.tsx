import { useState } from 'react'
import { createPortal } from 'react-dom'
import { isSoundEnabled, toggleSound } from '../sound'
import styles from './SoundToggle.module.css'

export default function SoundToggle() {
  const [enabled, setEnabled] = useState(() => isSoundEnabled())

  return createPortal(
    <button
      type="button"
      className={styles.toggle}
      onClick={() => setEnabled(toggleSound())}
      aria-pressed={enabled}
      aria-label={enabled ? 'mute sound' : 'unmute sound'}
      title={enabled ? 'sound on' : 'sound off'}
    >
      {enabled ? <SpeakerOn /> : <SpeakerOff />}
    </button>,
    document.body,
  )
}

function SpeakerBody() {
  return (
    <path
      d="M3 9v6h4l5 4V5L7 9H3z"
      fill="currentColor"
      stroke="currentColor"
      strokeWidth="1.2"
      strokeLinejoin="round"
    />
  )
}

function SpeakerOn() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
      <SpeakerBody />
      <path
        d="M16 8.5a5 5 0 0 1 0 7M18.5 6a8.5 8.5 0 0 1 0 12"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        fill="none"
      />
    </svg>
  )
}

function SpeakerOff() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
      <SpeakerBody />
      <path
        d="M16 9.5l5 5M21 9.5l-5 5"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        fill="none"
      />
    </svg>
  )
}
