interface ForecastProfile {
  tone: string
  palette: string
  shape: string
  colors: [string, string, string]
}

export interface GardenForecast {
  tone: string
  palette: string
  shape: string
  light: string
  colors: [string, string, string]
  detailLevel: 1 | 2 | 3
  detailCopy: string
}

const PROFILES: Record<string, ForecastProfile> = {
  tender: {
    tone: 'soft & close',
    palette: 'blush, ivory, and washed lavender',
    shape: 'small rounded blooms',
    colors: ['#e8b7bd', '#f5ead8', '#c8bfd7'],
  },
  playful: {
    tone: 'bright & mischievous',
    palette: 'sunny yellow, coral, and a surprise pop',
    shape: 'mixed, offbeat petals',
    colors: ['#efc85a', '#e98b70', '#d46e91'],
  },
  wistful: {
    tone: 'quietly nostalgic',
    palette: 'dusty blue, faded mauve, and sage',
    shape: 'long, bell-like blooms',
    colors: ['#9eb2bf', '#b596a8', '#91a68d'],
  },
  celebratory: {
    tone: 'big & buoyant',
    palette: 'gold, magenta, and hot orange',
    shape: 'tall, full blooms',
    colors: ['#e5b83e', '#c95b88', '#e67d46'],
  },
  steady: {
    tone: 'grounded & reassuring',
    palette: 'forest, terracotta, and deep cream',
    shape: 'calm, even blooms',
    colors: ['#567451', '#bd765b', '#e6d7b8'],
  },
  natural: {
    tone: 'warm & unforced',
    palette: 'meadow green, cream, and soft rose',
    shape: 'a loose mix of blooms',
    colors: ['#78946a', '#eadfca', '#d99a9f'],
  },
}

const OCCASION_PROFILE: Record<string, keyof typeof PROFILES> = {
  birthday: 'celebratory',
  congrats: 'celebratory',
  anniversary: 'tender',
  'thank-you': 'steady',
  'get-well': 'tender',
  sympathy: 'steady',
  'just-because': 'natural',
}

const OCCASION_LIGHT: Record<string, string> = {
  birthday: 'bright afternoon light',
  congrats: 'bright afternoon light',
  anniversary: 'golden-hour light',
  'thank-you': 'warm afternoon light',
  'get-well': 'open-window morning light',
  sympathy: 'soft morning light',
  'just-because': 'easy sunlit warmth',
}

function noteDetail(message: string): Pick<GardenForecast, 'detailLevel' | 'detailCopy'> {
  const note = message.trim()
  const personalSignals = [
    /\b(remember|that time|when we|you always|you still|our first|our last|every time)\b/i,
    /\d/,
    /[“”"']/,
    /[!?]/,
  ].filter((pattern) => pattern.test(note)).length
  const score = note.length >= 130 ? 2 : note.length >= 45 ? 1 : 0
  const detailLevel = Math.min(3, 1 + score + (personalSignals >= 2 ? 1 : 0)) as 1 | 2 | 3
  if (detailLevel === 3) {
    return {
      detailLevel,
      detailCopy: 'rich soil. there is enough specificity here to make it feel like theirs.',
    }
  }
  if (detailLevel === 2) {
    return {
      detailLevel,
      detailCopy: 'taking root. one tiny shared detail could make the bouquet more personal.',
    }
  }
  return {
    detailLevel,
    detailCopy: 'a small sprout so far. quirks, places, and oddly specific memories help it grow.',
  }
}

/** A deterministic, local preview of the direction sent to the model, never a fake final result. */
export function gardenForecast(message: string, mood: string, occasion: string): GardenForecast {
  const profileKey = mood !== 'none' && PROFILES[mood] ? mood : (OCCASION_PROFILE[occasion] ?? 'natural')
  const profile = PROFILES[profileKey] ?? PROFILES.natural!
  return {
    ...profile,
    light: OCCASION_LIGHT[occasion] ?? OCCASION_LIGHT['just-because']!,
    ...noteDetail(message),
  }
}
