# Soft flowers, green ink

The selected direction pairs soft clay flowers with forest-green controls, warm ivory letters and
Bloomnote's existing single-column composer and open meadow. Flower colors carry the pink, lilac
and yellow; the interface stays quiet enough for the sender's words.

The [rendered flower sheet](art/clay-study.svg) is generated from the actual runtime components.
It shows six full plants and their small specimen heads. The artwork is scalable SVG geometry,
not a flattened background or a replacement for the interactive garden.

## Flowers and saved gifts

New designs receive artVersion 3 after the design response is normalized. The model request,
generation quota, saved meanings and supplied colors are unchanged. ClayFlower.tsx and ClayHead.tsx
provide rounded dahlia, cosmos, sunflower, rose, bluebell and hydrangea families. Unfamiliar names
retain their names and meanings, with a drawable wildflower or bell-shaped fallback.

FlowerSVG.tsx retains the original renderer for unmarked gifts and the botanical renderer for
version 2. Portable backups and nested reply gardens preserve both version markers. Reading or
restoring an older gift never upgrades its flower artwork.

Scene plants, specimen heads, pressed images and reply-pair exports share the same flower geometry.
ClayPaint.tsx scopes gradients and shadows to each instance, including multiple gardens in one
export. Incomplete stored palettes are repaired before paints are built. Version 3 square cards
and link previews use the open meadow; earlier gifts retain their previous export composition.
Exports continue to omit the sender's note and secret.

Archive summaries store color swatches rather than complete flowers. Their small clay previews
are illustrative color summaries; opening or exporting a saved garden uses its actual flower data.

## Paper and interaction

Composer and recipient letters share ivory surfaces, a folded corner and a small clay flower mark.
The decorative mark is hidden from assistive technology and does not cover the reading-size control.
Headlines and main controls use green ink. The writer's text stays readable and editable.

An addressed ivory packet carries a small clay flower sticker. The sticker lifts, the flap unfolds
and the inner letter rises before the garden blooms. The note appears promptly. Keyboard activation
and reduced motion reach the same complete gift.

The sender's ready screen includes an inline recipient preview using the saved gift payload. It
can be rewrapped without generating flowers again. Primary sharing comes before the selectable link;
the actual recipient link is a separate secondary action. Scheduled gifts can be previewed while
the real link keeps its opening time. Preview mode omits recipient analytics, account-receive writes,
reactions, journals, and recipient sharing tools. Flower meanings and the secret can still be explored.

Blooming, watering, replies, secrets, scheduling and sharing retain their recipient behavior.
The clay bee appears only on ordinary gardens. Sympathy and get-well gardens
remain quiet. Reduced motion uses settled flower states without infinite sway.

## Review

The actual composer and recipient reveal were inspected in the connected browser at phone and
desktop sizes, including a 320px writing view with longer names and a longer note. The flower-meaning
interaction was checked on a phone. The rendered six-family sheet and square keepsake were also
inspected. Tests cover portable backups, mixed-version replies, real KV round trips, scoped paint
references, rasterization and shared live/export geometry. The browser journey checks version 3
plants and the spacing between the decorative mark and reading-size control.

The sender packet, inline opening, secret, flower meaning and rewrap were exercised with an isolated
API fixture. Previewing and rewrapping produced no extra generation, received-library or reaction
writes. A real recipient visit still recorded receipt. A scheduled sender preview opened while
the actual recipient link retained its countdown. The gift flow was inspected at 320px, 390px and
desktop width, including focus handoff to the ready heading and back to the wrapped packet.

The full non-browser verification chain passes, including builds, audit, source checks, frontend
tests and real Worker tests. Automated browser verification remains blocked by host permissions
when Chromium starts; those layout assertions have not completed in this environment.
