import { describe, expect, it } from 'vitest'
import { makeVerseId } from '../../src/reference/verse-id'
import type { VerseRange } from '../../src/reference/verse-range'
import {
  parseAttributionRefSpans,
  parseParagraphRefSpans,
  unresolvedAttribution,
  unresolvedCitations,
} from './parse-ref-spans'

const JOB = 18
const ISAIAH = 23
const MATTHEW = 40
const LUKE = 42
const JOHN = 43
const FIRST_CORINTHIANS = 46
const SECOND_CORINTHIANS = 47
const EPHESIANS = 49
const FIRST_THESSALONIANS = 52
const FIRST_TIMOTHY = 54
const REVELATION = 66

const HUMILITY = 101

const verses = (
  book: number,
  chapter: number,
  from: number,
  to = from,
): VerseRange => ({
  startId: makeVerseId(book, chapter, from),
  endId: makeVerseId(book, chapter, to),
})

const NOTE_RANGES = new Map<string, VerseRange>([
  ['A', verses(HUMILITY, 13, 1, 4)],
  ['B', verses(HUMILITY, 14, 1, 2)],
])

const spansOf = (text: string) => parseParagraphRefSpans(text, NOTE_RANGES)

const matchedText = (text: string): string[] =>
  spansOf(text).map((span) => text.slice(span.start, span.end))

const rangesOf = (text: string): VerseRange[][] =>
  spansOf(text).map((span) => span.ranges)

// The census in docs/research/humility-source-text.md: every parenthetical
// citation the real Gutenberg #57121 text carries, quoted verbatim.
describe('parseParagraphRefSpans', () => {
  it('spans the citation text without its brackets', () => {
    const text = "'I speak not of Myself' (John xiv. 10), He said."
    expect(matchedText(text)).toEqual(['John xiv. 10'])
    expect(rangesOf(text)).toEqual([[verses(JOHN, 14, 10)]])
  })

  it('normalizes the roman chapter and arabic verse of a plain citation', () => {
    expect(rangesOf('(John v. 19)')).toEqual([[verses(JOHN, 5, 19)]])
    expect(rangesOf('(Luke xviii. 14)')).toEqual([[verses(LUKE, 18, 14)]])
    expect(rangesOf('(Eph. iii. 8)')).toEqual([[verses(EPHESIANS, 3, 8)]])
    expect(rangesOf('(Luke xxii. 26)')).toEqual([[verses(LUKE, 22, 26)]])
    expect(rangesOf('(John vii. 28)')).toEqual([[verses(JOHN, 7, 28)]])
  })

  it('reads a numbered book name', () => {
    expect(rangesOf('(1 Thess. ii. 10)')).toEqual([
      [verses(FIRST_THESSALONIANS, 2, 10)],
    ])
    expect(rangesOf('(2 Cor. i. 12)')).toEqual([
      [verses(SECOND_CORINTHIANS, 1, 12)],
    ])
  })

  it('stays lenient about the chapter numeral missing its period', () => {
    expect(rangesOf('(John v 30)')).toEqual([[verses(JOHN, 5, 30)]])
  })

  it('reads a hyphenated verse range', () => {
    expect(rangesOf('(Luke xiv. 1-11)')).toEqual([[verses(LUKE, 14, 1, 11)]])
  })

  it('merges an adjacent verse list into one range', () => {
    expect(rangesOf('(1 Cor. xv. 9,10)')).toEqual([
      [verses(FIRST_CORINTHIANS, 15, 9, 10)],
    ])
  })

  it('keeps a gapped verse list as separate ranges', () => {
    expect(rangesOf('(1 Tim. i. 13, 15)')).toEqual([
      [verses(FIRST_TIMOTHY, 1, 13), verses(FIRST_TIMOTHY, 1, 15)],
    ])
  })

  it('spans each citation of a semicolon-separated pair on its own', () => {
    const text = '(Job xlii. 5, 6; Isa. vi. 5)'
    expect(matchedText(text)).toEqual(['Job xlii. 5, 6', 'Isa. vi. 5'])
    expect(rangesOf(text)).toEqual([
      [verses(JOB, 42, 5, 6)],
      [verses(ISAIAH, 6, 5)],
    ])
  })

  it('links a Note pointer to the whole note section of the book itself', () => {
    const text = 'no other way. (See Note A.)'
    expect(matchedText(text)).toEqual(['See Note A.'])
    expect(rangesOf(text)).toEqual([[verses(HUMILITY, 13, 1, 4)]])
  })

  it('leaves an unreferenced allusion plain', () => {
    expect(spansOf("'He humbled Himself' and was obedient.")).toEqual([])
  })

  it('leaves a parenthetical that is not a citation plain', () => {
    expect(spansOf('the little book (Nisbet & Co., 1s) is worth reading')).toEqual(
      [],
    )
  })

  it('never linkifies a citation outside brackets', () => {
    expect(spansOf('as Genesis i. 1 has it')).toEqual([])
  })

  it('refuses a chapter the scripture grid does not have', () => {
    expect(spansOf('(Matt. xxxiii. 11)')).toEqual([])
  })

  it('refuses a verse beyond the end of its chapter', () => {
    expect(spansOf('(Genesis i. 99)')).toEqual([])
  })

  it('ignores a roman-looking word that is not a numeral', () => {
    expect(spansOf('(Luke civil 12)')).toEqual([])
  })

  it('carries the book across a comma-separated second chapter', () => {
    const text = '(Luke xiv. 11, xviii. 13)'
    expect(matchedText(text)).toEqual(['Luke xiv. 11', 'xviii. 13'])
    expect(rangesOf(text)).toEqual([
      [verses(LUKE, 14, 11)],
      [verses(LUKE, 18, 13)],
    ])
  })
})

describe('unresolvedCitations', () => {
  it('reports a citation-shaped bracket the parser could not resolve', () => {
    const text = 'the strife among them (Luke 9:46; Matt. 18:3) was plain'
    expect(unresolvedCitations(text, spansOf(text))).toEqual([
      '(Luke 9:46; Matt. 18:3)',
    ])
  })

  it('reports a mangled chapter numeral', () => {
    const text = 'your servant (Matt. xxxiii. 11)'
    expect(unresolvedCitations(text, spansOf(text))).toEqual([
      '(Matt. xxxiii. 11)',
    ])
  })

  it('reports a Note pointer with no such note', () => {
    const text = 'the rest follows (See Note Z.)'
    expect(unresolvedCitations(text, spansOf(text))).toEqual(['(See Note Z.)'])
  })

  it('stays quiet once a span covers the bracket', () => {
    const text = "'I seek not Mine own will' (John v. 30)."
    expect(unresolvedCitations(text, spansOf(text))).toEqual([])
  })

  it('stays quiet about brackets that never looked like citations', () => {
    const text = 'a shilling book (Nisbet & Co., 1s) and (a) a note'
    expect(unresolvedCitations(text, spansOf(text))).toEqual([])
  })

  it('accepts a span supplied from outside the parser', () => {
    const text = 'the strife among them (Luke 9:46) was plain'
    const supplied = [
      { start: 23, end: 31, ranges: [verses(LUKE, 9, 46)] },
    ]
    expect(unresolvedCitations(text, supplied)).toEqual([])
  })
})

// The chapter epigraphs carry their citation in the attribution line, so the
// same scanner runs over the whole string rather than over brackets.
describe('parseAttributionRefSpans', () => {
  it('spans the citation of a plain attribution', () => {
    const text = 'REV. iv. 11.'
    expect(
      parseAttributionRefSpans(text).map((span) => text.slice(span.start, span.end)),
    ).toEqual(['REV. iv. 11'])
    expect(parseAttributionRefSpans(text).map((span) => span.ranges)).toEqual([
      [verses(REVELATION, 4, 11)],
    ])
  })

  it('reads an attribution that never got its closing period', () => {
    expect(parseAttributionRefSpans('1 TIM. i. 15').map((s) => s.ranges)).toEqual(
      [[verses(FIRST_TIMOTHY, 1, 15)]],
    )
  })

  it('spans two chapters of one book separately', () => {
    const text = 'LUKE xiv. 11, xviii. 13.'
    expect(
      parseAttributionRefSpans(text).map((span) => text.slice(span.start, span.end)),
    ).toEqual(['LUKE xiv. 11', 'xviii. 13'])
  })

  it('reports an attribution whose citation went unresolved', () => {
    const text = 'MATT. xxxiii. 11.'
    expect(unresolvedAttribution(text, parseAttributionRefSpans(text))).toBe(text)
  })

  it('reports nothing for an attribution that is not a citation', () => {
    const text = 'GEORGE FOXE'
    expect(unresolvedAttribution(text, parseAttributionRefSpans(text))).toBeNull()
  })

  it('reports nothing once the citation resolves', () => {
    const text = 'MATT. xi. 29.'
    const spans = parseAttributionRefSpans(text)
    expect(spans.map((span) => span.ranges)).toEqual([[verses(MATTHEW, 11, 29)]])
    expect(unresolvedAttribution(text, spans)).toBeNull()
  })
})
