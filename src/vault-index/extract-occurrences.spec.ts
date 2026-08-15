import { describe, expect, it } from 'vitest'
import { makeVerseId } from '../reference'
import { extractOccurrences } from './extract-occurrences'

const john = (chapter: number, verse: number) => makeVerseId(43, chapter, verse)

describe('extractOccurrences', () => {
  it('finds a body reference with its position and normalized ranges', () => {
    expect(extractOccurrences('Abide: {John 15:4} in him.', null)).toEqual([
      {
        position: 7,
        reference: { book: 43, ranges: [{ startId: john(15, 4), endId: john(15, 4) }] },
        source: 'body',
      },
    ])
  })

  it('finds multiple references in reading order', () => {
    const occurrences = extractOccurrences('{John 15:4} and {Jhn 15:9}', null)
    expect(occurrences.map((o) => o.position)).toEqual([0, 16])
  })

  it('ignores braces holding an invalid reference', () => {
    expect(extractOccurrences('{"json": true} {Nowhere 3:16}', null)).toEqual([])
  })

  it('keeps normalized reference when option tokens trail it', () => {
    const occurrences = extractOccurrences('{John 15:4 nkjv callout}', null)
    expect(occurrences).toEqual([
      {
        position: 0,
        reference: { book: 43, ranges: [{ startId: john(15, 4), endId: john(15, 4) }] },
        source: 'body',
      },
    ])
  })

  it('ignores an escaped reference', () => {
    expect(extractOccurrences('\\{John 15:4}', null)).toEqual([])
  })

  it('never parses inside inline code spans', () => {
    expect(extractOccurrences('use `{John 15:4}` literally', null)).toEqual([])
  })

  it('parses after an inline code span closes', () => {
    const occurrences = extractOccurrences('`code` then {John 15:4}', null)
    expect(occurrences.map((o) => o.position)).toEqual([12])
  })

  it('treats a double-backtick span as one code span', () => {
    expect(extractOccurrences('`` `{John 15:4}` `` text', null)).toEqual([])
  })

  it('recovers a reference nested inside stray braces', () => {
    const occurrences = extractOccurrences('{{John 15:4}}', null)
    expect(occurrences.map((o) => o.position)).toEqual([1])
  })
})
