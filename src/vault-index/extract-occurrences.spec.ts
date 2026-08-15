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

  it('never parses inside fenced code blocks', () => {
    const content = 'before\n```\n{John 15:4}\n```\nafter {John 15:9}'
    const occurrences = extractOccurrences(content, null)
    expect(occurrences.map((o) => o.position)).toEqual([
      content.indexOf('{John 15:9}'),
    ])
  })

  it('closes a fence only with a marker at least as long', () => {
    const content = '````\n```\n{John 15:4}\n````\n{John 15:9}'
    const occurrences = extractOccurrences(content, null)
    expect(occurrences.map((o) => o.position)).toEqual([
      content.indexOf('{John 15:9}'),
    ])
  })

  it('treats tilde fences as code blocks too', () => {
    expect(extractOccurrences('~~~\n{John 15:4}\n~~~\n', null)).toEqual([])
  })

  it('indexes a valid frontmatter ref as an annotation-frontmatter occurrence', () => {
    const content = '---\nref: John 15:4-6,9\n---\nMy thoughts.'
    expect(extractOccurrences(content, 'John 15:4-6,9')).toEqual([
      {
        position: 0,
        reference: {
          book: 43,
          ranges: [
            { startId: john(15, 4), endId: john(15, 6) },
            { startId: john(15, 9), endId: john(15, 9) },
          ],
        },
        source: 'annotation-frontmatter',
      },
    ])
  })

  it('silently skips an invalid frontmatter ref', () => {
    expect(extractOccurrences('---\nref: Nowhere 3\n---\n', 'Nowhere 3')).toEqual([])
  })

  it('never scans the frontmatter block as body text', () => {
    const content = '---\ntitle: "{John 15:4}"\n---\nbody'
    expect(extractOccurrences(content, null)).toEqual([])
  })

  it('keeps absolute body positions below a frontmatter block', () => {
    const content = '---\nref: John 15:4\n---\nsee {John 15:9}'
    const occurrences = extractOccurrences(content, 'John 15:4')
    expect(
      occurrences.map((o) => ({ position: o.position, source: o.source })),
    ).toEqual([
      { position: 0, source: 'annotation-frontmatter' },
      { position: content.indexOf('{John 15:9}'), source: 'body' },
    ])
  })

  it('recovers a reference nested inside stray braces', () => {
    const occurrences = extractOccurrences('{{John 15:4}}', null)
    expect(occurrences.map((o) => o.position)).toEqual([1])
  })
})
