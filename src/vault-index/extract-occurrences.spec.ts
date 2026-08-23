import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  HUMILITY_BOOK,
  installHumilityBook,
  uninstallHumilityBook,
} from '../../tests/fixtures/humility-book'
import { makeVerseId } from '../reference'
import { extractOccurrences } from './extract-occurrences'

const john = (chapter: number, verse: number) => makeVerseId(43, chapter, verse)

describe('extractOccurrences', () => {
  it('finds a body reference with its position and normalized ranges', () => {
    expect(extractOccurrences('Abide: {John 15:4} in him.')).toEqual([
      {
        position: 7,
        reference: { book: 43, ranges: [{ startId: john(15, 4), endId: john(15, 4) }] },
        source: 'body',
        translation: null,
      },
    ])
  })

  it('indexes a relative reference with its resolved reference', () => {
    const occurrences = extractOccurrences('{John 15:4-9} and {:5}')

    expect(occurrences[1]).toEqual({
      position: 18,
      reference: { book: 43, ranges: [{ startId: john(15, 5), endId: john(15, 5) }] },
      source: 'body',
      translation: null,
    })
  })

  it('indexes an anchor and its relative reference as two occurrences', () => {
    const content = 'On {John 15:4-9}: {:5} above all.'

    expect(extractOccurrences(content)).toEqual([
      {
        position: content.indexOf('{John 15:4-9}'),
        reference: { book: 43, ranges: [{ startId: john(15, 4), endId: john(15, 9) }] },
        source: 'body',
        translation: null,
      },
      {
        position: content.indexOf('{:5}'),
        reference: { book: 43, ranges: [{ startId: john(15, 5), endId: john(15, 5) }] },
        source: 'body',
        translation: null,
      },
    ])
  })

  it('indexes no occurrence for a relative reference outside its anchor', () => {
    const occurrences = extractOccurrences('{John 15:4-6} and {:9}')

    expect(occurrences.map((o) => o.position)).toEqual([0])
  })

  it('indexes no occurrence for a relative reference before any anchor', () => {
    expect(extractOccurrences('{:5} comes first')).toEqual([])
  })

  it('never accepts a relative reference as the frontmatter ref', () => {
    const content = '---\nref: :5\n---\n{John 15:4-9}'

    expect(extractOccurrences(content).map((o) => o.source)).toEqual(['body'])
  })

  it('never anchors a relative reference on the frontmatter ref', () => {
    const occurrences = extractOccurrences('---\nref: John 15:4-9\n---\n{:5}')

    expect(occurrences.map((occurrence) => occurrence.source)).toEqual([
      'annotation-frontmatter',
    ])
  })

  it('finds multiple references in reading order', () => {
    const occurrences = extractOccurrences('{John 15:4} and {Jhn 15:9}')
    expect(occurrences.map((o) => o.position)).toEqual([0, 16])
  })

  it('ignores braces holding an invalid reference', () => {
    expect(extractOccurrences('{"json": true} {Nowhere 3:16}')).toEqual([])
  })

  it('keeps normalized reference when option tokens trail it', () => {
    const occurrences = extractOccurrences('{John 15:4 nkjv block}')
    expect(occurrences).toEqual([
      {
        position: 0,
        reference: { book: 43, ranges: [{ startId: john(15, 4), endId: john(15, 4) }] },
        source: 'body',
        translation: null,
      },
    ])
  })

  it('carries the translation token when the id is known', () => {
    const occurrences = extractOccurrences('{John 15:4 nkjv} {John 15:9}', {
      translationIds: ['nkjv'],
    })
    expect(occurrences.map((o) => o.translation)).toEqual(['nkjv', null])
  })

  it('carries a known translation on a frontmatter ref', () => {
    const occurrences = extractOccurrences('---\nref: John 15:4 kjv\n---\n', {
      translationIds: ['kjv'],
    })
    expect(occurrences.map((o) => o.translation)).toEqual(['kjv'])
  })

  it('ignores an escaped reference', () => {
    expect(extractOccurrences('\\{John 15:4}')).toEqual([])
  })

  it('never parses inside inline code spans', () => {
    expect(extractOccurrences('use `{John 15:4}` literally')).toEqual([])
  })

  it('parses after an inline code span closes', () => {
    const occurrences = extractOccurrences('`code` then {John 15:4}')
    expect(occurrences.map((o) => o.position)).toEqual([12])
  })

  it('treats a double-backtick span as one code span', () => {
    expect(extractOccurrences('`` `{John 15:4}` `` text')).toEqual([])
  })

  it('never parses inside fenced code blocks', () => {
    const content = 'before\n```\n{John 15:4}\n```\nafter {John 15:9}'
    const occurrences = extractOccurrences(content)
    expect(occurrences.map((o) => o.position)).toEqual([
      content.indexOf('{John 15:9}'),
    ])
  })

  it('closes a fence only with a marker at least as long', () => {
    const content = '````\n```\n{John 15:4}\n````\n{John 15:9}'
    const occurrences = extractOccurrences(content)
    expect(occurrences.map((o) => o.position)).toEqual([
      content.indexOf('{John 15:9}'),
    ])
  })

  it('treats tilde fences as code blocks too', () => {
    expect(extractOccurrences('~~~\n{John 15:4}\n~~~\n')).toEqual([])
  })

  it('indexes a valid frontmatter ref as an annotation-frontmatter occurrence', () => {
    const content = '---\nref: John 15:4-6,9\n---\nMy thoughts.'
    expect(extractOccurrences(content)).toEqual([
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
        translation: null,
      },
    ])
  })

  it('reads the frontmatter ref from the note content alone', () => {
    const occurrences = extractOccurrences('---\nref: John 15:4\n---\n')
    expect(occurrences.map((o) => o.source)).toEqual(['annotation-frontmatter'])
  })

  it('reads a double-quoted frontmatter ref', () => {
    const occurrences = extractOccurrences('---\nref: "John 15:4"\n---\n')
    expect(occurrences).toEqual([
      {
        position: 0,
        reference: { book: 43, ranges: [{ startId: john(15, 4), endId: john(15, 4) }] },
        source: 'annotation-frontmatter',
        translation: null,
      },
    ])
  })

  it('reads a single-quoted frontmatter ref', () => {
    const occurrences = extractOccurrences("---\nref: 'John 15:4'\n---\n")
    expect(occurrences.map((o) => o.source)).toEqual(['annotation-frontmatter'])
  })

  it('finds the ref among other frontmatter keys', () => {
    const content = '---\ntitle: Abiding\nref: John 15:4\ntags: [study]\n---\n'
    expect(extractOccurrences(content).map((o) => o.source)).toEqual([
      'annotation-frontmatter',
    ])
  })

  it('ignores a ref-looking line outside the frontmatter block', () => {
    expect(extractOccurrences('ref: John 15:4\n')).toEqual([])
  })

  it('ignores a ref-looking line in the body below frontmatter', () => {
    expect(extractOccurrences('---\ntitle: x\n---\nref: John 15:4\n')).toEqual([])
  })

  it('silently skips an invalid frontmatter ref', () => {
    expect(extractOccurrences('---\nref: Nowhere 3\n---\n')).toEqual([])
  })

  it('silently skips an empty frontmatter ref', () => {
    expect(extractOccurrences('---\nref:\n---\n')).toEqual([])
  })

  it('never scans the frontmatter block as body text', () => {
    const content = '---\ntitle: "{John 15:4}"\n---\nbody'
    expect(extractOccurrences(content)).toEqual([])
  })

  it('keeps absolute body positions below a frontmatter block', () => {
    const content = '---\nref: John 15:4\n---\nsee {John 15:9}'
    const occurrences = extractOccurrences(content)
    expect(
      occurrences.map((o) => ({ position: o.position, source: o.source })),
    ).toEqual([
      { position: 0, source: 'annotation-frontmatter' },
      { position: content.indexOf('{John 15:9}'), source: 'body' },
    ])
  })

  it('reads the frontmatter ref of a CRLF annotation note', () => {
    const content = '---\r\nref: John 15:4\r\n---\r\nMy thoughts.'
    expect(extractOccurrences(content)).toEqual([
      {
        position: 0,
        reference: { book: 43, ranges: [{ startId: john(15, 4), endId: john(15, 4) }] },
        source: 'annotation-frontmatter',
        translation: null,
      },
    ])
  })

  it('never scans a CRLF frontmatter block as body text', () => {
    const content = '---\r\ntitle: "{John 15:4}"\r\n---\r\nbody'
    expect(extractOccurrences(content)).toEqual([])
  })

  it('keeps absolute body positions in a CRLF note', () => {
    const content = '---\r\nref: John 15:4\r\n---\r\nsee {John 15:9}'
    const occurrences = extractOccurrences(content)
    expect(
      occurrences.map((o) => ({ position: o.position, source: o.source })),
    ).toEqual([
      { position: 0, source: 'annotation-frontmatter' },
      { position: content.indexOf('{John 15:9}'), source: 'body' },
    ])
  })

  it('never parses inside CRLF fenced code blocks', () => {
    const content = 'before\r\n```\r\n{John 15:4}\r\n```\r\nafter {John 15:9}'
    const occurrences = extractOccurrences(content)
    expect(occurrences.map((o) => o.position)).toEqual([
      content.indexOf('{John 15:9}'),
    ])
  })

  it('recovers a reference nested inside stray braces', () => {
    const occurrences = extractOccurrences('{{John 15:4}}')
    expect(occurrences.map((o) => o.position)).toEqual([1])
  })
})

// Book references need no indexing mechanism of their own: they become
// Occurrences the moment the grammar accepts them (spec-books §6).
describe('extractOccurrences — installed books', () => {
  const paragraph = (chapter: number, atom: number) =>
    makeVerseId(HUMILITY_BOOK, chapter, atom)

  beforeEach(installHumilityBook)
  afterEach(uninstallHumilityBook)

  it('indexes a note whose frontmatter ref names a book as an annotation', () => {
    const content = '---\nref: Humility 2:2\n---\nnotes'

    expect(extractOccurrences(content)).toEqual([
      {
        position: 0,
        reference: {
          book: HUMILITY_BOOK,
          ranges: [{ startId: paragraph(2, 2), endId: paragraph(2, 2) }],
        },
        source: 'annotation-frontmatter',
        translation: null,
      },
    ])
  })

  it('indexes a book reference in the body', () => {
    const occurrences = extractOccurrences('see {Humility 0:3} and {John 15:4}')

    expect(occurrences.map((occurrence) => occurrence.reference.book)).toEqual([
      HUMILITY_BOOK,
      43,
    ])
  })

  it('drops book occurrences while the module is uninstalled and restores them', () => {
    const content = '---\nref: Humility 2:2\n---\nsee {Humility 0:3}'

    uninstallHumilityBook()
    expect(extractOccurrences(content)).toEqual([])

    installHumilityBook()
    expect(extractOccurrences(content)).toHaveLength(2)
  })
})
