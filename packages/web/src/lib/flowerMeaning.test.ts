import { describe, expect, it } from 'vitest'
import { withoutLeadingFlowerName } from './flowerMeaning'

/*
 * Both callers render this under a heading that already says the name, so getting it wrong shows
 * on the app's main screen: "Hydrangea. Hydrangea, for..." or a meaning that lost its first word.
 */
describe('withoutLeadingFlowerName', () => {
  it('drops the name and the comma after it, then recapitalizes', () => {
    expect(withoutLeadingFlowerName('Hydrangea', 'Hydrangea, for four hours in the rain.')).toBe(
      'For four hours in the rain.',
    )
  })

  // Without a comma there is no telling a sentence carrying on from a name carrying on, so this
  // leaves the text alone rather than risking "Of the valley, for constancy."
  it('keeps a meaning that runs on from the name without a comma', () => {
    expect(withoutLeadingFlowerName('Rose', 'Rose blooms twice a season.')).toBe(
      'Rose blooms twice a season.',
    )
  })

  it('matches the name whatever its case', () => {
    expect(withoutLeadingFlowerName('hydrangea', 'Hydrangea, for patience.')).toBe('For patience.')
  })

  it('ignores whitespace around the name', () => {
    expect(withoutLeadingFlowerName('  Rose  ', 'Rose, for a quiet year.')).toBe('For a quiet year.')
  })

  it('leaves a meaning that does not open with the name', () => {
    expect(withoutLeadingFlowerName('Rose', 'For a quiet year.')).toBe('For a quiet year.')
  })

  it('leaves a meaning alone when the name is all there is, rather than rendering nothing', () => {
    expect(withoutLeadingFlowerName('Rose', 'Rose')).toBe('Rose')
  })

  it('leaves the meaning alone when there is no name to strip', () => {
    expect(withoutLeadingFlowerName('', 'Rose, for a quiet year.')).toBe('Rose, for a quiet year.')
  })

  // The model writes the plural constantly. Matching on the bare prefix rendered "S, for a quiet
  // year." on the card, and "Lily" against "Lily of the valley" rendered "Of the valley,".
  it('does not strip a name that is only a prefix of the first word', () => {
    expect(withoutLeadingFlowerName('Rose', 'Roses, for a quiet year.')).toBe('Roses, for a quiet year.')
    expect(withoutLeadingFlowerName('Sweet pea', 'Sweet peas, for goodbye.')).toBe('Sweet peas, for goodbye.')
    expect(withoutLeadingFlowerName('Rose', 'Rosemary, for remembrance.')).toBe('Rosemary, for remembrance.')
    expect(withoutLeadingFlowerName('Lily', 'Lily of the valley, for constancy.')).toBe(
      'Lily of the valley, for constancy.',
    )
  })
})
