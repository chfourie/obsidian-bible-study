import type { BookContent, ModuleManifest } from '../../src/modules'
import { makeVerseId } from '../../src/reference'
import type { SearchIndexSource } from '../../src/search'

export type ModuleContent = Record<number, BookContent>

export const WEB_CONTENT: ModuleContent = {
  1: {
    [makeVerseId(1, 1, 1)]: 'In the beginning God created the heavens and the earth.',
    [makeVerseId(1, 1, 2)]: 'The earth was formless and empty.',
  },
  43: { [makeVerseId(43, 15, 1)]: 'I am the true vine.' },
}

const manifestFor = (
  moduleId: string,
  checksum: string,
  bookNumber: number | undefined,
): ModuleManifest => ({
  id: moduleId,
  name: moduleId.toUpperCase(),
  language: 'English',
  license: 'Public Domain',
  source: `https://example.test/${moduleId}.json`,
  sourceChecksum: checksum,
  formatVersion: 2,
  capabilities: { strongsTagged: false },
  ...(bookNumber === undefined
    ? {}
    : {
        kind: 'book' as const,
        book: {
          number: bookNumber,
          editionCode: moduleId.toUpperCase(),
          author: 'Author',
          year: 1895,
          abbreviation: moduleId.toUpperCase(),
          sections: [{ chapter: 1, name: 'One', paragraphs: 1 }],
        },
      }),
})

// Module storage as the search sees it, entirely in memory: content to index,
// the manifest checksum that stamps an index, and the index file itself.
export class FakeSearchIndexSource implements SearchIndexSource {
  readonly contentReads: string[] = []
  readonly indexWrites: string[] = []
  readonly #indexFiles = new Map<string, string>()

  private readonly checksums: Record<string, string>

  constructor(
    private readonly content: Record<string, ModuleContent> = { web: WEB_CONTENT },
    checksums?: Record<string, string>,
    // Module ids that stand for installed Books, by the book number their
    // manifest declares; every other module is a translation.
    private readonly bookNumbers: Record<string, number> = {},
  ) {
    this.checksums =
      checksums ??
      Object.fromEntries(
        Object.keys(content).map((moduleId) => [moduleId, `sha-${moduleId}-1`]),
      )
  }

  bookContent = async (
    moduleId: string,
    book: number,
  ): Promise<BookContent | null> => {
    this.contentReads.push(`${moduleId}/${book}`)
    return this.content[moduleId]?.[book] ?? null
  }

  manifest = async (moduleId: string): Promise<ModuleManifest | null> => {
    const checksum = this.checksums[moduleId]
    return checksum === undefined
      ? null
      : manifestFor(moduleId, checksum, this.bookNumbers[moduleId])
  }

  readSearchIndex = async (moduleId: string): Promise<string | null> =>
    this.#indexFiles.get(moduleId) ?? null

  writeSearchIndex = async (moduleId: string, content: string): Promise<void> => {
    this.indexWrites.push(moduleId)
    this.#indexFiles.set(moduleId, content)
  }

  // A module downloaded again: same id, new content behind a new checksum,
  // with whatever index file was there left standing.
  redownload(moduleId: string, checksum: string, content?: ModuleContent): void {
    this.checksums[moduleId] = checksum
    if (content !== undefined) this.content[moduleId] = content
  }

  forget(): void {
    this.contentReads.length = 0
    this.indexWrites.length = 0
  }
}

export const fakeSearchIndexSource = (
  content?: Record<string, ModuleContent>,
  checksums?: Record<string, string>,
  bookNumbers?: Record<string, number>,
): FakeSearchIndexSource =>
  new FakeSearchIndexSource(content, checksums, bookNumbers)
