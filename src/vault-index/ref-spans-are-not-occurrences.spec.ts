import { afterEach, describe, expect, it } from 'vitest'
import {
  HUMILITY_BOOK,
  installHumilityBook,
  uninstallHumilityBook,
} from '../../tests/fixtures/humility-book'
import type { ModuleDataDir } from '../modules/module-data-dir'
import { ModuleStore } from '../modules/module-store'
import type { NormalizedModule } from '../modules/normalized-module'
import { makeVerseId, type Reference } from '../reference'
import { VaultReferenceIndex } from './vault-reference-index'

class MemoryModuleDataDir implements ModuleDataDir {
  readonly #files = new Map<string, string>()

  async readTextFile(path: string): Promise<string | null> {
    return this.#files.get(path) ?? null
  }

  async writeTextFile(path: string, content: string): Promise<void> {
    this.#files.set(path, content)
  }

  async removeDir(path: string): Promise<void> {
    for (const file of [...this.#files.keys()])
      if (file.startsWith(`${path}/`)) this.#files.delete(file)
  }

  async listDirs(): Promise<string[]> {
    return []
  }
}

const JOHN_5_30 = {
  startId: makeVerseId(43, 5, 30),
  endId: makeVerseId(43, 5, 30),
}

// A book module whose prose cites John 5:30 twice over — once in a paragraph,
// once in a chapter epigraph — with both citations carried as ref spans.
const citingHumility = (): NormalizedModule => ({
  manifest: {
    id: 'hum-m1895',
    name: 'Humility',
    language: 'English',
    license: 'Public Domain',
    source: 'https://example.invalid/hum-m1895-module.json',
    sourceChecksum: 'abc123',
    formatVersion: 2,
    kind: 'book',
    capabilities: { strongsTagged: false },
    book: {
      number: HUMILITY_BOOK,
      editionCode: 'HUM-M1895',
      author: 'Andrew Murray',
      year: 1895,
      abbreviation: 'Hum',
      sections: [{ chapter: 1, name: 'The Glory of the Creature', paragraphs: 1 }],
    },
  },
  books: new Map([
    [
      HUMILITY_BOOK,
      {
        [makeVerseId(HUMILITY_BOOK, 1, 1)]: {
          text: "'I seek not Mine own will' (John v. 30).",
          refs: [{ start: 28, end: 38, ranges: [JOHN_5_30] }],
        },
      },
    ],
  ]),
  epigraphs: {
    1: [
      {
        quote: 'They shall cast their crowns before the throne.',
        attribution: 'JOHN v. 30.',
        refs: [{ start: 0, end: 10, ranges: [JOHN_5_30] }],
      },
    ],
  },
})

const NOTES: Record<string, string> = {
  'Study/John.md': 'The vine passage {John 15:1} is the anchor.',
  'Study/Humility.md': 'Murray on {Humility 1:1} and the will.',
}

const indexOf = (): VaultReferenceIndex => {
  const index = new VaultReferenceIndex()
  for (const [file, content] of Object.entries(NOTES))
    index.indexNote(file, content)
  return index
}

const johnChapter = (chapter: number): Reference => ({
  book: 43,
  ranges: [
    {
      startId: makeVerseId(43, chapter, 1),
      endId: makeVerseId(43, chapter, 99),
    },
  ],
})

// Ref spans are reader-only links, never Occurrences: module content lives in
// the plugin's data directory and is not vault text, so installing a
// refs-bearing book leaves the index exactly as it was (spec-books §8).
describe('ref spans are not occurrences', () => {
  afterEach(() => uninstallHumilityBook())

  it('leaves the vault index identical after a refs-bearing module installs', async () => {
    installHumilityBook()
    const before = indexOf()
    const snapshot = JSON.stringify(before.intersectingOccurrences(johnChapter(5)))

    await new ModuleStore(new MemoryModuleDataDir()).saveModule(citingHumility())
    const after = indexOf()

    expect(
      JSON.stringify(after.intersectingOccurrences(johnChapter(5))),
    ).toBe(snapshot)
  })

  it('never turns a cited passage into an occurrence of the book', async () => {
    installHumilityBook()
    await new ModuleStore(new MemoryModuleDataDir()).saveModule(citingHumility())

    const index = indexOf()

    expect(index.intersectingOccurrences(johnChapter(5))).toEqual([])
    expect(
      index.intersectingOccurrences(johnChapter(15)).map((group) => group.file),
    ).toEqual(['Study/John.md'])
  })

  it('indexes only what the notes themselves say about the book', async () => {
    installHumilityBook()
    await new ModuleStore(new MemoryModuleDataDir()).saveModule(citingHumility())

    const groups = indexOf().intersectingOccurrences({
      book: HUMILITY_BOOK,
      ranges: [
        {
          startId: makeVerseId(HUMILITY_BOOK, 1, 1),
          endId: makeVerseId(HUMILITY_BOOK, 1, 9),
        },
      ],
    })

    expect(groups.map((group) => group.file)).toEqual(['Study/Humility.md'])
    expect(groups[0].occurrences).toHaveLength(1)
  })
})
