import { describe, expect, it } from 'vitest'
import { makeVerseId, type Reference } from '../reference'
import type { Passage, PassageSource } from './module-passage-source'
import { TieredPassageSource } from './tiered-passage-source'

const JOHN_15_4 = makeVerseId(43, 15, 4)

const john15_4: Reference = {
  book: 43,
  ranges: [{ startId: JOHN_15_4, endId: JOHN_15_4 }],
}

const okPassage = (text: string): Passage => ({
  status: 'ok',
  verses: [{ verseId: JOHN_15_4, segments: [{ text, redLetter: false }] }],
  attribution: null,
})

const sourceOf = (passages: Record<string, Passage>): PassageSource => ({
  passage: async (_reference, translationId) =>
    passages[translationId] ?? { status: 'unavailable' },
})

describe('TieredPassageSource', () => {
  it('serves from the offline module tier when it has the translation', async () => {
    const source = new TieredPassageSource(
      sourceOf({ web: okPassage('offline text') }),
      sourceOf({ web: okPassage('online text') }),
    )

    expect(await source.passage(john15_4, 'web')).toEqual(
      okPassage('offline text'),
    )
  })

  it('falls through to the online tier when no module serves the translation', async () => {
    const source = new TieredPassageSource(
      sourceOf({}),
      sourceOf({ nkjv: okPassage('online text') }),
    )

    expect(await source.passage(john15_4, 'nkjv')).toEqual(
      okPassage('online text'),
    )
  })

  it('is unavailable when no tier serves the translation', async () => {
    const source = new TieredPassageSource(sourceOf({}), sourceOf({}))

    expect(await source.passage(john15_4, 'nkjv')).toEqual({
      status: 'unavailable',
    })
  })
})
