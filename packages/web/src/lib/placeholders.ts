import { DEFAULT_OCCASION } from './occasions'

// Example notes shown as the composer's placeholder, curated per occasion and
// flavored by mood. The goal is that picking "hbd" + "unserious" previews a
// funny birthday note, while "ty" + "soft" previews a heartfelt thank-you, so
// the empty field already suggests what to write.
//
// Every occasion has a `default` (used for "no vibe" and any mood without its
// own variant). Voice: lowercase, specific, warm, occasionally dry. No em dashes.

type MoodVariants = { default: string } & Partial<Record<string, string>>

const PLACEHOLDERS: Record<string, MoodVariants> = {
  'just-because': {
    default: 'no reason. just thinking about you and figured you should know.',
    tender: "thinking about you. nothing deep, you're just good to have around.",
    playful: "you crossed my mind, so now you're getting a whole garden about it. deal with it.",
    wistful: "drove past our old spot today. anyway. hope you're good.",
    celebratory: 'no occasion, just felt like making a fuss over you for once.',
    steady: "no reason. just your periodic reminder that i'm around if you need me.",
  },
  birthday: {
    default: 'happy birthday. glad you were born, etc etc.',
    tender: "happy birthday. you're a good one, don't let it go to your head.",
    playful: "another year, still can't parallel park, still my favorite. happy birthday.",
    wistful: 'another one of these with you. not mad about it. happy birthday.',
    celebratory: "happy birthday. we're making it a whole thing this year, sorry in advance.",
    steady: "happy birthday. same as every year: i've got you. now go eat cake.",
  },
  'thank-you': {
    default: "thanks for the other day. meant more than i said out loud, which wasn't much.",
    tender: 'you showed up without me having to ask. noted. thank you, genuinely.',
    playful: "you're in my will now. it's mostly snacks. thanks for everything.",
    wistful: "still think about that thing you did for me. never properly said it: thanks.",
    celebratory: 'you came through big. consider this garden your parade. thank you.',
    steady: "thanks. you're the 2am call person, and that's not nothing.",
  },
  anniversary: {
    default: 'another year of you leaving every cabinet open. still in. happy anniversary.',
    tender: "i'd pick this again. obviously. happy anniversary.",
    playful: 'congrats to us for not losing it. mostly. love you.',
    wistful: 'remember that terrible first apartment. look at us now. anyway, love you.',
    celebratory: 'cheers to us. more years, more nonsense. happy anniversary.',
    steady: "another year, same deal: not going anywhere. happy anniversary.",
  },
  congrats: {
    default: "you did the thing. knew you would. don't make it weird.",
    tender: 'you worked for this and it shows. quietly very proud of you.',
    playful: 'big w. i want a shout-out in the speech. congrats.',
    wistful: 'remember when this was just a maybe. look at you now. congrats.',
    celebratory: 'you DID it. already telling everyone. congrats, seriously.',
    steady: 'never doubted it for a second. you earned this. proud of you.',
  },
  'get-well': {
    default: "rest up, don't rush it. the group chat's boring without you anyway.",
    tender: 'take it slow. sending good things while you heal.',
    playful: "doctor's orders (mine): bad tv, zero responsibilities, get better.",
    wistful: "it's too quiet without you causing problems. heal up, come back.",
    celebratory: 'planning your comeback tour already. rest first, though.',
    steady: "whatever you need while you're down, i've got it. just rest.",
  },
  sympathy: {
    default: "no words feel right, so i'll just say i'm around. whenever.",
    tender: 'not going to try to fix it. just here, for whatever you need.',
    playful: "no clever way to say this one. i'm just here, and i mean it.",
    wistful: 'thinking of you today. and of them. here if you want to talk.',
    celebratory: "holding you in mind today. no rush, no words needed. i'm here.",
    steady: "you don't have to do this alone. i'm not going anywhere.",
  },
}

/**
 * A curated example note for the chosen occasion + mood. Falls back to the
 * occasion's default variant, then to the default occasion, so any combination
 * returns something fitting.
 */
export function placeholderFor(occasion: string, mood: string): string {
  const set = PLACEHOLDERS[occasion] ?? PLACEHOLDERS[DEFAULT_OCCASION]!
  return set[mood] ?? set.default
}

/** A few distinct human-written angles for the quiet "stuck" state in the composer. */
export function placeholderOptions(occasion: string, mood: string): string[] {
  const set = PLACEHOLDERS[occasion] ?? PLACEHOLDERS[DEFAULT_OCCASION]!
  return [...new Set([set[mood], set.default, ...Object.values(set)].filter((note): note is string => Boolean(note)))]
}
