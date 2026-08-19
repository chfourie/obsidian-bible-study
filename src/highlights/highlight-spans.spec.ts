import { describe, expect, it } from 'vitest'
import {
  makeVerseId,
  type HighlightCue,
  type HighlightSlot,
} from '../reference'
import { highlightSpans } from './highlight-spans'

const john = (chapter: number, verse: number) => makeVerseId(43, chapter, verse)

const cue = (
  slot: HighlightSlot,
  startVerse: number,
  startChar: number,
  endVerse: number,
  endChar: number,
): HighlightCue => ({
  slot,
  startVerseId: john(15, startVerse),
  startChar,
  endVerseId: john(15, endVerse),
  endChar,
})

describe('highlightSpans', () => {
  it('maps a single-verse cue to one span', () => {
    expect(highlightSpans([cue(1, 5, 4, 5, 12)], john(15, 5), 40)).toEqual([
      { start: 4, end: 12, slot: 1 },
    ])
  })

  it('ignores cues addressing other verses', () => {
    expect(highlightSpans([cue(1, 5, 4, 5, 12)], john(15, 6), 40)).toEqual([])
  })

  it('runs a multi-verse cue to the end of its first verse', () => {
    expect(highlightSpans([cue(2, 7, 6, 9, 12)], john(15, 7), 30)).toEqual([
      { start: 6, end: 30, slot: 2 },
    ])
  })

  it('covers whole verses between the cue endpoints', () => {
    expect(highlightSpans([cue(2, 7, 6, 9, 12)], john(15, 8), 30)).toEqual([
      { start: 0, end: 30, slot: 2 },
    ])
  })

  it('stops a multi-verse cue at its end offset in the last verse', () => {
    expect(highlightSpans([cue(2, 7, 6, 9, 12)], john(15, 9), 30)).toEqual([
      { start: 0, end: 12, slot: 2 },
    ])
  })

  it('clamps offsets past the stored text length', () => {
    expect(highlightSpans([cue(1, 5, 4, 5, 900)], john(15, 5), 10)).toEqual([
      { start: 4, end: 10, slot: 1 },
    ])
  })

  it('drops a span that starts past the stored text length', () => {
    expect(highlightSpans([cue(1, 5, 40, 5, 90)], john(15, 5), 10)).toEqual([])
  })

  it('drops an empty tail in the cue end verse', () => {
    expect(highlightSpans([cue(2, 7, 6, 9, 0)], john(15, 9), 30)).toEqual([])
  })

  it('lets a later stroke claim the overlap from an earlier one', () => {
    expect(
      highlightSpans(
        [cue(1, 5, 0, 5, 10), cue(2, 5, 5, 5, 15)],
        john(15, 5),
        40,
      ),
    ).toEqual([
      { start: 0, end: 5, slot: 1 },
      { start: 5, end: 15, slot: 2 },
    ])
  })

  it('merges touching spans of the same slot', () => {
    expect(
      highlightSpans(
        [cue(3, 5, 0, 5, 5), cue(3, 5, 5, 5, 9)],
        john(15, 5),
        40,
      ),
    ).toEqual([{ start: 0, end: 9, slot: 3 }])
  })

  it('splits an older span a newer stroke lands inside', () => {
    expect(
      highlightSpans(
        [cue(1, 5, 0, 5, 20), cue(4, 5, 8, 5, 12)],
        john(15, 5),
        40,
      ),
    ).toEqual([
      { start: 0, end: 8, slot: 1 },
      { start: 8, end: 12, slot: 4 },
      { start: 12, end: 20, slot: 1 },
    ])
  })

  it('returns spans in reading order regardless of cue order', () => {
    expect(
      highlightSpans(
        [cue(2, 5, 20, 5, 25), cue(1, 5, 4, 5, 9)],
        john(15, 5),
        40,
      ),
    ).toEqual([
      { start: 4, end: 9, slot: 1 },
      { start: 20, end: 25, slot: 2 },
    ])
  })

  it('has nothing to paint on an empty verse text', () => {
    expect(highlightSpans([cue(1, 5, 0, 5, 10)], john(15, 5), 0)).toEqual([])
  })
})
