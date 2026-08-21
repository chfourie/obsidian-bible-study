import { describe, expect, it } from 'vitest'
import {
  BOOK_MODULE_FORMAT_VERSION,
  isBookManifest,
  isTranslationManifest,
  MODULE_FORMAT_VERSION,
  type ModuleManifest,
} from './module-manifest'

const translation: ModuleManifest = {
  id: 'web',
  name: 'World English Bible',
  language: 'English',
  license: 'Public Domain',
  source: 'test',
  sourceChecksum: '',
  formatVersion: MODULE_FORMAT_VERSION,
  capabilities: { strongsTagged: false },
}

const humility: ModuleManifest = {
  id: 'hum-m1895',
  name: 'Humility',
  language: 'English',
  license: 'Public Domain',
  source: 'test',
  sourceChecksum: '',
  formatVersion: MODULE_FORMAT_VERSION,
  kind: 'book',
  capabilities: { strongsTagged: false },
  book: {
    number: 101,
    editionCode: 'HUM-M1895',
    author: 'Andrew Murray',
    year: 1895,
    abbreviation: 'Hum',
    sections: [
      { chapter: 0, name: 'Preface', paragraphs: 4 },
      { chapter: 1, name: 'The Glory of the Creature', paragraphs: 9 },
    ],
  },
}

describe('isTranslationManifest', () => {
  it('accepts a kindless manifest written before kinds existed', () => {
    expect(isTranslationManifest(translation)).toBe(true)
  })

  it('accepts an explicit translation manifest', () => {
    expect(isTranslationManifest({ ...translation, kind: 'translation' })).toBe(
      true,
    )
  })

  it('keeps books out of every translation-only path', () => {
    expect(isTranslationManifest(humility)).toBe(false)
  })
})

describe('isBookManifest', () => {
  it('recognizes a book manifest carrying its book sub-object', () => {
    expect(isBookManifest(humility)).toBe(true)
  })

  it('rejects a translation manifest', () => {
    expect(isBookManifest(translation)).toBe(false)
  })

  it('rejects a book-kinded manifest missing its required book sub-object', () => {
    const { book: _book, ...withoutBook } = humility
    expect(isBookManifest(withoutBook as ModuleManifest)).toBe(false)
  })
})

// *Humility* was published before Headings and Parts; *IN* is the first book
// whose sections name the Part they sit under.
describe('a book manifest across the Heading format bump', () => {
  const inBook: ModuleManifest = {
    ...humility,
    id: 'in-at-e1',
    name: 'IN',
    formatVersion: BOOK_MODULE_FORMAT_VERSION,
    book: {
      number: 102,
      editionCode: 'IN-AT-E1',
      author: 'A Team',
      year: 2026,
      abbreviation: 'IN',
      sections: [
        { chapter: 0, name: 'Prologue', paragraphs: 23, named: true },
        {
          chapter: 1,
          name: 'Man as God Intended',
          paragraphs: 9,
          part: 'PART ONE: Fall of Man',
        },
      ],
    },
  }

  it('reads a section table naming its Parts', () => {
    expect(isBookManifest(inBook)).toBe(true)
    expect(inBook.book?.sections[1].part).toBe('PART ONE: Fall of Man')
  })

  it('reads a book module published before Headings, its sections partless', () => {
    expect(isBookManifest(humility)).toBe(true)
    expect(humility.formatVersion).toBeLessThan(BOOK_MODULE_FORMAT_VERSION)
    for (const section of humility.book?.sections ?? [])
      expect(section.part).toBeUndefined()
  })

  it('leaves translations on the shared format version', () => {
    expect(translation.formatVersion).toBe(MODULE_FORMAT_VERSION)
    expect(BOOK_MODULE_FORMAT_VERSION).toBeGreaterThan(MODULE_FORMAT_VERSION)
  })
})
