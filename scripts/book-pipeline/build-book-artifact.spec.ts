import { describe, expect, it } from 'vitest'
import {
  BOOK_MODULE_FORMAT_VERSION,
  MODULE_FORMAT_VERSION,
} from '../../src/modules/module-manifest'
import { makeVerseId } from '../../src/reference/verse-id'
import type { BookRegistryEntry } from './book-registry'
import { buildBookArtifact, refSpanCounts } from './build-book-artifact'

const source = [
  '---',
  'module: in-at-e1',
  'language: English',
  '---',
  '',
  '## 0. Prologue {named}',
  '',
  'The Holy Spirit explained it from 2 Peter 1:11 and 2 Peter 3:13.',
  '',
  '### Introduction',
  '',
  'Why the title IN?',
  '',
  '# PART ONE: Fall of man',
  '',
  '## 1. Man as God Intended',
  '',
  'Mankind was created in God’s image. See Chapter 0 for why.',
  '',
  '> Not I, but Christ.',
  '> — Galatians 2:20',
  '',
].join('\n')

const entry: BookRegistryEntry = {
  bookNumber: 102,
  title: 'IN',
  author: 'A Team',
  moduleId: 'in-at-e1',
  editionCode: 'IN-AT-E1',
  year: 2026,
  abbreviation: 'IN',
  aliases: ['In'],
  license: 'No rights reserved.',
  source: 'IN First Edition.pdf',
  sourceChecksum: 'adb9dc5b',
}

const registry: BookRegistryEntry[] = [entry]

describe('buildBookArtifact', () => {
  const artifact = buildBookArtifact(source, registry)

  it('takes the module identity and licence from the Book Registry', () => {
    expect(artifact.manifest).toMatchObject({
      id: 'in-at-e1',
      name: 'IN',
      language: 'English',
      license: 'No rights reserved.',
      formatVersion: BOOK_MODULE_FORMAT_VERSION,
      kind: 'book',
      capabilities: { strongsTagged: false },
    })
    expect(artifact.manifest.book).toEqual({
      number: 102,
      editionCode: 'IN-AT-E1',
      author: 'A Team',
      year: 2026,
      abbreviation: 'IN',
      aliases: ['In'],
      sections: [
        { chapter: 0, name: 'Prologue', named: true, paragraphs: 2 },
        {
          chapter: 1,
          name: 'Man as God Intended',
          paragraphs: 1,
          part: 'PART ONE: Fall of man',
        },
      ],
    })
  })

  it('keys paragraph content by book, section, and paragraph', () => {
    expect(artifact.books[102][makeVerseId(102, 0, 2)].text).toBe(
      'Why the title IN?',
    )
    expect(artifact.books[102][makeVerseId(102, 1, 2)]).toBeUndefined()
  })

  it('carries a refs channel beside the prose of a citing paragraph', () => {
    const paragraph = artifact.books[102][makeVerseId(102, 0, 1)]
    expect(
      paragraph.refs?.map((span) => paragraph.text.slice(span.start, span.end)),
    ).toEqual(['2 Peter 1:11', '2 Peter 3:13'])
  })

  it('links the author’s own cross-walk onto the book’s grid', () => {
    const paragraph = artifact.books[102][makeVerseId(102, 1, 1)]
    expect(paragraph.refs).toEqual([
      {
        start: paragraph.text.indexOf('Chapter 0'),
        end: paragraph.text.indexOf('Chapter 0') + 'Chapter 0'.length,
        ranges: [
          { startId: makeVerseId(102, 0, 1), endId: makeVerseId(102, 0, 2) },
        ],
      },
    ])
  })

  it('keeps epigraphs beside the prose as section metadata, citations live', () => {
    expect(artifact.epigraphs[1]).toEqual([
      {
        quote: 'Not I, but Christ.',
        attribution: 'Galatians 2:20',
        refs: [
          {
            start: 0,
            end: 'Galatians 2:20'.length,
            ranges: [
              { startId: makeVerseId(48, 2, 20), endId: makeVerseId(48, 2, 20) },
            ],
          },
        ],
      },
    ])
  })

  it('hangs a heading on the paragraph it precedes, consuming no id', () => {
    expect(artifact.manifest.book.sections[0].paragraphs).toBe(2)
    expect(artifact.books[102][makeVerseId(102, 0, 2)]).toMatchObject({
      text: 'Why the title IN?',
      headings: [{ text: 'Introduction', level: 'section' }],
    })
    expect(artifact.books[102][makeVerseId(102, 0, 1)]).not.toHaveProperty(
      'headings',
    )
  })

  it('opens a Part on the first paragraph of its first section', () => {
    expect(artifact.books[102][makeVerseId(102, 1, 1)].headings).toEqual([
      { text: 'PART ONE: Fall of man', level: 'part' },
    ])
  })

  it('names the Part each section sits under in the section table', () => {
    expect(artifact.manifest.book.sections.map((section) => section.part)).toEqual(
      [undefined, 'PART ONE: Fall of man'],
    )
  })

  it('publishes a book module at the book format version', () => {
    expect(artifact.manifest.formatVersion).toBe(BOOK_MODULE_FORMAT_VERSION)
    expect(BOOK_MODULE_FORMAT_VERSION).toBeGreaterThan(MODULE_FORMAT_VERSION)
  })

  it('refuses a source whose book has no registry entry', () => {
    expect(() => buildBookArtifact(source, [])).toThrow(
      /in-at-e1 is not in the Book Registry/,
    )
  })

  it('refuses a registry entry that cannot describe a published module', () => {
    const { year: _year, ...incomplete } = entry
    expect(() => buildBookArtifact(source, [incomplete])).toThrow(
      /in-at-e1 is missing "year"/,
    )
  })

  it('reports how many live citations each section came out with', () => {
    expect([...refSpanCounts(artifact)]).toEqual([
      [0, 2],
      [1, 2],
    ])
  })
})
