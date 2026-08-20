import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  bookIdForName,
  chapterCount,
  deregisterBook,
  deregisterBookVersification,
  isValidVerseId,
  makeVerseId,
  registeredBook,
  verseCount,
} from '../reference'
import {
  deregisterManifestBook,
  registerManifestBook,
} from './book-registration'
import { MODULE_FORMAT_VERSION, type ModuleManifest } from './module-manifest'

const HUMILITY_BOOK = 101

const bookManifest = (
  sections: { chapter: number; name: string; paragraphs: number }[],
): ModuleManifest => ({
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
    number: HUMILITY_BOOK,
    editionCode: 'HUM-M1895',
    author: 'Andrew Murray',
    year: 1895,
    abbreviation: 'Hum',
    sections,
  },
})

const translationManifest: ModuleManifest = {
  id: 'web',
  name: 'World English Bible',
  language: 'English',
  license: 'Public Domain',
  source: 'test',
  sourceChecksum: '',
  formatVersion: MODULE_FORMAT_VERSION,
  capabilities: { strongsTagged: false },
}

afterEach(() => {
  deregisterBookVersification(HUMILITY_BOOK)
  deregisterBook(HUMILITY_BOOK)
  vi.restoreAllMocks()
})

describe('registerManifestBook', () => {
  it('registers the section table of a book manifest', () => {
    registerManifestBook(
      bookManifest([
        { chapter: 0, name: 'Preface', paragraphs: 4 },
        { chapter: 1, name: 'The Glory of the Creature', paragraphs: 9 },
      ]),
    )

    expect(chapterCount(HUMILITY_BOOK)).toBe(2)
    expect(verseCount(HUMILITY_BOOK, 0)).toBe(4)
    expect(isValidVerseId(makeVerseId(HUMILITY_BOOK, 1, 9))).toBe(true)
    expect(isValidVerseId(makeVerseId(HUMILITY_BOOK, 1, 10))).toBe(false)
  })

  it('ignores a translation manifest', () => {
    registerManifestBook(translationManifest)

    expect(chapterCount(HUMILITY_BOOK)).toBe(0)
  })

  // A malformed section table must never take the plugin down with it.
  it('reports a malformed section table instead of throwing', () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {})

    expect(() =>
      registerManifestBook(
        bookManifest([{ chapter: 3, name: 'Broken', paragraphs: 0 }]),
      ),
    ).not.toThrow()
    expect(error).toHaveBeenCalled()
    expect(chapterCount(HUMILITY_BOOK)).toBe(0)
  })

  it('leaves an unusable grid unaddressable by name', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})

    registerManifestBook(
      bookManifest([{ chapter: 3, name: 'Broken', paragraphs: 0 }]),
    )

    expect(bookIdForName('Humility')).toBeNull()
  })

  it('registers the book identity the grammar resolves names against', () => {
    registerManifestBook(
      bookManifest([{ chapter: 0, name: 'Preface', paragraphs: 4 }]),
    )

    expect(bookIdForName('Humility')).toBe(HUMILITY_BOOK)
    expect(bookIdForName('Hum')).toBe(HUMILITY_BOOK)
    expect(registeredBook(HUMILITY_BOOK)).toMatchObject({
      moduleId: 'hum-m1895',
      editionCode: 'HUM-M1895',
      author: 'Andrew Murray',
      year: 1895,
      sections: [{ chapter: 0, name: 'Preface' }],
    })
  })
})

describe('deregisterManifestBook', () => {
  it('drops the book grid so its ids stop validating', () => {
    const manifest = bookManifest([
      { chapter: 0, name: 'Preface', paragraphs: 4 },
    ])
    registerManifestBook(manifest)

    deregisterManifestBook(manifest)

    expect(chapterCount(HUMILITY_BOOK)).toBe(0)
    expect(isValidVerseId(makeVerseId(HUMILITY_BOOK, 0, 1))).toBe(false)
    expect(bookIdForName('Humility')).toBeNull()
  })

  it('ignores a translation manifest', () => {
    registerManifestBook(
      bookManifest([{ chapter: 0, name: 'Preface', paragraphs: 4 }]),
    )

    deregisterManifestBook(translationManifest)

    expect(chapterCount(HUMILITY_BOOK)).toBe(1)
  })
})
