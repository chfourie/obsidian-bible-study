import { describe, expect, it } from 'vitest'
import {
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
