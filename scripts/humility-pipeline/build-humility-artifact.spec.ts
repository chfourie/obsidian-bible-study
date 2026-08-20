import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { makeVerseId } from '../../src/reference/verse-id'
import type { BookRegistryEntry } from './book-registry'
import { buildHumilityArtifact, sha256Hex } from './build-humility-artifact'

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
      formatVersion: 2,
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

describe('sha256Hex', () => {
  it('hashes text to lowercase hex', () => {
    expect(sha256Hex('abc')).toBe(
      'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad',
    )
  })
})
