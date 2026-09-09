import { readFileSync } from 'node:fs'
import { afterAll, describe, expect, it } from 'vitest'
import {
  deregisterManifestBook,
  registerManifestBook,
} from '../../src/modules/book-registration'
import { BOOK_CATALOGUE, bookRelease } from '../../src/modules/book-catalogue'
import { BOOK_MODULE_FORMAT_VERSION } from '../../src/modules/module-manifest'
import {
  PrebuiltReleaseClient,
  releaseArtifactUrl,
} from '../../src/modules/prebuilt-release-client'
import { parseReference } from '../../src/reference/parse-reference'
import { makeVerseId } from '../../src/reference/verse-id'
import { buildSearchIndex, searchIndex } from '../../src/search/search-index'
import { parseSearchQuery } from '../../src/search/search-query'
import { bookAtoms } from '../../src/search/search-scan'
import { buildBookArtifact, sha256Hex } from './build-book-artifact'
import { parseBookRegistry } from './book-registry'
import { parseRefOverrides } from './ref-overrides'

// The golden test over the real curated source: the first release freezes
// this grid forever (ADR 0002), so every section and verse count is spelled
// out here and a change to any of them is a deliberate one. Chapters 1–5 are
// the tracer (ticket 139); the rest of Charles's 1–108 follow the same path.
const source = readFileSync('resources/1 Enoch Charles 1912.md', 'utf8')
const registry = parseBookRegistry(
  readFileSync('scripts/book-registry.json', 'utf8'),
)
const artifact = buildBookArtifact(
  source,
  registry,
  parseRefOverrides(
    readFileSync('scripts/enoch-pipeline/ref-overrides.json', 'utf8'),
  ),
)
const verse = (chapter: number, atom: number) =>
  artifact.books[103][makeVerseId(103, chapter, atom)]

describe('1 Enoch, Charles 1912', () => {
  it('publishes the verse-atom module the catalogue offers as 1en-c1912', () => {
    expect(artifact.manifest).toMatchObject({
      id: '1en-c1912',
      name: '1 Enoch',
      language: 'English',
      kind: 'book',
      formatVersion: BOOK_MODULE_FORMAT_VERSION,
    })
    expect(artifact.manifest.license).toMatch(/public domain/i)
    expect(artifact.manifest.book).toMatchObject({
      number: 103,
      editionCode: '1EN-C1912',
      author: 'Enoch',
      year: 1912,
      abbreviation: '1En',
      aliases: ['First Enoch', 'Book of Enoch', 'Ethiopic Enoch'],
      atom: 'verse',
    })
  })

  it('lays chapters 1–5 out as untitled sections named by number, under the Watchers', () => {
    const grid = artifact.manifest.book.sections.map(
      ({ reading: _reading, ...section }) => section,
    )
    const part = 'The Book of the Watchers (I–XXXVI)'
    expect(grid).toEqual([
      { chapter: 1, name: '1', paragraphs: 9, part },
      { chapter: 2, name: '2', paragraphs: 3, part },
      { chapter: 3, name: '3', paragraphs: 1, part },
      { chapter: 4, name: '4', paragraphs: 1, part },
      { chapter: 5, name: '5', paragraphs: 9, part },
    ])
    expect(artifact.manifest.book.sections.some((section) => section.named)).toBe(false)
  })

  it('carries every verse the sections promise', () => {
    for (const section of artifact.manifest.book.sections)
      for (let atom = 1; atom <= section.paragraphs; atom += 1)
        expect(verse(section.chapter, atom)?.text).toBeTruthy()
    expect(Object.keys(artifact.books[103])).toHaveLength(23)
  })

  it('stores the 1912 print’s bracket glyphs as plain characters, never the digitizer’s', () => {
    const texts = Object.values(artifact.books[103]).map((atom) => atom.text)
    expect(verse(1, 1).text).toBe(
      'The words of the blessing of Enoch, wherewith he blessed the elect ' +
        '⌈⌈and⌉⌉ righteous, who will be living in the day of tribulation, ' +
        'when all the wicked ⌈⌈and godless⌉⌉ are to be removed.',
    )
    expect(verse(1, 7).text).toContain('⌈wholly⌉')
    expect(verse(5, 6).text).toContain('⌈And all the … shall rejoice,')
    for (const text of texts) {
      expect(text).not.toMatch(/[⌜⌝〚〛=<>]/)
      expect(text).not.toMatch(/\.\.\./)
    }
    expect(verse(2, 2).text).toContain('⌈how steadfast they are⌉')
  })

  it('drops Charles’s supplied parentheses and identifies the words — 1:4’s even among them', () => {
    const texts = Object.values(artifact.books[103]).map((atom) => atom.text)
    for (const text of texts) expect(text).not.toMatch(/[()]/)
    const even = verse(1, 4)
    expect(even.text).toBe(
      'And the eternal God will tread upon the earth, even on Mount Sinai, ' +
        '[And appear from His camp] ' +
        'And appear in the strength of His might from the heaven ⌈of heavens⌉.',
    )
    expect(even.supplied).toEqual([{ start: 47, end: 51 }])
    expect(even.marks).toEqual([
      { start: 68, end: 69 },
      { start: 93, end: 94 },
      { start: 151, end: 152 },
      { start: 162, end: 163 },
    ])
    expect(even.lines?.map((line) => line.start)).toEqual([0, 68, 95])
    const at = (atom: { text: string; supplied?: { start: number; end: number }[] }) =>
      atom.supplied?.map((span) => atom.text.slice(span.start, span.end))
    expect(at(verse(1, 7))).toEqual(['men'])
    expect(at(verse(3, 1))).toEqual(['in the winter'])
    expect(at(verse(5, 9))).toEqual(['the divine'])
  })

  it('identifies every stay-glyph with one marks span — 1:2’s ⌈⌈which⌉⌉, 1:9’s dense brackets, 5:6’s lacuna', () => {
    const glyphs = (chapter: number, atom: number) =>
      verse(chapter, atom).marks?.map((span) =>
        verse(chapter, atom).text.slice(span.start, span.end),
      )
    expect(glyphs(1, 2)).toEqual(['⌈⌈', '⌉⌉'])
    expect(glyphs(1, 9)).toEqual(['⌈', '⌉', '⌈', '⌉', '⌈', '⌉', '⌈', '⌉', '⌈', '⌉'])
    expect(glyphs(5, 6)).toEqual(['⌈', '⌉', '⌈', '⌉', '⌈', '⌉', '⌈', '…', '⌉'])
    const spans = Object.values(artifact.books[103]).flatMap((atom) => atom.marks ?? [])
    expect(spans).toHaveLength(75)
    for (const atom of Object.values(artifact.books[103])) {
      for (const span of atom.marks ?? [])
        expect(atom.text.slice(span.start, span.end)).toMatch(/^(⌈⌈|⌉⌉|⌈|⌉|\[|\]|…)$/)
    }
  })

  it('identifies 2:2’s thick-type steadfast as emended, inside its version bracket', () => {
    const atom = verse(2, 2)
    expect(atom.emended).toHaveLength(1)
    const [emended] = atom.emended ?? []
    expect(atom.text.slice(emended.start, emended.end)).toBe('steadfast')
    expect(atom.text.slice(emended.start - 5, emended.end + 10)).toBe('⌈how steadfast they are⌉')
    const others = Object.entries(artifact.books[103]).filter(
      ([id, other]) => other.emended !== undefined && Number(id) !== makeVerseId(103, 2, 2),
    )
    expect(others).toEqual([])
  })

  it('grows no channel on an unmarked verse', () => {
    for (const [chapter, atom] of [[1, 5], [1, 6], [4, 1], [5, 4], [5, 8]])
      expect(verse(chapter, atom)).not.toHaveProperty('marks')
    expect(verse(4, 1)).toEqual({ text: expect.any(String) })
  })

  it('finds `even` in 1:4 through the Search Index, the supplied word being text like any other', () => {
    const index = buildSearchIndex(bookAtoms(artifact.books[103]), 'test')
    const hits = searchIndex(index, parseSearchQuery('even'))
    expect(hits.map((hit) => hit.verseId)).toContain(makeVerseId(103, 1, 4))
    const hit = hits.find((candidate) => candidate.verseId === makeVerseId(103, 1, 4))
    expect(hit?.spans.map((span) => verse(1, 4).text.slice(span.start, span.end))).toEqual(['even'])
  })

  it('ships nothing of the digitizer’s boilerplate or name', () => {
    expect(source).not.toMatch(/gutenberg/i)
    expect(JSON.stringify(artifact)).not.toMatch(/gutenberg/i)
  })

  it('opens the Watchers and Charles’s I-V head on 1:1 as Headings, never as text', () => {
    expect(verse(1, 1).headings).toEqual([
      { text: 'The Book of the Watchers (I–XXXVI)', level: 'part' },
      {
        text: 'I-V. Parable of Enoch on the Future Lot of the Wicked and the Righteous.',
        level: 'section',
      },
    ])
    expect(verse(1, 2).headings).toBeUndefined()
  })

  it('keeps the prose verses as one string with no lines', () => {
    for (const [chapter, atom] of [[1, 1], [1, 2], [2, 1], [2, 3], [3, 1], [4, 1], [5, 3]])
      expect(verse(chapter, atom).lines).toBeUndefined()
  })

  it('keeps 1:3’s prose lead-in as line 0 of the same atom, its poem line after a stanza gap', () => {
    const mixed = verse(1, 3)
    expect(mixed.text).toBe(
      'Concerning the elect I said, and took up my parable concerning them: ' +
        'The Holy Great One will come forth from His dwelling,',
    )
    expect(mixed.lines).toEqual([
      { start: 0 },
      { start: 'Concerning the elect I said, and took up my parable concerning them: '.length, paragraph: true },
    ])
  })

  it('keeps Charles’s tristichs three lines to a verse, flush and unlettered', () => {
    for (const atom of [4, 5, 6, 7])
      expect(verse(1, atom).lines?.map(({ start: _start, ...line }) => line)).toEqual([
        { paragraph: true },
        {},
        {},
      ])
    expect(verse(1, 4).text.slice(verse(1, 4).lines?.[1].start)).toMatch(
      /^\[And appear from His camp\] And appear/,
    )
  })

  it('keeps the 1:8–9 stanza breaks as paragraph on the stanza’s first line', () => {
    expect(verse(1, 8).lines?.map((line) => line.paragraph === true)).toEqual([
      true, false, false, true, false, false, true, false, false,
    ])
    expect(verse(1, 9).lines?.map((line) => line.paragraph === true)).toEqual([
      true, false, false, true, false, false,
    ])
  })

  it('stores 5:6 in letter order a–j with no invented 6h, and 5:7 as a, b, c', () => {
    expect(verse(5, 6).lines?.map((line) => line.letter)).toEqual([
      'a', 'b', 'c', 'd', 'e', 'f', 'g', 'i', 'j',
    ])
    expect(verse(5, 6).lines?.map((line) => line.paragraph === true)).toEqual([
      true, false, false, true, false, false, false, false, false,
    ])
    expect(verse(5, 7).lines?.map((line) => line.letter)).toEqual(['a', 'b', 'c'])
    expect(verse(5, 7).text).toBe(
      'But for the elect there shall be light and grace and peace, ' +
        'And they shall inherit the earth. ' +
        'And for you, the godless, there shall be a curse.',
    )
  })

  it('emits chapter 5’s page walk — 6a 6b 6c 7c 6d … 6j 7a 7b — as its reading, and none for 1–4', () => {
    const readings = new Map(
      artifact.manifest.book.sections.map((section) => [section.chapter, section.reading]),
    )
    for (const chapter of [1, 2, 3, 4]) expect(readings.get(chapter)).toBeUndefined()
    expect(readings.get(5)).toEqual([
      { atom: 1 },
      { atom: 2 },
      { atom: 3 },
      ...[0, 1, 2, 3].map((line) => ({ atom: 4, line })),
      ...[0, 1, 2, 3].map((line) => ({ atom: 5, line })),
      { atom: 6, line: 0 },
      { atom: 6, line: 1 },
      { atom: 6, line: 2 },
      { atom: 7, line: 2 },
      ...[3, 4, 5, 6, 7, 8].map((line) => ({ atom: 6, line })),
      { atom: 7, line: 0 },
      { atom: 7, line: 1 },
      ...[0, 1, 2, 3].map((line) => ({ atom: 8, line })),
      ...[0, 1, 2, 3, 4, 5, 6, 7].map((line) => ({ atom: 9, line })),
    ])
  })

  it('keeps the letters off the stored text, so a Highlight never counts gutter chrome', () => {
    for (const atom of Object.values(artifact.books[103]))
      expect(atom.text).not.toMatch(/(^|\s)\d+[a-z]?\.\s/)
  })

  it('carries no Ref Spans — Charles’s verses cite no scripture', () => {
    for (const atom of Object.values(artifact.books[103]))
      expect(atom.refs).toBeUndefined()
  })
})

describe('the built 1 Enoch artifact through the plugin’s own install path', () => {
  const entry = BOOK_CATALOGUE.find((book) => book.moduleId === '1en-c1912')
  if (entry === undefined) throw new Error('1 Enoch is not catalogued')
  const release = bookRelease(entry)
  const artifactJson = JSON.stringify(artifact)
  const served: Record<string, string> = {
    [releaseArtifactUrl(release)]: artifactJson,
  }
  const client = new PrebuiltReleaseClient(release, async (url) => {
    const body = served[url]
    if (body === undefined) throw new Error(`unexpected fetch ${url}`)
    return body
  })
  const install = client.fetchModule()

  afterAll(async () => {
    deregisterManifestBook((await install).module.manifest)
  })

  it('downloads from the 1en-c1912-module release tag, checksummed', async () => {
    expect(release).toEqual({
      moduleId: '1en-c1912',
      tag: '1en-c1912-module',
      filename: '1en-c1912-module.json',
    })
    const { module, checksum } = await install
    expect(checksum).toBe(sha256Hex(artifactJson))
    expect(module.manifest.book?.atom).toBe('verse')
    expect(module.manifest.book?.sections[4].reading).toHaveLength(35)
    expect(module.books.get(103)?.[makeVerseId(103, 5, 6)]).toMatchObject({
      lines: expect.arrayContaining([expect.objectContaining({ letter: 'a' })]),
    })
  })

  it.each([
    ['1 Enoch 1:9', makeVerseId(103, 1, 9), makeVerseId(103, 1, 9)],
    ['1En 1:9', makeVerseId(103, 1, 9), makeVerseId(103, 1, 9)],
    ['First Enoch 5:7', makeVerseId(103, 5, 7), makeVerseId(103, 5, 7)],
    ['Ethiopic Enoch 3:1', makeVerseId(103, 3, 1), makeVerseId(103, 3, 1)],
    ['Book of Enoch 1', makeVerseId(103, 1, 1), makeVerseId(103, 1, 9)],
  ])('resolves %s once the module is registered', async (text, startId, endId) => {
    registerManifestBook((await install).module.manifest)
    expect(parseReference(text)?.reference.ranges).toEqual([{ startId, endId }])
  })

  it.each(['1 Enoch 0', '1 Enoch 109', '1 Enoch 1:10', '1 Enoch 5:6a'])(
    'leaves %s off the grid — plain text',
    async (text) => {
      registerManifestBook((await install).module.manifest)
      expect(parseReference(text)).toBeNull()
    },
  )
})
