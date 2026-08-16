import { describe, expect, it } from 'vitest'
import { maskInlineCodeSpans, scanReferenceMatches } from './scan-references'
import { makeVerseId } from './verse-id'

const john = (chapter: number, verse: number) => makeVerseId(43, chapter, verse)

describe('maskInlineCodeSpans', () => {
  it('blanks code spans while preserving length and surrounding text', () => {
    expect(maskInlineCodeSpans('a `{John 15:4}` b')).toBe(
      `a ${' '.repeat('`{John 15:4}`'.length)} b`,
    )
  })

  it('leaves unclosed backtick runs and plain text untouched', () => {
    expect(maskInlineCodeSpans('no code here')).toBe('no code here')
    expect(maskInlineCodeSpans('open ` {John 15:4}')).toBe('open ` {John 15:4}')
  })
})

describe('scanReferenceMatches', () => {
  it('finds a match with brace-inclusive start and end offsets', () => {
    const matches = scanReferenceMatches('Abide: {John 15:4} in him.')

    expect(matches).toHaveLength(1)
    expect(matches[0].start).toBe(7)
    expect(matches[0].end).toBe(18)
    expect(matches[0].parsed.reference).toEqual({
      book: 43,
      ranges: [{ startId: john(15, 4), endId: john(15, 4) }],
    })
  })

  it('finds multiple matches in reading order', () => {
    const matches = scanReferenceMatches('{John 15:4} and {Jhn 15:9}')

    expect(matches.map((match) => match.start)).toEqual([0, 16])
  })

  it('classifies option tokens using the provided translation ids', () => {
    const matches = scanReferenceMatches('{John 15:4 nkjv block}', {
      translationIds: ['nkjv'],
    })

    expect(matches[0].parsed.translation).toBe('nkjv')
    expect(matches[0].parsed.display).toBe('block')
    expect(matches[0].parsed.invalidTokens).toEqual([])
  })

  it('ignores braces holding an invalid reference', () => {
    expect(scanReferenceMatches('{"json": true} {Nowhere 3:16}')).toEqual([])
  })

  it('ignores an escaped reference', () => {
    expect(scanReferenceMatches('\\{John 15:4}')).toEqual([])
  })

  it('never matches inside inline code spans', () => {
    expect(scanReferenceMatches('use `{John 15:4}` literally')).toEqual([])
  })

  it('matches after an inline code span closes', () => {
    const matches = scanReferenceMatches('`code` then {John 15:4}')

    expect(matches.map((match) => match.start)).toEqual([12])
  })

  it('never matches inside fenced code blocks', () => {
    const content = '```\n{John 15:4}\n```\n{John 15:9}\n'
    const matches = scanReferenceMatches(content)

    expect(matches.map((match) => match.start)).toEqual([
      content.indexOf('{John 15:9}'),
    ])
  })

  it('never matches inside frontmatter', () => {
    const content = '---\nref: John 15:4\ntitle: "{John 15:9}"\n---\n{John 15:1}\n'
    const matches = scanReferenceMatches(content)

    expect(matches.map((match) => match.start)).toEqual([
      content.indexOf('{John 15:1}'),
    ])
  })
})
