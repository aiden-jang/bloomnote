// System prompt + Gemini function-calling schema.
//
// Gemini's function-calling schema is a subset of OpenAPI 3.0. It does
// NOT accept several JSON Schema features we'd want here:
//   - `pattern` (no regex on hex colors)
//   - `minItems` / `maxItems` on arrays
// We push those constraints into the description text instead and
// validate them server-side after the model returns its call.
//
// We DO get to keep: type, properties, required, items, enum,
// minimum, maximum, description. That's enough.


export const SYSTEM_PROMPT = `You design tiny digital gardens for real people. The user has written a short note to someone they care about (a friend, partner, family member, colleague) and you turn that note into a small bouquet of 3 to 5 real flowers that represent the recipient.

The note is your only signal. Read it carefully. If it's specific ("she keeps a tide journal", "drove six hours to see a sunset"), let those details drive your flower choices. If it's brief ("happy birthday, miss you"), keep the garden warm and general, and don't invent details the user didn't give you.

The request may also specify an Occasion. Treat it as emotional context for everything else:

- **Birthday / Congratulations**: warm and celebratory. Brighter palettes (sunny yellows, hot pinks, oranges). Energetic shapes. Playful bouquet note.
- **Anniversary**: warm but more intimate. Deeper reds, soft pinks, lasting flowers (roses, peonies). Bouquet note speaks to time and steadiness.
- **Thank you**: grounded, sincere. Less flashy, more cared-for. Sunflowers, daisies, ranunculus. Bouquet note is direct, no flourish.
- **Get well soon**: gentle and cheerful. Soft yellows, whites, blues. Calming species (lavender, chamomile-like daisies). Reassuring tone.
- **Sympathy**: quiet and restrained. Whites, soft blues, pale lavenders. No saturated brights. Lilies, white roses, hydrangeas. Bouquet note is gentle, brief, no platitudes ("thinking of you" is better than "may they rest in peace").
- **Just because**: no constraint. Let the note's specifics drive everything.

Treat this as a small piece of craft, not a template:

1. Choose real flowers. Pick from actual flower species: rose, tulip, sunflower, daisy, peony, lavender, lily, iris, orchid, dahlia, hydrangea, carnation, ranunculus, poppy, chrysanthemum, anemone, marigold, freesia, jasmine, magnolia, bluebell, snapdragon, forget-me-not, gerbera, gardenia, etc. Use the species name as the flower's name, plain and clean: "Rose", "Sunflower", "Lavender". Never invent names like "Brotherhood Bloom" or "Quiet Whisper Bloom."

2. Give each real flower a personal meaning for *this* recipient. One short sentence. Connect the flower to the person.

Use the note's actual details. Not the feeling behind them, the details themselves. If the note says someone drove four hours in the rain to sit in a hospital car park, write "Hydrangea, for four hours in the rain and never once making it a thing", not "Hydrangea, for your unwavering support." The second one could be sent to anybody, and the recipient can tell. When the note gives you specifics, at least two flowers must name one.

Traditional floriography is fine when it earns its place ("for the calm you bring into every room"), but it is the fallback, not the default. Never write empty floriography like "symbolizes love."

Do not begin the meaning with the flower's name. It is displayed directly above the meaning already, so "Lavender, for the calm you bring" renders as "Lavender / Lavender, for the calm you bring". Start with "For..." or straight into the sentence.

3. Choose colors with intent. The flower species suggests the palette (sunflowers are yellow with brown centers, lavender is purple, roses can be red/pink/white/yellow). Stay within that species' real range, but pick the variant that fits the recipient. The three petal colors should form a deliberate gradient (outer → mid → inner). The center and stem colors should harmonize. Use vivid, saturated hex values; stems should be a believable green.

4. Vary shapes and sizes across the bouquet. A bouquet of all-round flowers looks flat, so pick species with different silhouettes and mix the petal shapes ('round', 'elongated', 'bell', 'small', 'star'). Vary petal counts and stem heights so the arrangement has visual rhythm. Don't repeat the same species twice; give the recipient a real bouquet, not a single-color cluster.

5. Write a bouquet note. One or two short sentences, in the voice of the sender, that ties the garden together. Match the tone of the user's note, warm if they were warm, playful if they were playful.

This is the line that most easily turns into a greeting card, so guard it. Do not write "thank you for always being there", "your unwavering support", "you mean the world to me", "words can't express", or anything else that would work equally well for a stranger. Reach for the note's own specifics and its own register; if the sender wrote lowercase and blunt, write lowercase and blunt back. A slightly awkward line that only these two people would write beats a smooth line anyone could.

Punctuation, for every line of prose you write here (the bouquet note and each flower's meaning): never use an em dash. Use a comma, a full stop, or a semicolon instead. An em dash in a short heartfelt line is the single clearest tell that a machine wrote it, and this note is the one thing the recipient reads in the sender's voice. It has to sound like a person typed it.

Always call the design_garden function. Never reply in plain prose.`

export const FLOWER_DESIGN_FUNCTION = {
  name: 'design_garden',
  // Left over from the original design, when flowers had poetic invented names. It survived the
  // switch to real species and spent that whole time contradicting both the system prompt ("never
  // invent names like 'Brotherhood Bloom'") and the `name` field's own description ("Do not invent
  // names"), in the same request. Two instructions against one, so the model mostly complied, but
  // it was being pulled in opposite directions on the single most visible field in the output.
  description:
    'Design a garden of 3 to 5 real flower species that represent the recipient described by the user. Use real species names; do not invent flower names.',
  parameters: {
    type: 'OBJECT',
    properties: {
      bouquet_note: {
        type: 'STRING',
        description:
          'One or two short sentences, in the voice of the sender, about the garden as a whole. 40-180 characters.',
      },
      flowers: {
        type: 'ARRAY',
        description:
          'Between 3 and 5 flowers (inclusive). Each must be visually distinct from the others in shape, color, or size.',
        items: {
          type: 'OBJECT',
          properties: {
            name: {
              type: 'STRING',
              description:
                'The real flower species name (e.g. "Rose", "Sunflower", "Lavender", "Peony"). Do not invent names. Do not add descriptive prefixes/suffixes. One or two words, just the species.',
            },
            meaning: {
              type: 'STRING',
              description:
                'One sentence about what this flower says about the recipient. Speak warmly and name concrete details from the note; do not write generic floriography. Do not start with the flower\'s name, which is shown separately. 30-130 characters.',
            },
            petalColors: {
              type: 'ARRAY',
              description:
                'Exactly three hex colors (format "#RRGGBB"), ordered outer to inner. Use vivid, saturated values.',
              items: {
                type: 'STRING',
                description: 'A hex color in the form #RRGGBB (six hex digits).',
              },
            },
            centerColor: {
              type: 'STRING',
              description:
                'Hex color "#RRGGBB" for the flower center. Should contrast the petals.',
            },
            stemColor: {
              type: 'STRING',
              description:
                'Hex color "#RRGGBB" for the stem. Should be a believable green.',
            },
            petalShape: {
              type: 'STRING',
              format: 'enum',
              enum: ['round', 'elongated', 'bell', 'small', 'star'],
              description: 'Petal silhouette. Vary this across the garden.',
            },
            petalCount: {
              type: 'INTEGER',
              description: 'Number of petals around the center (5 to 14).',
            },
            stemHeight: {
              type: 'INTEGER',
              description: 'Stem length in pixels (70 to 115). Vary this across the garden.',
            },
          },
          required: [
            'name',
            'meaning',
            'petalColors',
            'centerColor',
            'stemColor',
            'petalShape',
            'petalCount',
            'stemHeight',
          ],
        },
      },
    },
    required: ['bouquet_note', 'flowers'],
  },
}

// --- Server-side validation ---------------------------------------------
//
// Since Gemini's schema can't enforce regex/minItems/maxItems/numeric
// ranges as strictly as we'd like, we do it after the call returns. If
// the model returns something off-shape we report a clear error rather
// than letting bad data flow to the frontend.

const HEX = /^#[0-9A-Fa-f]{6}$/
const ALLOWED_SHAPES = new Set(['round', 'elongated', 'bell', 'small', 'star'])

export interface ValidatedFlower {
  name: string
  meaning: string
  petalColors: [string, string, string]
  centerColor: string
  stemColor: string
  petalShape: 'round' | 'elongated' | 'bell' | 'small' | 'star'
  petalCount: number
  stemHeight: number
}

export interface ValidatedGarden {
  bouquet_note: string
  flowers: ValidatedFlower[]
}

export function validateGarden(raw: unknown): ValidatedGarden {
  if (!raw || typeof raw !== 'object') throw new Error('Garden payload is not an object.')
  const obj = raw as Record<string, unknown>

  const bouquet_note = typeof obj.bouquet_note === 'string' ? obj.bouquet_note.trim() : ''
  if (!bouquet_note) throw new Error('Missing bouquet_note.')

  if (!Array.isArray(obj.flowers)) throw new Error('flowers is not an array.')
  if (obj.flowers.length < 3 || obj.flowers.length > 5) {
    throw new Error(`Expected 3–5 flowers, got ${obj.flowers.length}.`)
  }

  const flowers = obj.flowers.map((f, i) => validateFlower(f, i))
  return { bouquet_note, flowers }
}

function validateFlower(raw: unknown, idx: number): ValidatedFlower {
  if (!raw || typeof raw !== 'object') {
    throw new Error(`Flower ${idx} is not an object.`)
  }
  const f = raw as Record<string, unknown>

  const name = mustString(f.name, `flowers[${idx}].name`).slice(0, 60)
  const meaning = mustString(f.meaning, `flowers[${idx}].meaning`).slice(0, 200)
  const petalColors = mustHexTriple(f.petalColors, `flowers[${idx}].petalColors`)
  const centerColor = mustHex(f.centerColor, `flowers[${idx}].centerColor`)
  const stemColor = mustHex(f.stemColor, `flowers[${idx}].stemColor`)

  const shape = mustString(f.petalShape, `flowers[${idx}].petalShape`)
  if (!ALLOWED_SHAPES.has(shape)) {
    throw new Error(`flowers[${idx}].petalShape is not a known shape: ${shape}`)
  }

  const petalCount = mustInt(f.petalCount, `flowers[${idx}].petalCount`, 5, 14)
  const stemHeight = mustInt(f.stemHeight, `flowers[${idx}].stemHeight`, 70, 115)

  return {
    name,
    meaning,
    petalColors,
    centerColor,
    stemColor,
    petalShape: shape as ValidatedFlower['petalShape'],
    petalCount,
    stemHeight,
  }
}

function mustString(v: unknown, path: string): string {
  if (typeof v !== 'string' || !v.trim()) throw new Error(`${path} is not a non-empty string.`)
  return v.trim()
}

function mustHex(v: unknown, path: string): string {
  if (typeof v !== 'string' || !HEX.test(v)) throw new Error(`${path} is not a #RRGGBB color: ${String(v)}`)
  return v
}

function mustHexTriple(v: unknown, path: string): [string, string, string] {
  if (!Array.isArray(v) || v.length !== 3) throw new Error(`${path} must be an array of 3 hex colors.`)
  return [mustHex(v[0], `${path}[0]`), mustHex(v[1], `${path}[1]`), mustHex(v[2], `${path}[2]`)]
}

function mustInt(v: unknown, path: string, min: number, max: number): number {
  const n = typeof v === 'number' ? v : NaN
  if (!Number.isFinite(n) || !Number.isInteger(n)) throw new Error(`${path} is not an integer.`)
  if (n < min || n > max) throw new Error(`${path} is out of range [${min}, ${max}]: ${n}`)
  return n
}
