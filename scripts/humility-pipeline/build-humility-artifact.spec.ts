import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { MODULE_FORMAT_VERSION } from '../../src/modules/module-manifest'
import { makeVerseId } from '../../src/reference/verse-id'
import type { BookRegistryEntry } from './book-registry'
import {
  buildHumilityArtifact,
  refSpanCounts,
  sha256Hex,
} from './build-humility-artifact'

const source = readFileSync('tests/fixtures/humility-slice.txt', 'utf8')

const registry: BookRegistryEntry[] = [
  {
    bookNumber: 101,
    title: 'Humility',
    author: 'Andrew Murray',
    moduleId: 'hum-m1895',
    editionCode: 'HUM-M1895',
  },
]

describe('buildHumilityArtifact', () => {
  const artifact = buildHumilityArtifact(source, registry)

  it('carries a book manifest naming the edition and its public-domain license', () => {
    expect(artifact.manifest).toMatchObject({
      id: 'hum-m1895',
      name: 'Humility',
      language: 'English',
      license: 'Public Domain',
      formatVersion: MODULE_FORMAT_VERSION,
      kind: 'book',
      capabilities: { strongsTagged: false },
    })
    expect(artifact.manifest.book).toMatchObject({
      number: 101,
      editionCode: 'HUM-M1895',
      author: 'Andrew Murray',
      year: 1895,
      abbreviation: 'Hum',
    })
  })

  it('publishes the section table as the book versification data', () => {
    expect(artifact.manifest.book.sections).toEqual([
      { chapter: 0, name: 'Preface', named: true, paragraphs: 2 },
      { chapter: 1, name: 'Humility: The Glory of the Creature', paragraphs: 2 },
      { chapter: 2, name: 'Humility in the Teaching of Jesus', paragraphs: 3 },
      { chapter: 13, name: 'Note A', named: true, paragraphs: 1 },
      { chapter: 14, name: 'Note B', named: true, paragraphs: 1 },
      { chapter: 15, name: 'A Prayer for Humility', named: true, paragraphs: 1 },
    ])
  })

  it('keys paragraph content by book, section, and paragraph', () => {
    const humility = artifact.books[101]
    expect(humility[makeVerseId(101, 0, 1)].text).toContain(
      'There are three great motives',
    )
    expect(humility[makeVerseId(101, 15, 1)].text).toContain(
      'infallible touchstone',
    )
    expect(humility[makeVerseId(101, 0, 3)]).toBeUndefined()
  })

  it('keeps footnotes on their anchor paragraph', () => {
    expect(artifact.books[101][makeVerseId(101, 2, 1)].footnotes).toHaveLength(1)
  })

  it('keeps epigraphs beside the prose as chapter metadata', () => {
    expect(artifact.epigraphs[2]).toHaveLength(2)
    expect(artifact.epigraphs[0]).toBeUndefined()
  })

  it('carries a refs channel beside the prose of a citing paragraph', () => {
    const paragraph = artifact.books[101][makeVerseId(101, 1, 2)]
    expect(
      paragraph.refs?.map((span) => paragraph.text.slice(span.start, span.end)),
    ).toEqual(['John v. 30', 'See Note A.'])
    expect(paragraph.refs?.[0].ranges).toEqual([
      { startId: makeVerseId(43, 5, 30), endId: makeVerseId(43, 5, 30) },
    ])
  })

  it('points a Note pointer at the note section of the book itself', () => {
    const paragraph = artifact.books[101][makeVerseId(101, 1, 2)]
    expect(paragraph.refs?.[1].ranges).toEqual([
      { startId: makeVerseId(101, 13, 1), endId: makeVerseId(101, 13, 1) },
    ])
  })

  it('carries a refs channel on the epigraph attribution', () => {
    const [epigraph] = artifact.epigraphs[1]
    expect(
      epigraph.refs?.map((span) =>
        epigraph.attribution.slice(span.start, span.end),
      ),
    ).toEqual(['REV. iv. 11'])
  })

  it('leaves the stored prose free of any reference grammar', () => {
    expect(artifact.books[101][makeVerseId(101, 1, 2)].text).toBe(
      "And so pride, or the loss of this humility, is the root of every sin." +
        " 'I seek not Mine own will' (John v. 30). (See Note A.)",
    )
  })

  it('leaves no Project Gutenberg trace in the serialized artifact', () => {
    expect(JSON.stringify(artifact).toLowerCase()).not.toContain('gutenberg')
  })

  it('fails the build when the manifest disagrees with the registry', () => {
    expect(() =>
      buildHumilityArtifact(source, [{ ...registry[0], bookNumber: 102 }]),
    ).toThrow(/bookNumber/i)
  })

  it('fails the build when the book is not registered at all', () => {
    expect(() => buildHumilityArtifact(source, [])).toThrow(/hum-m1895/)
  })
})

describe('refSpanCounts', () => {
  it('counts the paragraph and epigraph spans of every section', () => {
    expect([...refSpanCounts(buildHumilityArtifact(source, registry))]).toEqual([
      [0, 0],
      [1, 3],
      [2, 2],
      [13, 0],
      [14, 0],
      [15, 0],
    ])
  })
})

describe('sha256Hex', () => {
  it('hashes text to lowercase hex', () => {
    expect(sha256Hex('abc')).toBe(
      'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad',
    )
  })
})
