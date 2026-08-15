import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { makeVerseId } from '../../src/reference/verse-id'
import type { TaggedVerse } from '../../src/modules/verse-content'
import { parseBsbTables } from './parse-bsb-tables'

const fixture = readFileSync('tests/fixtures/bsb-tables-slice.tsv', 'utf8')

const verses = parseBsbTables(fixture)

const verse = (book: number, chapter: number, verseNr: number): TaggedVerse => {
  const content = verses.get(book)?.[makeVerseId(book, chapter, verseNr)]
  if (content === undefined) throw new Error('verse missing from parse result')
  return content
}

const tagged = (taggedVerse: TaggedVerse, span: number): string =>
  taggedVerse.text.slice(taggedVerse.tags[span].start, taggedVerse.tags[span].end)

describe('parseBsbTables verse text', () => {
  it('assembles Genesis 1:1 from word rows with attached punctuation', () => {
    expect(verse(1, 1, 1).text).toBe(
      'In the beginning God created the heavens and the earth.',
    )
  })
})

describe('parseBsbTables tag spans', () => {
  it('maps each translated word to its Strong Hebrew number', () => {
    const genesis11 = verse(1, 1, 1)
    expect(genesis11.tags).toHaveLength(6)
    expect(tagged(genesis11, 0)).toBe('In the beginning')
    expect(genesis11.tags[0].strongs).toEqual(['H7225'])
    expect(tagged(genesis11, 1)).toBe('God')
    expect(genesis11.tags[1].strongs).toEqual(['H0430'])
    expect(tagged(genesis11, 5)).toBe('the earth')
    expect(genesis11.tags[5].strongs).toEqual(['H0776'])
  })
})
