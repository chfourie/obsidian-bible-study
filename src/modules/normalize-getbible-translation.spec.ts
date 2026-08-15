import { describe, expect, it } from 'vitest'
import { makeVerseId } from '../reference'
import { normalizeGetBibleTranslation } from './normalize-getbible-translation'
import type { GetBibleTranslation } from './normalize-getbible-translation'

const webFixture = (): GetBibleTranslation => ({
  translation: 'World English Bible',
  abbreviation: 'web',
  lang: 'en',
  language: 'English',
  distribution_license: 'Public Domain',
  books: [
    {
      nr: 43,
      name: 'John',
      chapters: [
        {
          chapter: 15,
          name: 'John 15',
          verses: [
            {
              chapter: 15,
              verse: 4,
              name: 'John 15:4',
              text: 'Remain in me, and I in you.  ',
            },
            {
              chapter: 15,
              verse: 5,
              name: 'John 15:5',
              text: 'I am the vine. You are the branches.',
            },
          ],
        },
        {
          chapter: 16,
          name: 'John 16',
          verses: [
            {
              chapter: 16,
              verse: 1,
              name: 'John 16:1',
              text: 'I have told you these things so that you would not be caused to stumble.',
            },
          ],
        },
      ],
    },
  ],
})

describe('normalizeGetBibleTranslation', () => {
  it('keys each verse text by canonical verse id within its book', () => {
    const normalized = normalizeGetBibleTranslation(webFixture(), {
      source: 'https://api.getbible.net/v2/web.json',
      sourceChecksum: 'abc123',
    })

    expect(normalized.books.get(43)).toEqual({
      [makeVerseId(43, 15, 4)]: 'Remain in me, and I in you.',
      [makeVerseId(43, 15, 5)]: 'I am the vine. You are the branches.',
      [makeVerseId(43, 16, 1)]:
        'I have told you these things so that you would not be caused to stumble.',
    })
  })
})
