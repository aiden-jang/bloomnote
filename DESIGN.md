# Bloomnote UI

Bloomnote pairs soft clay flowers with botanical stationery: warm ivory paper, deep forest-green
controls and restrained sage surroundings. Flower color carries the blush, lilac and golden accents.
Fraunces carries expressive headings, notes and signatures; DM Sans carries
controls. Sender-written notes remain distinct from generated flower meanings.

Letter garden is a single-column writing desk. The greeting puts the recipient above the note;
the optional sender name sits below it as a signature. A paper sheet holds these fields and the
secret-note disclosure. Editable fields stay at least 16px on phones, and the note remains inside
the opening viewport. The empty letter uses a shorter writing area with compact paper spacing. The writing headline pairs upright text with a blush italic line.

Occasion, mood, scheduling and the garden forecast remain available below the sheet. The forecast
is a disclosure so it does not compete with writing or sending. The main action explains that
words become flowers and that sharing the link is a separate step. Draft recovery, Clear and Undo
retain their existing focus behavior. Writing has one described hint: an empty, unfocused note shows
the time-of-day invitation; focus or entered words show the occasion-aware helper. The character
count stays alongside it, and both suggestion controls retain generous touch targets.

Examples show real flowers on an empty desk. A compact, labeled specimen sits beside the introduction
using static versions of the existing full-plant art; beginning a draft removes it. Generated and recipient
gardens retain their live meadow. Generation shows the live growing garden and
Cancel action, followed by the sender's note on paper. The finished composer presents an addressed
ivory packet with a clay flower sticker and small specimens of the chosen flowers. Its inline preview
reuses the recipient view: opening reveals the saved garden, original note, optional secret and
meanings. A rewrap action restores focus to the packet. The ready heading receives focus after
generation, and primary sharing sits above the selectable garden link. Image saving, different
flowers and another garden remain secondary. The actual recipient link is available separately.
A failed reroll retains the previous gift.

The sender preview does not record recipient visits, received-library entries, reactions or flower
journal edits. The sender's scheduled-gift screen displays its saved opening time with year and timezone;
the sender can preview the future opening without changing when the actual recipient link opens.

Recipient pages place a wider open meadow above a centered letter. The garden has a soft atmospheric
ground and a thin baseline instead of a boxed soil bed. Flower geometry and growth, sway, bee,
watering, mood and time-of-day behavior remain in the live scene. Reduced motion and keyboard
focus remain available. Flower tools and their journal editor open in paper panels below the
meadow. Flower details and journal entries use static full-plant art. Device storage, voice
memories, keyboard controls and quiet shelves retain their existing behavior.

The recipient heading addresses the recipient directly. The sender's note sits on a paper sheet,
with its signature, reading-size control, generated explanation and optional secret. Replying and
sharing follow a quiet rule below the letter, with a filled main action and readable secondary tools. The keepsake disclosure retains image saving, copying, printing,
replaying, the flower journal and voice memories. Flower meanings and reply history remain below.

Normal routes share the in-flow letter header with the wordmark, account controls and sound.
Controls wrap on narrow screens and long account names stay bounded. Shared wordmarks return
home. The crash page uses a static wordmark because the failed tree includes the account provider.

The garden library uses two columns on wide screens and one on phones. Ivory paper cards place
static, color-based full-plant silhouettes above recipient names and quiet action rows. These
previews use the list's color summaries without fetching complete gardens. Backup and restore is
reachable before the list. Empty sent, received and device-only libraries share the existing
potted-seedling art, while retaining their own copy and actions. Empty libraries do not mount a
garden scene.

Scheduled gardens place a sealed envelope on paper, with the exact local opening date including
the year, a countdown showing at most two units and calendar reminders. Legal pages share the
letter header and pair a contents column with readable text on wide screens; they stack on
phones. Their legal prose remains unchanged.

Loading, missing gardens and connection failures use matching paper notices. Loading shows a
quiet placeholder; missing gardens point back to the full link; connection failures offer retry.

Dry humor belongs in supporting copy, never user-written notes, errors, dates, privacy or account
controls. Errors explain recovery and retain entered words. Reply-link failures offer retry;
image-export feedback belongs to the garden that started it. Installed-app updates keep the page
open until the visitor chooses to reload. UI captures use isolated fixtures and synthetic notes.

The composer leads with “A note. With flowers.” Supporting humor stays understated. Sympathy and
get-well copy stays gentle across moods; unknown occasions use neutral wording. See the
[copy guide](docs/copy-plan.md).

## Soft flowers, green ink

The letter and meadow layout remains recognizable. New gardens use authored, dimensional SVG flowers:
layered dahlia, airy cosmos, seeded sunflower, cupped rose, hanging bluebell and clustered hydrangea.
Soft radial shading, curved stems and a small clay bee carry the material direction. Unknown flowers
keep their supplied names, meanings and colors, using a drawable fallback silhouette.

New flower art is versioned so original and botanical gifts keep their existing appearance.
Scene, specimen and export art share geometry and scoped paints. New square keepsakes and link
previews use the open meadow, while previous gifts retain their export compositions. Ivory letters
use soft corners, a folded edge and a small flower mark clear of the text-size control.
Archive swatch previews share the clay material without claiming to reproduce a complete saved garden.

The [rendered flower sheet](docs/art/clay-study.svg) shows the actual six-family renderer and
thumbnail heads. [The implementation direction](docs/cute-direction.md) records compatibility and review.
