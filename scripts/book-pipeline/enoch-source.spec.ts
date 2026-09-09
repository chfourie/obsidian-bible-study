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
import { ModulePassageSource } from '../../src/rendering/module-passage-source'
import { makeVerseId } from '../../src/reference/verse-id'
import { buildSearchIndex, searchIndex } from '../../src/search/search-index'
import { parseSearchQuery } from '../../src/search/search-query'
import { bookAtoms } from '../../src/search/search-scan'
import {
  buildBookArtifact,
  curationWaivers,
  notesToCurate,
  sha256Hex,
} from './build-book-artifact'
import { parseBookRegistry } from './book-registry'
import { parseRefOverrides } from './ref-overrides'

// The golden test over the real curated source: the first release freezes
// this grid forever (ADR 0002), so every section and verse count is spelled
// out here and a change to any of them is a deliberate one. Chapters 1–5 were
// the tracer (ticket 139); 1–108 landed with ticket 145.
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
const section = (chapter: number) =>
  artifact.manifest.book.sections.find((candidate) => candidate.chapter === chapter)

// Charles's verse count per printed chapter, I–CVIII.
const ATOMS_PER_CHAPTER = [
  9, 3, 1, 1, 9, 8, 6, 4, 11, 22, 2, 6, 10, 25, 12, 4, 8, 16, 3, 8,
  10, 14, 4, 6, 7, 6, 5, 3, 2, 3, 3, 6, 4, 3, 1, 4, 5, 6, 14, 10,
  9, 3, 4, 1, 6, 8, 4, 10, 4, 5, 5, 9, 7, 10, 4, 8, 3, 6, 3, 25,
  13, 16, 12, 2, 12, 3, 13, 5, 29, 4, 17, 37, 8, 17, 9, 14, 8, 17, 6, 8,
  10, 20, 11, 6, 10, 6, 4, 3, 77, 42, 19, 5, 14, 11, 7, 8, 10, 16, 16, 13,
  9, 11, 15, 13, 2, 19, 3, 15,
]
const PARTS = [
  { part: 'The Book of the Watchers (I–XXXVI)', from: 1, to: 36 },
  { part: 'The Parables (XXXVII–LXXI)', from: 37, to: 71 },
  { part: 'The Book of the Courses of the Heavenly Luminaries (LXXII–LXXXII)', from: 72, to: 82 },
  { part: 'The Dream-Visions (LXXXIII–XC)', from: 83, to: 90 },
  { part: 'The Epistle of Enoch (XCI–CV)', from: 91, to: 105 },
  { part: 'Fragment of the Book of Noah (CVI–CVII)', from: 106, to: 107 },
  { part: 'An Appendix to the Book of Enoch (CVIII)', from: 108, to: 108 },
]
const partOf = (chapter: number) =>
  PARTS.find(({ from, to }) => chapter >= from && chapter <= to)?.part

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

  it('lays chapters 1–108 out in numeric order as untitled sections named by number, under the seven Parts', () => {
    const grid = artifact.manifest.book.sections.map(
      ({ reading: _reading, ...section }) => section,
    )
    expect(grid).toEqual(
      ATOMS_PER_CHAPTER.map((paragraphs, index) => ({
        chapter: index + 1,
        name: String(index + 1),
        paragraphs,
        part: partOf(index + 1),
      })),
    )
    expect(grid).toHaveLength(108)
    expect(artifact.manifest.book.sections.some((section) => section.named)).toBe(false)
  })

  it('has no chapter 109 — Charles’s book ends at the Appendix chapter CVIII', () => {
    expect(section(108)?.paragraphs).toBe(15)
    expect(section(109)).toBeUndefined()
    expect(artifact.books[103][makeVerseId(103, 109, 1)]).toBeUndefined()
  })

  it('carries every verse the sections promise', () => {
    for (const section of artifact.manifest.book.sections)
      for (let atom = 1; atom <= section.paragraphs; atom += 1)
        expect(verse(section.chapter, atom)?.text).toBeTruthy()
    expect(Object.keys(artifact.books[103])).toHaveLength(1063)
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
    expect(verse(8, 1).text).toContain('〈of the earth〉')
    expect(verse(71, 11).text).toContain('… with the spirit of power')
  })

  it('keeps 108:4’s daggers, which the sacred-texts digitization lost', () => {
    const atom = verse(108, 4)
    expect(atom.text).toContain('I could not †look over†,')
    expect(atom.marks?.map((span) => atom.text.slice(span.start, span.end))).toEqual(['†', '†'])
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
    const glyphCounts = new Map<string, number>()
    for (const atom of Object.values(artifact.books[103])) {
      for (const span of atom.marks ?? []) {
        const glyph = atom.text.slice(span.start, span.end)
        expect(glyph).toMatch(/^(⌈⌈|⌉⌉|⌈|⌉|〈|〉|\[|\]|†|…)$/)
        glyphCounts.set(glyph, (glyphCounts.get(glyph) ?? 0) + 1)
      }
    }
    expect(Object.fromEntries(glyphCounts)).toEqual({
      '⌈⌈': 50, '⌉⌉': 50, '⌈': 67, '⌉': 67, '〈': 13, '〉': 13, '[': 67, ']': 67, '†': 137, '…': 7,
    })
  })

  it('identifies 2:2’s thick-type steadfast as emended, inside its version bracket', () => {
    const atom = verse(2, 2)
    expect(atom.emended).toHaveLength(1)
    const [emended] = atom.emended ?? []
    expect(atom.text.slice(emended.start, emended.end)).toBe('steadfast')
    expect(atom.text.slice(emended.start - 5, emended.end + 10)).toBe('⌈how steadfast they are⌉')
    const emendedAtoms = Object.values(artifact.books[103]).filter((other) => other.emended !== undefined)
    expect(emendedAtoms).toHaveLength(103)
    const hollow = verse(22, 8)
    expect(hollow.emended?.map((span) => hollow.text.slice(span.start, span.end))).toEqual([
      'hollow places', 'hollow places',
    ])
  })

  it('carries Charles’s note on every marked atom it does not waive — 1:9 lists its notes, 1:6 none', () => {
    const notes = verse(1, 9).footnotes?.map((note) => note.text)
    expect(notes).toHaveLength(4)
    expect(notes?.[0]).toMatch(/^Cometh with ten thousands of ⌈His⌉ holy ones\./)
    expect(verse(1, 6)).not.toHaveProperty('footnotes')
    expect(verse(1, 6)).not.toHaveProperty('marks')
    for (const note of Object.values(artifact.books[103]).flatMap((atom) => atom.footnotes ?? [])) {
      expect(note.text).not.toMatch(/[<\]]/)
      expect(note.text).toBeTruthy()
    }
  })

  it('freezes the curated Footnote subset: 295 notes on 257 atoms, 19 conscious waivers, nothing left to curate', () => {
    const noted = Object.values(artifact.books[103]).filter((atom) => atom.footnotes !== undefined)
    expect(noted).toHaveLength(257)
    expect(noted.reduce((count, atom) => count + (atom.footnotes?.length ?? 0), 0)).toBe(295)
    const waived = curationWaivers(source)
    expect(waived.map((waiver) => waiver.locator)).toEqual([
      '2:1', '2:3', '5:3', '5:5', '10:13', '14:25', '15:6', '15:12', '60:24', '69:12',
      '69:16', '69:25', '71:3', '72:6', '73:7', '76:12', '89:25', '99:3', '103:10',
    ])
    expect(notesToCurate(artifact, waived)).toEqual([])
    expect(notesToCurate(artifact)).toHaveLength(19)
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

  it('keeps Charles’s Epistle heads verbatim on 92:1, 91:1, 93:1 and 91:12 while the sections stand 91 → 92 → 93', () => {
    const head = (chapter: number, atom: number) =>
      verse(chapter, atom).headings?.filter((heading) => heading.level === 'section').map((heading) => heading.text)
    expect(head(92, 1)).toEqual(['XCII. XCI. 1-10, 18-19. Enoch’s Book of Admonition for his Children.'])
    expect(head(91, 1)).toEqual(['XCI. 1-11, 18-19. Enoch’s Admonition to his Children.'])
    expect(head(93, 1)).toEqual(['XCIII, XCI. 12-17. The Apocalypse of Weeks.'])
    expect(head(91, 12)).toEqual(['XCI. 12-17. The Last Three Weeks.'])
    expect(head(94, 1)).toEqual(['XCIV. 1-5. Admonitions to the Righteous.'])
    expect(artifact.manifest.book.sections.map((section) => section.chapter).slice(90, 94)).toEqual([91, 92, 93, 94])
  })

  it('opens each Part on its first chapter and Charles’s chapter heads on the verse they precede', () => {
    for (const { part, from } of PARTS)
      expect(verse(from, 1).headings?.[0]).toEqual({ text: part, level: 'part' })
    expect(verse(38, 1).headings?.map((heading) => heading.text)).toEqual([
      'XXXVIII-XLIV. The First Parable.',
      'XXXVIII. The Coming Judgement of the Wicked.',
    ])
    expect(verse(89, 10).headings).toEqual([
      { text: 'LXXXIX. 10-27. From the Death of Noah to the Exodus.', level: 'section' },
    ])
    expect(verse(89, 11).headings).toBeUndefined()
    expect(verse(71, 14).headings?.map((heading) => heading.text)).toEqual([
      '[Lost passage wherein the Son of Man was described as accompanying the Head of Days, ' +
        'and Enoch asked one of the angels (as in 46³) concerning the Son of Man as to who he was.]',
    ])
    expect(verse(71, 13).lines).toBeUndefined()
  })

  it('prints Charles’s parallel E and Gᵍ columns as labelled lines of the one verse (22:2)', () => {
    const atom = verse(22, 2)
    expect(atom.lines?.map((line) => atom.text.slice(line.start).split(' ')[0])).toEqual([
      'E', 'And', 'Gᵍ', 'And',
    ])
    expect(section(22)?.reading?.slice(0, 6)).toEqual([
      { atom: 1 }, { atom: 2, line: 0 }, { atom: 2, line: 1 }, { atom: 2, line: 2 },
      { atom: 2, line: 3 }, { atom: 3 },
    ])
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
      true, false, false, true, false, false, false, true, false,
    ])
    expect(verse(5, 7).lines?.map((line) => line.letter)).toEqual(['a', 'b', 'c'])
    expect(verse(5, 7).text).toBe(
      'But for the elect there shall be light and grace and peace, ' +
        'And they shall inherit the earth. ' +
        'And for you, the godless, there shall be a curse.',
    )
  })

  it('emits a reading walk only where Charles’s page is not the numeric walk', () => {
    const walked = artifact.manifest.book.sections
      .filter((section) => section.reading !== undefined)
      .map((section) => section.chapter)
    expect(walked).toEqual([5, 22, 39, 51, 60, 89, 90, 91, 97, 106])
    expect(section(60)?.reading?.slice(9, 12)).toEqual([{ atom: 6 }, { atom: 25 }, { atom: 7 }])
    expect(section(89)?.reading?.slice(47, 50)).toEqual([
      { atom: 48, line: 0 }, { atom: 49 }, { atom: 48, line: 1 },
    ])
    expect(section(90)?.reading?.slice(12, 19).map((step) => step.atom)).toEqual([13, 16, 19, 14, 15, 17, 18])
    expect(section(106)?.reading?.slice(13, 17).map((step) => step.atom)).toEqual([14, 17, 15, 16])
    expect(verse(97, 9).lines?.map((line) => line.letter)).toEqual([undefined, undefined, 'c', 'd'])
  })

  it('emits chapter 5’s page walk — 6a 6b 6c 7c 6d … 6j 7a 7b — as its reading', () => {
    const readings = new Map(
      artifact.manifest.book.sections.map((section) => [section.chapter, section.reading]),
    )
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

  it('lists 1:9’s notes and none for 1:6 through the segmenter the reader reads', async () => {
    const { module } = await install
    registerManifestBook(module.manifest)
    const passages = new ModulePassageSource({
      manifest: async () => module.manifest,
      bookContent: async (moduleId, book) =>
        moduleId === '1en-c1912' ? (module.books.get(book) ?? null) : null,
    })
    const reference = (text: string) => {
      const parsed = parseReference(text)
      if (parsed === null) throw new Error(`unparsed ${text}`)
      return parsed.reference
    }
    const noted = await passages.passage(reference('1 Enoch 1:9'), '1en-c1912')
    expect(noted.status === 'ok' && noted.verses[0].footnotes?.length).toBe(4)
    expect(noted.status === 'ok' && noted.verses[0].segments.map((segment) => segment.text).join('')).not.toContain('Jude')
    const bare = await passages.passage(reference('1 Enoch 1:6'), '1en-c1912')
    expect(bare.status === 'ok' && bare.verses[0].footnotes).toBeUndefined()
  })

  it.each(['1 Enoch 0', '1 Enoch 109', '1 Enoch 1:10', '1 Enoch 5:6a'])(
    'leaves %s off the grid — plain text',
    async (text) => {
      registerManifestBook((await install).module.manifest)
      expect(parseReference(text)).toBeNull()
    },
  )
})
