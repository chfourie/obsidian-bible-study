import { describe, expect, it } from 'vitest'
import {
  makeVerseId,
  type ExcerptPart,
  type HighlightCue,
  type HighlightSlot,
  type UnderlineCue,
  type UnderlineSlot,
} from '../reference'
import {
  applyExcerptStroke,
  applyHighlightStroke,
  applyUnderlineStroke,
  canonicalChannelCues,
  type ExcerptStroke,
  type HighlightStroke,
  type VerseText,
} from './apply-stroke'

const john = (chapter: number, verse: number) => makeVerseId(43, chapter, verse)

const versesOf = (
  chapter: number,
  firstVerse: number,
  count: number,
  length = 40,
): VerseText[] =>
  Array.from({ length: count }, (_, index) => ({
    verseId: john(chapter, firstVerse + index),
    text: 'x'.repeat(length),
  }))

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

const stroke = (
  slot: HighlightSlot | null,
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
    const empty: VerseText[] = [{ verseId: john(15, 5), text: '' }]
    expect(applyHighlightStroke([], stroke(1, 5, 0, 5, 10), empty)).toEqual([])
  })
})

describe('applyHighlightStroke — text the translation does not serve', () => {
  it('leaves a cue on an unserved verse where the user wrote it', () => {
    expect(
      applyHighlightStroke([cue(1, 20, 0, 20, 5)], stroke(2, 5, 0, 5, 10), passage),
    ).toEqual([cue(2, 5, 0, 5, 10), cue(1, 20, 0, 20, 5)])
  })

  it('keeps offsets that outrun the served text of an untouched cue', () => {
    expect(
      applyHighlightStroke([cue(1, 9, 0, 9, 900)], stroke(2, 5, 0, 5, 10), passage),
    ).toEqual([cue(2, 5, 0, 5, 10), cue(1, 9, 0, 9, 900)])
  })

  it('keeps the part of a cue that covers a gap in the passage', () => {
    const gapped = [...versesOf(15, 4, 3), ...versesOf(15, 9, 1)]
    expect(
      applyHighlightStroke([cue(1, 4, 2, 9, 4)], stroke(null, 4, 0, 6, 40), gapped),
    ).toEqual([cue(1, 6, 40, 9, 4)])
  })
})

describe('canonicalChannelCues — highlights', () => {
  it('sorts cues by verse and start offset', () => {
    expect(
      canonicalChannelCues([cue(2, 9, 20, 9, 25), cue(1, 5, 4, 5, 9)], passage),
    ).toEqual([cue(1, 5, 4, 5, 9), cue(2, 9, 20, 9, 25)])
  })

  it('resolves overlapping cues in favour of the later one', () => {
    expect(
      canonicalChannelCues([cue(1, 5, 0, 5, 10), cue(2, 5, 5, 5, 15)], passage),
    ).toEqual([cue(1, 5, 0, 5, 5), cue(2, 5, 5, 5, 15)])
  })

  it('keeps cues addressing verses outside the passage', () => {
    expect(canonicalChannelCues([cue(1, 20, 0, 20, 5)], passage)).toEqual([
      cue(1, 20, 0, 20, 5),
    ])
  })

  it('keeps a cue spanning a gap in the passage whole', () => {
    const gapped = [...versesOf(15, 4, 3), ...versesOf(15, 9, 1)]
    expect(canonicalChannelCues([cue(1, 4, 2, 9, 4)], gapped)).toEqual([
      cue(1, 4, 2, 9, 4),
    ])
  })
})

const underline = (
  slot: UnderlineSlot,
  startVerse: number,
  startChar: number,
  endVerse: number,
  endChar: number,
): UnderlineCue => ({
  slot,
  startVerseId: john(15, startVerse),
  startChar,
  endVerseId: john(15, endVerse),
  endChar,
})

const part = (
  startVerse: number,
  startChar: number,
  endVerse: number,
  endChar: number,
): ExcerptPart => ({
  startVerseId: john(15, startVerse),
  startChar,
  endVerseId: john(15, endVerse),
  endChar,
})

const excerptStroke = (
  action: ExcerptStroke['action'],
  startVerse: number,
  startChar: number,
  endVerse: number,
  endChar: number,
): ExcerptStroke => ({ action, ...part(startVerse, startChar, endVerse, endChar) })

describe('applyUnderlineStroke — the underline channel', () => {
  it('records a stroke over untouched text', () => {
    expect(applyUnderlineStroke([], stroke(4, 5, 4, 5, 25), passage)).toEqual([
      underline(4, 5, 4, 5, 25),
    ])
  })

  it('lets a second slot claim the overlap of the first', () => {
    expect(
      applyUnderlineStroke(
        [underline(1, 5, 0, 5, 10)],
        stroke(2, 5, 5, 5, 15),
        passage,
      ),
    ).toEqual([underline(1, 5, 0, 5, 5), underline(2, 5, 5, 5, 15)])
  })

  it('merges a same-slot stroke that touches a span', () => {
    expect(
      applyUnderlineStroke(
        [underline(3, 5, 0, 5, 10)],
        stroke(3, 5, 10, 5, 18),
        passage,
      ),
    ).toEqual([underline(3, 5, 0, 5, 18)])
  })

  it('splits a stroke that crosses a gap in the passage', () => {
    const gapped = [...versesOf(15, 4, 3), ...versesOf(15, 9, 1)]
    expect(applyUnderlineStroke([], stroke(1, 4, 2, 9, 4), gapped)).toEqual([
      underline(1, 4, 2, 6, 40),
      underline(1, 9, 0, 9, 4),
    ])
  })

  it('erases the covered part of a span', () => {
    expect(
      applyUnderlineStroke(
        [underline(1, 5, 0, 5, 20)],
        stroke(null, 5, 8, 5, 12),
        passage,
      ),
    ).toEqual([underline(1, 5, 0, 5, 8), underline(1, 5, 12, 5, 20)])
  })

  it('leaves a cue on an unserved verse where the user wrote it', () => {
    expect(
      applyUnderlineStroke(
        [underline(1, 20, 0, 20, 5)],
        stroke(2, 5, 0, 5, 10),
        passage,
      ),
    ).toEqual([underline(2, 5, 0, 5, 10), underline(1, 20, 0, 20, 5)])
  })
})

describe('canonicalChannelCues — underlines', () => {
  it('sorts and resolves overlaps in favour of the later cue', () => {
    expect(
      canonicalChannelCues(
        [underline(2, 9, 20, 9, 25), underline(1, 5, 0, 5, 10), underline(2, 5, 5, 5, 15)],
        passage,
      ),
    ).toEqual([
      underline(1, 5, 0, 5, 5),
      underline(2, 5, 5, 5, 15),
      underline(2, 9, 20, 9, 25),
    ])
  })
})

describe('applyExcerptStroke — the excerpt channel', () => {
  it('shows a part over a passage with no excerpt', () => {
    expect(applyExcerptStroke([], excerptStroke('show', 5, 4, 5, 25), passage)).toEqual([
      part(5, 4, 5, 25),
    ])
  })

  it('keeps a second non-joining part beside the first', () => {
    expect(
      applyExcerptStroke([part(5, 0, 5, 10)], excerptStroke('show', 5, 20, 5, 30), passage),
    ).toEqual([part(5, 0, 5, 10), part(5, 20, 5, 30)])
  })

  it('merges a part the shown selection touches or overlaps', () => {
    expect(
      applyExcerptStroke([part(5, 0, 5, 10)], excerptStroke('show', 5, 10, 5, 18), passage),
    ).toEqual([part(5, 0, 5, 18)])
    expect(
      applyExcerptStroke([part(5, 0, 5, 10)], excerptStroke('show', 5, 6, 5, 18), passage),
    ).toEqual([part(5, 0, 5, 18)])
  })

  it('splits a shown selection at a gap in the passage', () => {
    const gapped = [...versesOf(15, 4, 3), ...versesOf(15, 9, 1)]
    expect(applyExcerptStroke([], excerptStroke('show', 4, 2, 9, 4), gapped)).toEqual([
      part(4, 2, 6, 40),
      part(9, 0, 9, 4),
    ])
  })

  it('hides the middle of a part, splitting it', () => {
    expect(
      applyExcerptStroke([part(5, 0, 5, 20)], excerptStroke('hide', 5, 8, 5, 12), passage),
    ).toEqual([part(5, 0, 5, 8), part(5, 12, 5, 20)])
  })

  it('hides a part entirely', () => {
    expect(
      applyExcerptStroke([part(5, 8, 5, 12)], excerptStroke('hide', 5, 0, 5, 20), passage),
    ).toEqual([])
  })

  it('leaves a part on an unserved verse where the user wrote it', () => {
    expect(
      applyExcerptStroke([part(20, 0, 20, 5)], excerptStroke('show', 5, 0, 5, 10), passage),
    ).toEqual([part(5, 0, 5, 10), part(20, 0, 20, 5)])
  })
})

describe('canonicalChannelCues — the excerpt channel on its one slot', () => {
  const kept = (excerptPart: ExcerptPart) => ({ ...excerptPart, slot: 1 })

  it('sorts and merges parts that touch or overlap', () => {
    expect(
      canonicalChannelCues(
        [part(9, 20, 9, 25), part(5, 5, 5, 15), part(5, 0, 5, 10)].map(kept),
        passage,
      ),
    ).toEqual([part(5, 0, 5, 15), part(9, 20, 9, 25)].map(kept))
  })
})
