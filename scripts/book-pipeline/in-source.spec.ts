import { readFileSync } from 'node:fs'
import { afterAll, describe, expect, it } from 'vitest'
import {
  deregisterManifestBook,
  registerManifestBook,
} from '../../src/modules/book-registration'
import type { ModuleManifest } from '../../src/modules/module-manifest'
import { parseReference } from '../../src/reference/parse-reference'
import { makeVerseId } from '../../src/reference/verse-id'
import { buildBookArtifact, refSpanCounts } from './build-book-artifact'
import { parseBookRegistry } from './book-registry'
import { parseRefOverrides } from './ref-overrides'

// The golden test over the real curated source: the first release freezes
// this grid forever (ADR 0002), so every section number, name and paragraph
// count is spelled out here and a change to any of them is a deliberate one.
const artifact = buildBookArtifact(
  readFileSync('resources/IN First Edition.md', 'utf8'),
  parseBookRegistry(readFileSync('scripts/book-registry.json', 'utf8')),
  parseRefOverrides(
    readFileSync('scripts/in-pipeline/ref-overrides.json', 'utf8'),
  ),
)

describe('IN First Edition', () => {
  it('publishes the module the catalogue offers as in-at-e1', () => {
    expect(artifact.manifest).toMatchObject({
      id: 'in-at-e1',
      name: 'IN',
      language: 'English',
      license:
        'No rights reserved. Any part of this publication may be reproduced ' +
        'in its context. Copies may be distributed by any means.',
      kind: 'book',
    })
    expect(artifact.manifest.book).toMatchObject({
      number: 102,
      editionCode: 'IN-AT-E1',
      author: 'A Team',
      year: 2026,
      abbreviation: 'IN',
      aliases: ['In'],
    })
  })

  it('lays the book out on 36 sections: front matter, 31 chapters, back matter', () => {
    expect(artifact.manifest.book.sections).toEqual([
      { chapter: 0, name: 'Prologue', named: true, paragraphs: 23 },
      { chapter: 1, name: 'Man as God Intended', paragraphs: 9 },
      { chapter: 2, name: 'The Two Trees', paragraphs: 5 },
      { chapter: 3, name: 'God’s Law', paragraphs: 5 },
      { chapter: 4, name: 'Satan’s Tactics', paragraphs: 12 },
      { chapter: 5, name: 'Love of the World', paragraphs: 5 },
      { chapter: 6, name: 'Fall of Man / First Transaction', paragraphs: 8 },
      { chapter: 7, name: 'Man under Satan’s Dominion (Fruit of the Flesh)', paragraphs: 29 },
      { chapter: 8, name: 'Introduction to Death for Sin / The Second Transaction', paragraphs: 7 },
      { chapter: 9, name: 'Redemption of Man (Reconciliation)', paragraphs: 10 },
      { chapter: 10, name: 'Satan Was Completely Defeated on the Cross and Dominion Went to Man', paragraphs: 8 },
      { chapter: 11, name: 'His Footsteps', paragraphs: 5 },
      { chapter: 12, name: 'Our Pathway', paragraphs: 71 },
      { chapter: 13, name: 'Introduction to Righteousness', paragraphs: 23 },
      { chapter: 14, name: 'Faith and Righteousness', paragraphs: 3 },
      { chapter: 15, name: 'Present Yourself to God', paragraphs: 34 },
      { chapter: 16, name: 'Obey from the Heart', paragraphs: 6 },
      { chapter: 17, name: 'Obedience Leads to Righteousness', paragraphs: 19 },
      { chapter: 18, name: 'Mercy', paragraphs: 21 },
      { chapter: 19, name: 'Grace Reigns through Righteousness', paragraphs: 35 },
      { chapter: 20, name: 'The Culture of the Kingdom', paragraphs: 4 },
      { chapter: 21, name: 'Bearing Fruit', paragraphs: 13 },
      { chapter: 22, name: 'Submit to One Another in the Fear of God', paragraphs: 11 },
      { chapter: 23, name: 'Forgiveness', paragraphs: 35 },
      { chapter: 24, name: 'Worship', paragraphs: 17 },
      { chapter: 25, name: 'Your Ministry – Declaring Jesus', paragraphs: 12 },
      { chapter: 26, name: 'New Covenant Ministry', paragraphs: 35 },
      { chapter: 27, name: 'Jesus’ Wife', paragraphs: 31 },
      { chapter: 28, name: 'Knowing God', paragraphs: 121 },
      { chapter: 29, name: 'We Are at War', paragraphs: 59 },
      { chapter: 30, name: 'Armour of God', paragraphs: 49 },
      { chapter: 31, name: 'Body of Jesus', paragraphs: 42 },
      { chapter: 32, name: 'Epilogue', named: true, paragraphs: 8 },
      { chapter: 33, name: 'Appendix A', named: true, paragraphs: 3 },
      { chapter: 34, name: 'Appendix B', named: true, paragraphs: 14 },
      { chapter: 35, name: 'Appendix C', named: true, paragraphs: 25 },
    ])
  })

  it('carries every paragraph the sections promise', () => {
    const paragraphs = artifact.books[102]
    expect(Object.keys(paragraphs)).toHaveLength(817)
    for (const section of artifact.manifest.book.sections) {
      expect(
        paragraphs[makeVerseId(102, section.chapter, section.paragraphs)],
      ).toBeDefined()
      expect(
        paragraphs[makeVerseId(102, section.chapter, section.paragraphs + 1)],
      ).toBeUndefined()
    }
  })

  it('links the author’s scripture citations as ref spans', () => {
    const prologue = artifact.books[102][makeVerseId(102, 0, 3)]
    expect(
      prologue.refs?.map((span) =>
        prologue.text.slice(span.start, span.end),
      ),
    ).toEqual(['2 Peter 1:11', '2 Peter 3:13'])
    expect(
      [...refSpanCounts(artifact).values()].reduce(
        (total, refs) => total + refs,
        0,
      ),
    ).toBe(538)
  })

  it('leaves the flattened table’s bare chapter:verse cells unlinked', () => {
    const table = artifact.books[102][makeVerseId(102, 0, 21)]
    expect(table.text).toContain('| Faithful in Christ | 1:1 |')
    expect(table.refs).toBeUndefined()
  })

  it('keeps Part and sub-section headings out of the paragraphs', () => {
    for (const paragraph of Object.values(artifact.books[102])) {
      expect(paragraph).not.toHaveProperty('headings')
      expect(paragraph.text).not.toMatch(/^PART [A-Z]+:/)
    }
  })
})

describe('the built IN module in the plugin’s own loading path', () => {
  const manifest: ModuleManifest = {
    ...artifact.manifest,
    source: 'https://example.test/in-at-e1-module.json',
    sourceChecksum: 'checksum',
  }
  registerManifestBook(manifest)
  afterAll(() => {
    deregisterManifestBook(manifest)
  })

  it.each([
    ['IN 0:1', makeVerseId(102, 0, 1)],
    ['IN 12:3', makeVerseId(102, 12, 3)],
    ['In 35:1', makeVerseId(102, 35, 1)],
  ])('resolves %s against the installed section table', (text, verseId) => {
    expect(parseReference(text)?.reference.ranges).toEqual([
      { startId: verseId, endId: verseId },
    ])
  })

  it('refuses a paragraph the section table does not have', () => {
    expect(parseReference('IN 14:99')).toBeNull()
  })
})
