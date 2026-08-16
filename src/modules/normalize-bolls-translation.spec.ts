import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { makeVerseId } from '../reference'
import { normalizeBollsTranslation } from './normalize-bolls-translation'
import type { BollsVerse } from './normalize-bolls-translation'

const nkjvSlice = (): BollsVerse[] =>
  JSON.parse(
    readFileSync('tests/fixtures/bolls-nkjv-slice.json', 'utf8'),
  ) as BollsVerse[]

const nkjvMeta = { name: 'New King James Version, 1982', language: 'English' }

const sourceInfo = {
  source: 'https://bolls.life/static/translations/NKJV.json',
  sourceChecksum: 'abc123',
}

describe('normalizeBollsTranslation with plain texts', () => {
  it('keys each verse text by canonical verse id within its book', () => {
    const normalized = normalizeBollsTranslation(
      'nkjv',
      nkjvSlice(),
      nkjvMeta,
      sourceInfo,
    )

    expect(normalized.books.get(1)?.[makeVerseId(1, 1, 1)]).toBe(
      'In the beginning God created the heavens and the earth.',
    )
    expect(normalized.books.get(43)?.[makeVerseId(43, 15, 4)]).toBe(
      'Abide in Me, and I in you. As the branch cannot bear fruit of itself, unless it abides in the vine, neither can you, unless you abide in Me.',
    )
  })

  it('builds the module manifest from catalogue metadata and source info, untagged', () => {
    const normalized = normalizeBollsTranslation(
      'nkjv',
      nkjvSlice(),
      nkjvMeta,
      sourceInfo,
    )

    expect(normalized.manifest).toEqual({
      id: 'nkjv',
      name: 'New King James Version, 1982',
      language: 'English',
      license: '',
      source: 'https://bolls.life/static/translations/NKJV.json',
      sourceChecksum: 'abc123',
      formatVersion: 1,
      capabilities: { strongsTagged: false },
    })
  })

  it('strips styling markup and collapses whitespace, dropping comment cross-refs', () => {
    const normalized = normalizeBollsTranslation(
      'nkjv',
      nkjvSlice(),
      nkjvMeta,
      sourceInfo,
    )

    // Source text: '“I am the vine, you <i>are</i> the branches. He who abides
    // in Me, and I in him, bears much  fruit; ...' plus a comment field of
    // <a> cross-references that must not survive normalization.
    expect(normalized.books.get(43)?.[makeVerseId(43, 15, 5)]).toBe(
      '“I am the vine, you are the branches. He who abides in Me, and I in him, bears much fruit; for without Me you can do nothing.',
    )
  })

  it('drops verses outside the canonical grid or aliasing other grid positions', () => {
    const verses: BollsVerse[] = [
      ...nkjvSlice(),
      { book: 67, chapter: 1, verse: 1, text: 'Apocryphal.' },
      { book: 43, chapter: 15, verse: 999, text: 'Beyond the grid.' },
      { book: 43, chapter: 15, verse: 1004, text: 'Would alias John 16:4.' },
      { book: 43, chapter: 1015, verse: 4, text: 'Would alias Acts 15:4.' },
      { book: 43, chapter: -1, verse: 4, text: 'Negative chapter.' },
      { book: 43, chapter: 15, verse: 4.5, text: 'Fractional.' },
    ]

    const normalized = normalizeBollsTranslation(
      'nkjv',
      verses,
      nkjvMeta,
      sourceInfo,
    )

    expect(normalized.books.has(67)).toBe(false)
    expect(normalized.books.get(43)?.[makeVerseId(43, 15, 999)]).toBeUndefined()
    expect(normalized.books.get(43)?.[makeVerseId(43, 16, 4)]).toBeUndefined()
    expect(normalized.books.get(43)?.[makeVerseId(44, 15, 4)]).toBeUndefined()
    expect(normalized.books.get(43)?.[makeVerseId(43, 15, 4)]).toBeDefined()
  })
})
