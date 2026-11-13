import { usePageAnalytics } from './usePageAnalytics.js'
import { pageForPath } from '../../../analytics/schema.js'
import { AppUpdate } from './AppUpdate'
import { Suspense, useCallback, useEffect, useMemo, useState } from 'react'
import RecipientView from './components/RecipientView'
import SealedView from './components/SealedView'
import Footer from './components/Footer'
import LetterHeader from './components/LetterHeader'
import { fetchGarden, type GardenData } from './garden'
import { lazyWithReload } from './lib/lazyWithReload'
import { parseRoute } from './lib/route'
import notice from './components/Notice.module.css'

/* Everything except the recipient view is code-split. That one stays in the main chunk because
   it is the screen a shared link lands on, and it should not wait on a second round trip. */
const Composer = lazyWithReload(() => import('./components/Composer'))
const MyGardens = lazyWithReload(() => import('./components/MyGardens'))
const LegalPage = lazyWithReload(() =>
  import('./components/LegalPage').then((m) => ({ default: m.LegalPage })),
)

type Route =
  | { kind: 'composer'; seed?: GardenData }
  | { kind: 'recipient'; garden: GardenData; gardenId: string }
  | { kind: 'mine' }
  | { kind: 'loading' }
  | { kind: 'notfound' }
  | { kind: 'loaderror' }
  | { kind: 'privacy' }
  | { kind: 'terms' }

export default function App() {
  const parsed = useMemo(() => parseRoute(window.location.pathname), [])

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
  const page =
    route.kind === 'loading'
      ? pageForPath(window.location.pathname)
      : route.kind === 'recipient'
        ? 'garden'
        : route.kind === 'composer'
          ? 'composer'
          : route.kind === 'mine'
            ? 'mine'
            : route.kind === 'privacy'
              ? 'privacy'
              : route.kind === 'terms'
                ? 'terms'
                : 'other'
  usePageAnalytics(page)
  const [retryNonce, setRetryNonce] = useState(0)
  const retryLoad = useCallback(() => {
    setRoute({ kind: 'loading' })
    setRetryNonce((n) => n + 1)
  }, [])

  // AbortController guards against the StrictMode double-invoke racing with itself, and against
  // a fast navigation superseding the in-flight request.
  useEffect(() => {
    if (!parsed.short) return
    const ctrl = new AbortController()
    const timeout = window.setTimeout(() => {
      ctrl.abort()
      setRoute({ kind: 'loaderror' })
    }, 10_000)
    void (async () => {
      try {
        const garden = await fetchGarden(parsed.short!, ctrl.signal)
        if (ctrl.signal.aborted) return
        if (!garden) {
          setRoute({ kind: 'notfound' })
          return
        }
        setRoute(
          parsed.view === 'recipient'
            ? { kind: 'recipient', garden, gardenId: parsed.short! }
            : { kind: 'composer', seed: garden },
        )
      } catch {
        if (!ctrl.signal.aborted) setRoute({ kind: 'loaderror' })
      } finally {
        window.clearTimeout(timeout)
      }
    })()
    return () => {
      window.clearTimeout(timeout)
      ctrl.abort()
    }
  }, [parsed, retryNonce])

  useEffect(() => {
    const title =
      route.kind === 'recipient'
        ? `A garden${route.garden.to ? ` for ${route.garden.to}` : ' for you'}`
        : route.kind === 'mine'
          ? 'Your gardens'
          : route.kind === 'composer'
            ? 'Write a note'
            : route.kind === 'privacy'
              ? 'Privacy'
              : route.kind === 'terms'
                ? 'Terms'
                : route.kind === 'notfound'
                  ? 'Garden not found'
                  : route.kind === 'loaderror'
                    ? 'Couldn’t open garden'
                    : 'Opening garden'
    document.title = `${title} · bloomnote`
  }, [route])

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
      {/* Every route's content in one landmark, so assistive tech has something to jump to.
          LegalPage's own <main> is a <div> so this stays the only one. */}
      <main>
        <Suspense fallback={<LoadingShell title="Opening…" />}>{view}</Suspense>
      </main>
      <AppUpdate />
      <Footer />
    </>
  )
}

function RecipientGateway({ garden, gardenId }: { garden: GardenData; gardenId: string }) {
  const isSealed = (unlockAt?: string): boolean => {
    if (!unlockAt) return false
    const t = new Date(unlockAt).getTime()
    return Number.isFinite(t) && t > Date.now()
  }

  const [sealed, setSealed] = useState(() => isSealed(garden.unlockAt))

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

function LoadingShell({ title = 'Opening your garden.' }: { title?: string }) {
  return (
    <div className={notice.page} data-letter-page="system">
      <LetterHeader />
      <div className={notice.content} role="status">
        <h1 className={notice.title}>{title}</h1>
        <p className={notice.body}>One moment.</p>
        <div className={`${notice.card} ${notice.loading}`} aria-hidden="true">
          <div className={notice.skeleton} />
          <div className={notice.skeleton} />
          <div className={notice.skeleton} />
        </div>
      </div>
    </div>
  )
}

function NotFoundShell() {
  return (
    <div className={notice.page} data-letter-page="system">
      <LetterHeader />
      <div className={notice.content}>
        <h1 className={notice.title}>This garden couldn&rsquo;t be found.</h1>
        <div className={notice.card}>
          <h2 className={notice.heading}>Check the full link.</h2>
          <p className={notice.body}>
            The address may be incomplete. Try opening the original message or asking the sender to share it
            again.
          </p>
          <a className={notice.action} href="/">
            write a new note
          </a>
          <a className={notice.secondaryAction} href="/mine">
            your gardens
          </a>
        </div>
      </div>
    </div>
  )
}

// Transient failure, not a real 404: the garden is probably fine, so offer a retry rather than
// claiming the link is gone.
function LoadErrorShell({ onRetry }: { onRetry: () => void }) {
  return (
    <div className={notice.page} data-letter-page="system">
      <LetterHeader />
      <div className={notice.content}>
        <h1 className={notice.title}>couldn&rsquo;t load that garden.</h1>
        <div className={notice.card}>
          <p className={notice.body}>looks like a connection hiccup, not a bad link.</p>
          <div className={notice.actions}>
            <button type="button" className={notice.action} onClick={onRetry}>
              try again
            </button>
            <a className={notice.secondaryAction} href="/">
              write a new note
            </a>
          </div>
        </div>
      </div>
    </div>
  )
}
