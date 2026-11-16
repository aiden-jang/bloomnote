import { describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { OCCASIONS, occasionTone } from './occasions'
import { MOODS } from './moods'
import { placeholderFor, placeholderOptions } from './placeholders'
import { gardenForecast } from './gardenForecast'
import GrowFeedback from '../components/GrowFeedback'
import NoteField from '../components/NoteField'
import ComposerSecret from '../components/ComposerSecret'
import { ritual } from './rituals'

const sensitive = ['sympathy', 'get-well']

describe('occasion-sensitive supporting copy', () => {
  it('limits humor to recognized ordinary occasions and treats old values neutrally', () => {
    for (const { value } of OCCASIONS) {
      expect(occasionTone(value)).toBe(sensitive.includes(value) ? 'sensitive' : 'ordinary')
    }
    for (const value of [undefined, null, '', 'retired-occasion']) {
      expect(occasionTone(value)).toBe('neutral')
    }
    for (const { value: mood } of MOODS) {
      const fallback = placeholderFor('retired-occasion', mood)
      expect(fallback).toBe(placeholderFor('just-because', 'none'))
      expect(placeholderOptions('retired-occasion', mood)).toEqual([fallback])
    }
  })

  it('keeps gentle guidance and the growing screen across every mood on hard occasions', () => {
    for (const occasion of [...sensitive, 'retired-occasion']) {
      for (const { value: mood } of MOODS) {
        const feedback = renderToStaticMarkup(
          <GrowFeedback
            scene={null}
            message="my own words"
            occasion={occasion}
            statusText="choosing flowers…"
            onCancel={() => {}}
          />,
        )
        expect(feedback).toContain('Choosing flowers for your note.')
        expect(feedback).not.toContain('botanical overreaction')
        const field = renderToStaticMarkup(
          <NoteField
            occasion={occasion}
            ritual={ritual(occasion)}
            value="my own words"
            onChange={() => {}}
            inputRef={{ current: null }}
            prompt={placeholderFor(occasion, mood)}
            hasAnotherPrompt
            onAnotherPrompt={() => {}}
          />,
        )
        expect(field).toContain('A short note is enough.')
        expect(field).toContain('my own words')
        const secret = renderToStaticMarkup(
          <ComposerSecret occasion={occasion} value="a personal aside" onChange={() => {}} />,
        )
        expect(secret).toContain('One more thing you’d like them to know.')
        expect(secret).toContain('a personal aside')
        for (const message of ['here', 'a longer personal memory. '.repeat(8)]) {
          expect(gardenForecast(message, mood, occasion).detailCopy).toBe('Your note can stay simple.')
        }
      }
    }
  })

  it('keeps the ordinary aside available for an ordinary note', () => {
    expect(
      renderToStaticMarkup(
        <GrowFeedback
          scene={null}
          message="my own words"
          occasion="birthday"
          statusText="choosing flowers…"
          onCancel={() => {}}
        />,
      ),
    ).toContain('A small botanical overreaction.')
  })

  it('keeps every prompt rotation usable and gentle regardless of the selected mood', () => {
    const unique = new Set<string>()
    for (const { value: occasion } of OCCASIONS) {
      for (const { value: mood } of MOODS) {
        const options = placeholderOptions(occasion, mood)
        expect(options[0]).toBe(placeholderFor(occasion, mood))
        expect(new Set(options).size).toBe(options.length)
        for (const note of options) {
          unique.add(note)
          expect(note.length).toBeGreaterThanOrEqual(4)
          expect(note.length).toBeLessThanOrEqual(400)
          if (sensitive.includes(occasion)) {
            expect(note).not.toMatch(
              /doctor|orders|comeback|causing problems|group chat|boring|heal up|get better|no clever|flowers involved/i,
            )
          }
        }
      }
    }
    expect(unique.size).toBe(42)
  })
})
