import { describe, expect, it } from 'vitest'
import { makeVerseId, type HighlightCue } from '../reference'
import {
  applyHighlightStroke,
  canonicalHighlightCues,
  type HighlightStroke,
  type PassageVerse,
} from './apply-stroke'

const john = (chapter: number, verse: number) => makeVerseId(43, chapter, verse)

const versesOf = (
  chapter: number,
  firstVerse: number,
  count: number,
  length = 40,
): PassageVerse[] =>
  Array.from({ length: count }, (_, index) => ({
    verseId: john(chapter, firstVerse + index),
    text: 'x'.repeat(length),
  }))

const cue = (
  slot: number,
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

const stroke = (
  slot: number | null,
  startVerse: number,
  startChar: number,
  endVerse: number,
  endChar: number,
): HighlightStroke => ({
  slot,
  startVerseId: john(15, startVerse),
  startChar,
  endVerseId: john(15, endVerse),
  endChar,
})

const passage = versesOf(15, 1, 16)

describe('applyHighlightStroke — painting', () => {
  it('records a stroke over untouched text', () => {
    expect(applyHighlightStroke([], stroke(1, 5, 4, 5, 25), passage)).toEqual([
      cue(1, 5, 4, 5, 25),
    ])
  })

  it('lets a new slot claim the overlap of an older span', () => {
    expect(
      applyHighlightStroke([cue(1, 5, 0, 5, 10)], stroke(2, 5, 5, 5, 15), passage),
    ).toEqual([cue(1, 5, 0, 5, 5), cue(2, 5, 5, 5, 15)])
  })

  it('splits an older span the stroke lands inside', () => {
    expect(
      applyHighlightStroke([cue(1, 5, 0, 5, 20)], stroke(4, 5, 8, 5, 12), passage),
    ).toEqual([cue(1, 5, 0, 5, 8), cue(4, 5, 8, 5, 12), cue(1, 5, 12, 5, 20)])
  })

  it('swallows an older span the stroke covers entirely', () => {
    expect(
      applyHighlightStroke([cue(1, 5, 8, 5, 12)], stroke(3, 5, 0, 5, 20), passage),
    ).toEqual([cue(3, 5, 0, 5, 20)])
  })

  it('merges a same-slot stroke with an overlapping span', () => {
    expect(
      applyHighlightStroke([cue(3, 5, 0, 5, 10)], stroke(3, 5, 6, 5, 18), passage),
    ).toEqual([cue(3, 5, 0, 5, 18)])
  })

  it('merges a same-slot stroke that only touches a span', () => {
    expect(
      applyHighlightStroke([cue(3, 5, 0, 5, 10)], stroke(3, 5, 10, 5, 18), passage),
    ).toEqual([cue(3, 5, 0, 5, 18)])
  })

  it('leaves a gap between same-slot spans that do not touch', () => {
    expect(
      applyHighlightStroke([cue(3, 5, 0, 5, 10)], stroke(3, 5, 12, 5, 18), passage),
    ).toEqual([cue(3, 5, 0, 5, 10), cue(3, 5, 12, 5, 18)])
  })

  it('joins a stroke running across whole verses into one cue', () => {
    expect(applyHighlightStroke([], stroke(2, 7, 6, 9, 12), passage)).toEqual([
      cue(2, 7, 6, 9, 12),
    ])
  })

  it('keeps distinct slots separate across a verse boundary', () => {
    expect(
      applyHighlightStroke([cue(1, 7, 6, 8, 40)], stroke(2, 9, 0, 9, 12), passage),
    ).toEqual([cue(1, 7, 6, 8, 40), cue(2, 9, 0, 9, 12)])
  })

  it('merges same-slot spans that meet on a verse boundary', () => {
    expect(
      applyHighlightStroke([cue(1, 7, 6, 8, 40)], stroke(1, 9, 0, 9, 12), passage),
    ).toEqual([cue(1, 7, 6, 9, 12)])
  })
})

describe('applyHighlightStroke — erasing', () => {
  it('removes the covered part of a span', () => {
    expect(
      applyHighlightStroke([cue(1, 5, 0, 5, 20)], stroke(null, 5, 10, 5, 30), passage),
    ).toEqual([cue(1, 5, 0, 5, 10)])
  })

  it('splits a span it erases the middle of', () => {
    expect(
      applyHighlightStroke([cue(1, 5, 0, 5, 20)], stroke(null, 5, 8, 5, 12), passage),
    ).toEqual([cue(1, 5, 0, 5, 8), cue(1, 5, 12, 5, 20)])
  })

  it('drops a span it covers entirely', () => {
    expect(
      applyHighlightStroke([cue(1, 5, 4, 5, 20)], stroke(null, 5, 0, 5, 40), passage),
    ).toEqual([])
  })

  it('erases across verses without touching untouched verses', () => {
    expect(
      applyHighlightStroke(
        [cue(1, 7, 0, 9, 40)],
        stroke(null, 8, 0, 8, 40),
        passage,
      ),
    ).toEqual([cue(1, 7, 0, 7, 40), cue(1, 9, 0, 9, 40)])
  })
})

describe('applyHighlightStroke — passage bounds', () => {
  it('clamps a stroke running past the stored verse text', () => {
    expect(applyHighlightStroke([], stroke(1, 5, 4, 5, 900), passage)).toEqual([
      cue(1, 5, 4, 5, 40),
    ])
  })

  it('ignores a stroke on a verse outside the passage', () => {
    expect(applyHighlightStroke([], stroke(1, 20, 0, 20, 5), passage)).toEqual([])
  })

  it('splits a stroke that crosses a gap in the passage', () => {
    const gapped = [...versesOf(15, 4, 3), ...versesOf(15, 9, 1)]
    expect(applyHighlightStroke([], stroke(1, 4, 2, 9, 4), gapped)).toEqual([
      cue(1, 4, 2, 6, 40),
      cue(1, 9, 0, 9, 4),
    ])
  })

  it('has nothing to paint on an empty verse text', () => {
    const empty: PassageVerse[] = [{ verseId: john(15, 5), text: '' }]
    expect(applyHighlightStroke([], stroke(1, 5, 0, 5, 10), empty)).toEqual([])
  })
})

describe('canonicalHighlightCues', () => {
  it('sorts cues by verse and start offset', () => {
    expect(
      canonicalHighlightCues([cue(2, 9, 20, 9, 25), cue(1, 5, 4, 5, 9)], passage),
    ).toEqual([cue(1, 5, 4, 5, 9), cue(2, 9, 20, 9, 25)])
  })

  it('resolves overlapping cues in favour of the later one', () => {
    expect(
      canonicalHighlightCues([cue(1, 5, 0, 5, 10), cue(2, 5, 5, 5, 15)], passage),
    ).toEqual([cue(1, 5, 0, 5, 5), cue(2, 5, 5, 5, 15)])
  })

  it('drops cues addressing verses outside the passage', () => {
    expect(canonicalHighlightCues([cue(1, 20, 0, 20, 5)], passage)).toEqual([])
  })

  it('splits a cue spanning a gap in the passage', () => {
    const gapped = [...versesOf(15, 4, 3), ...versesOf(15, 9, 1)]
    expect(canonicalHighlightCues([cue(1, 4, 2, 9, 4)], gapped)).toEqual([
      cue(1, 4, 2, 6, 40),
      cue(1, 9, 0, 9, 4),
    ])
  })
})
