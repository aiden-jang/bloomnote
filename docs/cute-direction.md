# Botanical gift direction

Bloomnote presents a small paper gift that opens into a garden and the sender's letter.
The [authored botanical sheet](art/botanical-study.svg) records full plants and small specimens.
These are runtime SVG models, not a flattened generated background.

## Flowers and compatibility

New designs receive an optional per-flower artVersion marker of 2 in designGarden.ts. The model
request and quota are unchanged. FlowerSVG.tsx keeps the original renderer for flowers without that
marker. BotanicalFlower.tsx provides layered dahlia, airy cosmos, seeded sunflower, cupped rose,
hanging bluebell and clustered hydrangea heads, with different stems and leaves. Unknown names keep
their name and meaning and use a drawable wildflower silhouette. Bell-shaped unknowns get hanging
bells without relabeling the flower.

Scene flowers, specimen heads, pressed images and garden exports share the botanical geometry.
Original gifts retain their legacy renderer and export framing. Portable backups preserve the new
marker, including replies; restoring a legacy backup does not upgrade its art. The library summary
still stores color swatches rather than full flower specs, so its small archive flowers remain
illustrative swatch previews. It does not claim to reproduce an exact saved flower.

## Opening and interaction

GiftPacket.tsx addresses the folded packet with the saved recipient and sender names. One button
opens it by pointer or keyboard. The flap unfolds briefly before the live stems and flowers appear;
the sender's words appear promptly, independently of flower count. Focus moves to the recipient
heading after opening. Reduced motion skips the wrapper animation and settles the plants directly.
Empty flower lists can still reveal a note. Replaying regrows the same garden.

Sympathy and get-well gardens omit the traveling bee, drifting petals and mood aura. Ordinary gardens
keep the small bee, now with a readable face. Watering and replies remain optional gestures. The
feeling buttons use drawn botanical marks. Notes, composer paper and library cards share folded
edges, muted paper colors and a small keepsake treatment. Secrets sit on a tucked paper slip.
Existing errors, account state, drafts, sharing and access facts retain their direct copy.

## Review status

The new cat-and-garden concept shown in the conversation established palette and material direction.
The committed flower sheet was rendered from the actual SVG components and inspected at plant and
specimen sizes. Source checks cover legacy rendering, version preservation, SVG export reuse,
unknown-flower fallback and actual design-response normalization. The real Worker suite, including the KV round-trip regression, passes on the supported Node runtime.
Keyboard/browser opening checks are included, but the host blocks browser launch in this environment,
so full phone/desktop visual sign-off remains unverified here.
