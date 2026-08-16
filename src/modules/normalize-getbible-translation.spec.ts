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
  it('builds the module manifest from translation metadata and source info', () => {
    const normalized = normalizeGetBibleTranslation('web', webFixture(), {
      source: 'https://api.getbible.net/v2/web.json',
      sourceChecksum: 'abc123',
    })

    expect(normalized.manifest).toEqual({
      id: 'web',
      name: 'World English Bible',
      language: 'English',
      license: 'Public Domain',
      source: 'https://api.getbible.net/v2/web.json',
      sourceChecksum: 'abc123',
      formatVersion: 1,
      capabilities: { strongsTagged: false },
    })
  })

  it('drops verses and books that fall outside the canonical grid', () => {
    const fixture = webFixture()
    fixture.books[0].chapters[0].verses.push({
      chapter: 15,
      verse: 999,
      name: 'John 15:999',
      text: 'Beyond the grid.',
    })
    fixture.books.push({
      nr: 67,
      name: 'Tobit',
      chapters: [
        {
          chapter: 1,
          name: 'Tobit 1',
          verses: [
            { chapter: 1, verse: 1, name: 'Tobit 1:1', text: 'Apocryphal.' },
          ],
        },
      ],
    })

    const normalized = normalizeGetBibleTranslation('web', fixture, {
      source: 'https://api.getbible.net/v2/web.json',
      sourceChecksum: 'abc123',
    })

    expect(normalized.books.has(67)).toBe(false)
    expect(normalized.books.get(43)?.[makeVerseId(43, 15, 999)]).toBeUndefined()
    expect(normalized.books.get(43)?.[makeVerseId(43, 15, 4)]).toBeDefined()
  })

  it('drops verses whose numbers would alias a different grid position', () => {
    const fixture = webFixture()
    fixture.books[0].chapters.push({
      chapter: 15,
      name: 'John 15 (corrupt)',
      verses: [
        {
          chapter: 15,
          verse: 1004,
          name: 'John 15:1004',
          text: 'Would alias John 16:4.',
        },
        {
          chapter: 1015,
          verse: 4,
          name: 'John 1015:4',
          text: 'Would alias Acts 15:4.',
        },
        { chapter: -1, verse: 4, name: 'John -1:4', text: 'Negative chapter.' },
        { chapter: 15, verse: 4.5, name: 'John 15:4.5', text: 'Fractional.' },
      ],
    })

    const normalized = normalizeGetBibleTranslation('web', fixture, {
      source: 'https://api.getbible.net/v2/web.json',
      sourceChecksum: 'abc123',
    })

    expect(normalized.books.get(43)?.[makeVerseId(43, 16, 4)]).toBeUndefined()
    expect(normalized.books.get(43)?.[makeVerseId(44, 15, 4)]).toBeUndefined()
    expect(normalized.books.get(43)?.[makeVerseId(43, 15, 4)]).toBe(
      'Remain in me, and I in you.',
    )
  })

  it('takes its module id from the caller, not the downloaded abbreviation', () => {
    const fixture = webFixture()
    fixture.abbreviation = '../../evil'

    const normalized = normalizeGetBibleTranslation('web', fixture, {
      source: 'https://api.getbible.net/v2/web.json',
      sourceChecksum: 'abc123',
    })

    expect(normalized.manifest.id).toBe('web')
  })

  it('keys each verse text by canonical verse id within its book', () => {
    const normalized = normalizeGetBibleTranslation('web', webFixture(), {
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
