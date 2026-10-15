export function SecretEnvelope({ open }: { open: boolean }) {
  return (
    <svg width="18" height="14" viewBox="0 0 20 15" fill="none" aria-hidden focusable="false">
      <rect
        x="1"
        y="2.6"
        width="18"
        height="11.8"
        rx="2.2"
        fill="var(--cream)"
        stroke="currentColor"
        strokeWidth="1.2"
      />
      <path
        d="M1.7 3.3 L10 9.1 L18.3 3.3"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* Only the wax changes between states, because sealed-or-unsealed is exactly what this button
          reports. */}
      {!open && (
        <circle cx="10" cy="9.2" r="2.1" fill="var(--pink-mid)" stroke="var(--pink-deep)" strokeWidth="0.8" />
      )}
    </svg>
  )
}
