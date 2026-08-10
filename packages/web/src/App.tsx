import { useCallback, useEffect, useMemo, useState } from 'react'
import Composer from './components/Composer'
import MyGardens from './components/MyGardens'
import RecipientView from './components/RecipientView'
import SealedView from './components/SealedView'
import Footer from './components/Footer'
import { LegalPage } from './components/LegalPage'
import { fetchGarden, isShortId, type GardenData } from './garden'

/**
 * Route shapes:
 *   /g/<short_id>  → recipient view (KV lookup)
 *   /r/<short_id>  → composer in remix mode (KV lookup, seed pre-filled)
 *   /mine          → on-device archive of gardens you've sent
 *   anything else  → composer (fresh)
 *
 * Only short IDs (6 chars from a curated base62 alphabet) are valid
 * path segments. Anything else after /g/ or /r/ — including legacy
 * long-encoded blobs — is treated as 404. Keeps the routing surface
 * small and the URL contract sharp.
 *
 * All URL parsing lives here, not in the leaf components. Composer and
 * RecipientView receive a fully resolved garden as a prop and render
 * it. Async loading state has exactly one home.
 */

type Route =
  | { kind: 'composer'; seed?: GardenData }                       // fresh OR resolved remix seed
  | { kind: 'recipient'; garden: GardenData; gardenId: string }   // resolved share
  | { kind: 'mine' }                                              // on-device archive
  | { kind: 'loading' }                                           // short ID, fetch pending
  | { kind: 'notfound' }                                          // 404 (bad ID, deleted, malformed)
  | { kind: 'loaderror' }                                         // transient fetch failure (offline/5xx) — retryable
  | { kind: 'privacy' }                                           // static legal page
  | { kind: 'terms' }                                             // static legal page

interface ParsedRoute {
  view: 'composer' | 'recipient' | 'mine' | 'privacy' | 'terms'
  short?: string  // 6-char base62 ID, ready for KV lookup
  malformed?: boolean
}

function parseRoute(): ParsedRoute {
  const path = window.location.pathname

  // /mine is a static, client-only route — no server lookup, reads
  // straight from localStorage in the view. Trailing slash tolerated.
  if (path === '/mine' || path === '/mine/') return { view: 'mine' }
  if (path === '/privacy' || path === '/privacy/') return { view: 'privacy' }
  if (path === '/terms' || path === '/terms/') return { view: 'terms' }

  const sharedMatch = path.match(/^\/g\/(.+)$/)
  if (sharedMatch) {
    const seg = sharedMatch[1]!
    return isShortId(seg)
      ? { view: 'recipient', short: seg }
      : { view: 'recipient', malformed: true }
  }

  const remixMatch = path.match(/^\/r\/(.+)$/)
  if (remixMatch) {
    const seg = remixMatch[1]!
    // A malformed remix segment isn't fatal — we just drop the seed
    // and show a fresh composer. Less punishing than 404'ing on a
    // mistyped URL.
    return isShortId(seg) ? { view: 'composer', short: seg } : { view: 'composer' }
  }

  return { view: 'composer' }
}

export default function App() {
  const parsed = useMemo(parseRoute, [])

  const [route, setRoute] = useState<Route>(() => {
    if (parsed.view === 'mine') return { kind: 'mine' }
    if (parsed.view === 'privacy') return { kind: 'privacy' }
    if (parsed.view === 'terms') return { kind: 'terms' }
    if (parsed.view === 'recipient') {
      if (parsed.malformed) return { kind: 'notfound' }
      return { kind: 'loading' }
    }
    if (parsed.short) return { kind: 'loading' }
    return { kind: 'composer' }
  })
  // Bumped by the retry button to re-run the fetch effect after a transient failure.
  const [retryNonce, setRetryNonce] = useState(0)
  const retryLoad = useCallback(() => {
    setRoute({ kind: 'loading' })
    setRetryNonce((n) => n + 1)
  }, [])

  // Fetch the garden by short ID. AbortController guards against the
  // StrictMode double-invoke racing with itself (or a fast navigation
  // that supersedes the in-flight request).
  useEffect(() => {
    if (!parsed.short) return
    const ctrl = new AbortController()
    void (async () => {
      try {
        const garden = await fetchGarden(parsed.short!, ctrl.signal)
        if (ctrl.signal.aborted) return
        if (!garden) {
          // A real 404 is a hard dead-end. Composer falls back to a
          // fresh form — same friendlier behavior as a malformed seed.
          setRoute(
            parsed.view === 'recipient'
              ? { kind: 'notfound' }
              : { kind: 'composer' },
          )
          return
        }
        setRoute(
          parsed.view === 'recipient'
            ? { kind: 'recipient', garden, gardenId: parsed.short! }
            : { kind: 'composer', seed: garden },
        )
      } catch (err) {
        // Aborted (StrictMode/navigation) isn't a failure — let the superseding run win.
        if (ctrl.signal.aborted || (err instanceof DOMException && err.name === 'AbortError')) return
        // Transient (offline/5xx): offer a retry for a recipient; a seed link just falls back to
        // the composer so the sender can still write.
        setRoute(parsed.view === 'recipient' ? { kind: 'loaderror' } : { kind: 'composer' })
      }
    })()
    return () => ctrl.abort()
  }, [parsed, retryNonce])

  // Every view shares one site footer (made by · privacy · terms), rendered here so it stays
  // consistent across the composer, recipient, sealed, mine, and error views.
  const view =
    route.kind === 'mine' ? (
      <MyGardens />
    ) : route.kind === 'loading' ? (
      <LoadingShell />
    ) : route.kind === 'notfound' ? (
      <NotFoundShell />
    ) : route.kind === 'loaderror' ? (
      <LoadErrorShell onRetry={retryLoad} />
    ) : route.kind === 'recipient' ? (
      <RecipientGateway garden={route.garden} gardenId={route.gardenId} />
    ) : route.kind === 'privacy' ? (
      <LegalPage kind="privacy" />
    ) : route.kind === 'terms' ? (
      <LegalPage kind="terms" />
    ) : (
      <Composer remixSeed={route.seed} />
    )

  return (
    <>
      {view}
      <Footer />
    </>
  )
}

/**
 * Time-capsule gate. If the garden has an `unlockAt` in the future,
 * render SealedView and swap to RecipientView once the clock crosses
 * the unlock moment. Otherwise render RecipientView immediately.
 *
 * Lives here (not inside RecipientView) so RecipientView stays a pure
 * "given a garden, render it" component — the gating concern is
 * routing-adjacent, not recipient-rendering.
 */
function RecipientGateway({ garden, gardenId }: { garden: GardenData; gardenId: string }) {
  const isSealed = (unlockAt?: string): boolean => {
    if (!unlockAt) return false
    const t = new Date(unlockAt).getTime()
    return Number.isFinite(t) && t > Date.now()
  }

  const [sealed, setSealed] = useState(() => isSealed(garden.unlockAt))

  // The SealedView's own clock ticks and calls onUnlock when the
  // moment arrives. We just flip our flag and let RecipientView take
  // over. A page refresh after unlock skips the sealed path entirely.
  if (sealed && garden.unlockAt) {
    return (
      <SealedView
        gardenId={gardenId}
        from={garden.from}
        to={garden.to}
        unlockAt={garden.unlockAt}
        onUnlock={() => setSealed(false)}
      />
    )
  }
  return <RecipientView gardenData={garden} gardenId={gardenId} />
}

// Minimal loading state — kept dependency-free so it can render
// while the rest of the bundle is still being parsed.
function LoadingShell() {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '60vh',
        color: 'var(--color-ink-muted, #6b6963)',
        fontSize: '0.95rem',
        letterSpacing: '0.02em',
      }}
    >
      <span>opening…</span>
    </div>
  )
}

/**
 * 404 state.
 *
 * The copy here used to say the link "may have expired," which is false and badly so. Gardens are
 * stored with no TTL precisely because a keepsake link has to keep working (see the KV layout note
 * in the API's gardens.ts). Telling a recipient their gift expired invents a loss that didn't
 * happen, and makes the product sound like it throws presents away.
 *
 * What actually lands someone here is a broken link: chat apps truncate long URLs, and people
 * retype them. So the page says the garden is still there and points at the one thing that
 * recovers it — asking the sender to send the link again. Starting a new garden stays available
 * but is second, since a person who came here to receive something didn't come to write one.
 */
function NotFoundShell() {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '60vh',
        gap: '0.75rem',
        textAlign: 'center',
        padding: '1.5rem',
      }}
    >
      <p style={{ fontFamily: 'Fraunces, serif', fontSize: '1.4rem' }}>
        that link didn&rsquo;t lead anywhere.
      </p>
      <p
        style={{
          color: 'var(--color-ink-muted, #6b6963)',
          fontSize: '0.95rem',
          maxWidth: '30rem',
          lineHeight: 1.6,
        }}
      >
        gardens never expire, so if someone grew you one, it&rsquo;s still there. links get cut
        short in messages more often than you&rsquo;d think. worth asking them to send it again.
      </p>
      <a
        href="/"
        style={{
          marginTop: '1rem',
          color: 'var(--color-accent, #4a7c3f)',
          textDecoration: 'underline',
        }}
      >
        or grow one for someone
      </a>
    </div>
  )
}

// Transient load failure (offline / server hiccup), distinct from a real 404: the garden is
// probably fine, so offer a retry instead of claiming the link is gone.
function LoadErrorShell({ onRetry }: { onRetry: () => void }) {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '60vh',
        gap: '0.75rem',
        textAlign: 'center',
        padding: '1.5rem',
      }}
    >
      <p style={{ fontFamily: 'Fraunces, serif', fontSize: '1.4rem' }}>
        couldn&rsquo;t load that garden.
      </p>
      <p style={{ color: 'var(--color-ink-muted, #6b6963)', fontSize: '0.95rem' }}>
        looks like a connection hiccup, not a bad link.
      </p>
      <button
        type="button"
        onClick={onRetry}
        style={{
          marginTop: '1rem',
          color: 'var(--color-accent, #4a7c3f)',
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          textDecoration: 'underline',
          font: 'inherit',
        }}
      >
        try again
      </button>
    </div>
  )
}
