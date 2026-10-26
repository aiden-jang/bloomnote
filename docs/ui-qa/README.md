# Bloomnote UI verification

The [October 26 review](october-26/README.md) covers account recovery, library actions,
offline privacy, voice-resource cleanup and repository maintenance.

The [October 16 Safari flow review](flow-audit-oct16/README.md) records the current cross-browser
journeys and sharing recovery.

The [design](../../DESIGN.md) defines the botanical stationery treatment: green ink, ivory paper,
blush headlines and a two-column composer that stacks on phones. Recipient notes retain their own
paper card; the library becomes a two-column directory on desktop.

`packages/web/scripts/capture-ui.cjs` uses intercepted responses in isolated browser contexts.
It captures the fresh composer, a draft, a generated garden and sharing controls, growth feedback, the recipient
before and after opening, a scheduled garden, the signed-in library, an empty library and privacy.
No fixture enters production storage. The preview defaults to the web app on port 32100;
`BLOOMNOTE_UI_URL` selects another running preview. Optional
`BLOOMNOTE_BROWSER_PATH` and `BLOOMNOTE_PLAYWRIGHT_MODULE` select a local browser and runtime.

Desktop evidence uses 1440 × 1000 and phone evidence uses 390 × 844. Additional overflow checks
run at 320, 430 and 768px. Reduced motion is enabled; the recipient capture waits for the note's
actual reveal before taking the image.

On October 10, the captures were inspected at desktop and phone widths. All width checks passed
without page errors or horizontal overflow. Main text colors were checked against the ivory
background; secondary copy and blush text clear 4.5:1. The full `pnpm run verify` passed, including
the real browser journeys for drafts, growth, sharing, replies, archive tools, scheduling and legal
pages. Garden animation, focus, user-written notes, account redirects and storage behavior remain.

The new composer layout deliberately replaces the centered stack. The oversized desktop garden
zoom was removed so previews fit their columns. The open-garden button no longer pulses forever;
growth and opening remain the central animation. This update does not include a push or deployment.

The October 10 follow-up brings the note field into the first phone viewport, adds larger
color-based bouquet previews to library cards, and uses the same linked wordmark across the
composer, library and recipient screens. Growth keeps the real status and cancellation controls;
“A small botanical overreaction.” adds a quiet aside. Sharing gives sending and copying priority
above rerolling or starting another note. The empty archive now reads “Nothing growing yet. Very
low maintenance.”

Refreshed desktop and phone captures were inspected, including growth and the empty archive.
Five-swatch library fixtures also passed the 320, 390, 430, 768 and 1440px overflow checks. The
mobile demonstration uses the scene’s geometry scale so flowers remain inside the shorter garden;
recipient and generated gardens retain their normal scale. The full verification suite passed
(97 API tests, 245 web tests and 16 browser journeys), followed by final source checks and a
production build. These changes are committed locally on main; no push or deployment is included.

The October 10 sharing pass places Share and Copy link above the recipient preview in the finished composer. The note and flower meanings use flatter surfaces and tighter spacing. Generated and open-recipient captures were inspected at desktop and phone sizes; checks also cover 320, 430 and 768px.

## Writing desk landing — October 11

The composer leads with the note on an open writing surface. The garden sits beside it on desktop
and follows the writing controls on phones; keyboard order follows the same sequence. Matching
rounded studio cards and the separate marketing headline have been removed. Examples stay labeled,
and composing, draft recovery, generation and sharing retain their existing behavior.

Desktop (1280 × 900) and phone (390 × 844) captures were inspected. The note field is visible in
the opening phone viewport. Static checks, the production build and the frontend suite passed.
Two API checks timed out during the combined run and passed when rerun separately. The first
browser run lost its local Worker mid-suite; the restarted browser suite passed. The combined
runner is not recorded as green.

## Repository and recovery polish — October 14

See the [October 14 verification](october-14/README.md) for current responsive evidence, keyboard
and error recovery checks, and the limits of the browser review. Historical captures above record
the earlier design passes.
