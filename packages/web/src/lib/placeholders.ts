import { DEFAULT_OCCASION, occasionTone } from './occasions'

//
// Every occasion needs a `default`, used for "natural" and any mood without its own variant.
// Voice: lowercase, specific, warm, occasionally dry. No em dashes.

type MoodVariants = { default: string } & Partial<Record<string, string>>

const PLACEHOLDERS: Record<string, MoodVariants> = {
  'just-because': {
    default: 'no reason. just thinking about you and figured you should know.',
    tender: 'thinking about you. you’re good to have around.',
    playful: 'you crossed my mind. got flowers involved.',
    wistful: 'drove past our old spot today. thought of you there.',
    celebratory: 'no occasion. just felt like making a small fuss over you.',
    steady: 'nothing particular to say. just glad you’re around.',
  },
  birthday: {
    default: 'happy birthday. glad you’re here.',
    tender: 'happy birthday. very glad i get to know you.',
    playful: 'happy birthday. another excellent excuse to get food.',
    wistful: 'happy birthday. wish we were getting cake in the same place.',
    celebratory: 'happy birthday. i made a small fuss. flowers were involved.',
    steady: 'happy birthday. same team, another year.',
  },
  'thank-you': {
    default: 'thanks for the other day. i should have said it properly, so here we are.',
    tender: 'you made a difficult day easier. just wanted you to know.',
    playful: 'thanks for coming through. i got flowers involved.',
    wistful: 'still think about that thing you did. thank you, properly this time.',
    celebratory: 'you really came through. consider these a small round of applause.',
    steady: 'thanks for being the person i can ask. it makes a difference.',
  },
  anniversary: {
    default: 'another year of us. still a good arrangement.',
    tender: 'i’d pick this again. and you, obviously.',
    playful: 'another year of deciding what to eat together. still in.',
    wistful: 'thinking about where we started. glad it turned into this.',
    celebratory: 'happy anniversary. quite like what we’ve got going on.',
    steady: 'same us. another year. i like that.',
  },
  congrats: {
    default: 'knew you had it. still nice to see it happen.',
    tender: 'you worked for this. i’m really glad you get to have it.',
    playful: 'you did the thing. will be mentioning that i know you.',
    wistful: 'remember when this was just an idea. look at you.',
    celebratory: 'you did it. flowers felt appropriate.',
    steady: 'proud of you. you put the work in.',
  },
  'get-well': {
    default: 'thinking of you. hope today feels a little easier.',
    tender: 'wish i could make this easier. sending you a little company.',
    playful: 'sending some company for today. reply whenever you feel like it.',
    wistful: 'miss having you around. thinking of you while you rest.',
    celebratory: 'rooting for you. taking it one day at a time.',
    steady: 'i’m around if you need anything. no need to reply.',
  },
  sympathy: {
    default: 'thinking of you. i’m here if you want company.',
    tender: 'i don’t have the right words. i’m thinking of you.',
    playful: 'i’m here. we can talk, or we can just sit.',
    wistful: 'thinking of you, and of them. here to listen when you want.',
    celebratory: 'sending you care. there’s no need to find words today.',
    steady: 'you don’t have to reply. just know i’m here.',
  },
}

export function placeholderFor(occasion: string, mood: string): string {
  if (occasionTone(occasion) === 'neutral') return PLACEHOLDERS[DEFAULT_OCCASION]!.default
  const set = PLACEHOLDERS[occasion] ?? PLACEHOLDERS[DEFAULT_OCCASION]!
  return set[mood] ?? set.default
}

export function placeholderOptions(occasion: string, mood: string): string[] {
  if (occasionTone(occasion) === 'neutral') return [PLACEHOLDERS[DEFAULT_OCCASION]!.default]
  const set = PLACEHOLDERS[occasion] ?? PLACEHOLDERS[DEFAULT_OCCASION]!
  return [
    ...new Set(
      [set[mood], set.default, ...Object.values(set)].filter((note): note is string => Boolean(note)),
    ),
  ]
}
