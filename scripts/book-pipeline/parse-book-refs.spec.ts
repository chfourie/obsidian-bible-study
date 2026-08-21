import { describe, expect, it } from 'vitest'
import { makeVerseId } from '../../src/reference/verse-id'
import type { VerseRange } from '../../src/reference/verse-range'
import { scanBookRefSpans, sectionRangesOf } from './parse-book-refs'
import type { ParsedBookSection } from './parse-book-markdown'

const BOOK = 102

const sections: ParsedBookSection[] = [
  { chapter: 0, name: 'Prologue', named: true, paragraphs: [{ text: 'a' }] },
  {
    chapter: 7,
    name: 'Man under Satan’s Dominion',
    paragraphs: [{ text: 'a' }, { text: 'b' }],
  },
  {
    chapter: 35,
    name: 'Appendix C',
    named: true,
    paragraphs: [{ text: 'a' }, { text: 'b' }, { text: 'c' }],
  },
]

const selfRanges = sectionRangesOf(BOOK, sections)

const spansIn = (text: string): { text: string; ranges: VerseRange[] }[] =>
  scanBookRefSpans(text, selfRanges).spans.map((span) => ({
    text: text.slice(span.start, span.end),
    ranges: span.ranges,
  }))

const range = (
  book: number,
  chapter: number,
  from: number,
  to: number,
): VerseRange => ({
  startId: makeVerseId(book, chapter, from),
  endId: makeVerseId(book, chapter, to),
})

describe('scanBookRefSpans', () => {
  it('links a plain book chapter:verse citation', () => {
    expect(spansIn('The words that I speak. John 14:10 shows it.')).toEqual([
      { text: 'John 14:10', ranges: [range(43, 14, 10, 10)] },
    ])
  })

  it('links a hyphenated verse range', () => {
    expect(spansIn('I used Ephesians 6:10-20.')).toEqual([
      { text: 'Ephesians 6:10-20', ranges: [range(49, 6, 10, 20)] },
    ])
  })

  it('reads an ampersand as a verse list', () => {
    expect(spansIn('the gospel (Romans 1:16&17).')).toEqual([
      { text: 'Romans 1:16&17', ranges: [range(45, 1, 16, 17)] },
    ])
  })

  it('carries the chapter across a comma and semicolon list', () => {
    expect(spansIn('found in: John 5:19, 30 & 41; 6:38.')).toEqual([
      {
        text: 'John 5:19, 30 & 41; 6:38',
        ranges: [
          range(43, 5, 19, 19),
          range(43, 5, 30, 30),
          range(43, 5, 41, 41),
          range(43, 6, 38, 38),
        ],
      },
    ])
  })

  it('links "and"-joined references separately', () => {
    expect(
      spansIn('from 2 Peter 1:11 and 2 Peter 3:13:').map(({ text }) => text),
    ).toEqual(['2 Peter 1:11', '2 Peter 3:13'])
  })

  it('keeps a following ordinal-prefixed citation out of a verse list', () => {
    expect(
      spansIn('Acts 2:33, Ephesians 1:19-23, 1 Peter 3:22.').map(
        ({ text }) => text,
      ),
    ).toEqual(['Acts 2:33', 'Ephesians 1:19-23', '1 Peter 3:22'])
  })

  it('links a parenthesised citation without its brackets', () => {
    expect(spansIn('the whole armour (Ephesians 6:10-20).')).toEqual([
      { text: 'Ephesians 6:10-20', ranges: [range(49, 6, 10, 20)] },
    ])
  })

  it('reads an abbreviated book name', () => {
    expect(spansIn('as in Matt. 18:3.')).toEqual([
      { text: 'Matt. 18:3', ranges: [range(40, 18, 3, 3)] },
    ])
  })

  it('leaves a bare chapter:verse unlinked', () => {
    expect(spansIn('Faithful in Christ 1:1 | Were dead 2:1')).toEqual([])
  })

  it('leaves a whole-chapter citation unlinked', () => {
    expect(spansIn('Read Romans 5-8 and mark every word.')).toEqual([])
  })

  it('links the book to its own chapter by printed number', () => {
    expect(spansIn('as you saw in Chapter 7.')).toEqual([
      { text: 'Chapter 7', ranges: [range(BOOK, 7, 1, 2)] },
    ])
  })

  it('links the book to its own chapter however the author capitalises it', () => {
    expect(spansIn('See chapter 7 on the flesh.')).toEqual([
      { text: 'chapter 7', ranges: [range(BOOK, 7, 1, 2)] },
    ])
  })

  it('links the book to a named back-matter section', () => {
    expect(spansIn('As illustrated in Appendix C, we can operate.')).toEqual([
      { text: 'Appendix C', ranges: [range(BOOK, 35, 1, 3)] },
    ])
  })

  it('links a sub-section pointer to the chapter that holds it', () => {
    expect(spansIn('see 7.3 for the detail')).toEqual([
      { text: '7.3', ranges: [range(BOOK, 7, 1, 2)] },
    ])
  })

  it('stays silent about a capitalised word that only looks like a citation', () => {
    const scanned = scanBookRefSpans('In Him we have redemption 1:7', selfRanges)
    expect(scanned.spans).toEqual([])
    expect(scanned.unresolved).toEqual([])
  })

  it('reports a citation whose verse is off the target grid', () => {
    const scanned = scanBookRefSpans('quoting Matthew 33:11 here', selfRanges)
    expect(scanned.spans).toEqual([])
    expect(scanned.unresolved).toEqual(['Matthew 33:11'])
  })

  it('sorts the spans it found by where they sit in the text', () => {
    expect(
      spansIn('Acts 1:9-11, Acts 2:33, Ephesians 1:19-23').map(
        ({ text }) => text,
      ),
    ).toEqual(['Acts 1:9-11', 'Acts 2:33', 'Ephesians 1:19-23'])
  })
})
