# October 26 review

Reviewed the working tree based on `317c07b`. Normal verification and visual
fixtures use local or intercepted data and stub model generation; no Gemini quota
or real notes were used.

## Changes

- Session checks distinguish Accounts outages from signed-out sessions. Old
  responses are cancelled, and retry preserves the current identity. The device
  library stays available with an explicit recovery message.
- Account removals preserve Undo, restore rows on refused or failed requests,
  and flush pending requests when leaving the page. Both account collections
  follow the server's removal behavior. Account operations live in a focused hook.
- Library sharing and image failures show recovery copy, a selectable link and
  retry controls. The Undo control has a full touch target.
- The writing desk cancels delayed keyboard scrolling when the note loses focus
  or unmounts, keeping the next control steady. Scrolling respects reduced motion.
- The offline shell only refreshes from successful public homepage responses.
  Garden metadata, private preview images and cross-origin resources cannot
  enter that shell cache. Stable resources revalidate; old caches are cleared.
- Optional voice recording has a same-origin microphone policy and still needs
  browser permission. Recording releases its stream on stop, cap, error and
  startup failure. IndexedDB writes report success only after commit.
- Dependency patches, direct-main delivery guidance, current privacy facts and
  architecture boundaries are documented. Browser verification uses a separate
  local Worker state directory. GitHub Actions maintenance updates are grouped.

## Evidence

The final `pnpm run verify` passed: 269 web tests, 116 API tests, ten repository
guard tests and 74 Chromium/WebKit browser checks. Types, lint, formatting, CSS,
documentation, unused-code checks, security audit, build and bundle reporting
also passed. The dependency audit reported no known vulnerabilities.
The scrolling regression observes late native scroll requests with its clock
paused before typing. It fails in both engines when the focus cleanup is removed.
The navigation fixture receives real local HTTP requests and pins its proxy to
the configured loopback frontend. Destination tests reproduced the original
forwarding issue and now reject foreign origins, malformed targets and nonlocal
frontend configuration.

Regressions reproduced the original session race, false sign-out, silent removal,
lost removal on navigation, silent library sharing failures, delayed mobile focus scrolling, unsafe shell caching,
blocked microphone policy, retained recording streams and premature storage
success. Existing Undo, rendering and accounting for claimed gardens remain
covered; deadlines and repository budgets were not raised.

The capture script checked composer, draft, growth, result, recipient, schedule,
library, empty and privacy views at 320, 390, 430, 768 and 1440px. Recovery-state
captures passed the same width and page-error checks. Selected desktop and phone
pixels were inspected:

- [Session recovery on a phone](session-error-390.png)
- [Removal recovery on a phone](removal-error-390.png)
- [Library sharing recovery on desktop](library-share-error-1440.png)
- [Current privacy facts](privacy-390.png)

## Limits

Media tests use stubs and do not access the physical microphone. Native recording,
playback, permissions, installed-app behavior, phone keyboards, share sheets and
spoken screen-reader output require real-device checks. The
[visitor walkthrough](../../visitor-review.md) is prepared and has not been run
with a first-time visitor.
