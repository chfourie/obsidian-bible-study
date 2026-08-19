import { describe, expect, it } from 'vitest'
import { makeVerseId } from '../reference'
import type { PassageVerse } from './apply-stroke'
import { highlightSelectionRange } from './selection-range'

const john = (chapter: number, verse: number) => makeVerseId(43, chapter, verse)

const verse = (number: number, text: string): PassageVerse => ({
  verseId: john(15, number),
  text,
})

const abide = verse(4, 'Abide in Me, and I in you.')
const branch = verse(5, 'I am the vine, you are the branches.')

const selection = (
  startVerse: number,
  startChar: number,
  endVerse: number,
  endChar: number,
) => ({
  startVerseId: john(15, startVerse),
  startChar,
  endVerseId: john(15, endVerse),
  endChar,
})

const range = (
  startVerse: number,
  startChar: number,
  endVerse: number,
  endChar: number,
) => selection(startVerse, startChar, endVerse, endChar)

describe('highlightSelectionRange — word snapping', () => {
  const verses = [abide, branch]

  it('snaps a selection starting mid-word back to the word start', () => {
    expect(highlightSelectionRange(selection(4, 2, 4, 5), verses)).toEqual(
      range(4, 0, 4, 5),
    )
  })

  it('snaps a selection ending mid-word out to the word end', () => {
    expect(highlightSelectionRange(selection(4, 0, 4, 3), verses)).toEqual(
      range(4, 0, 4, 5),
    )
  })

  it('leaves a selection that already sits on word boundaries', () => {
    expect(highlightSelectionRange(selection(4, 0, 4, 5), verses)).toEqual(
      range(4, 0, 4, 5),
    )
  })

  it('does not reach past punctuation when snapping', () => {
    expect(highlightSelectionRange(selection(4, 10, 4, 11), verses)).toEqual(
      range(4, 9, 4, 11),
    )
  })

  it('snaps both ends of a multi-verse selection', () => {
    expect(highlightSelectionRange(selection(4, 7, 5, 10), verses)).toEqual(
      range(4, 6, 5, 13),
    )
  })
})

describe('highlightSelectionRange — non-spaced scripts', () => {
  const chinese = [verse(4, '我就是真葡萄树')]
  const thai = [verse(4, 'เราเป็นเถาองุ่นแท้')]

  it('stores a Chinese selection exactly as selected', () => {
    expect(highlightSelectionRange(selection(4, 2, 4, 4), chinese)).toEqual(
      range(4, 2, 4, 4),
    )
  })

  it('stores a Thai selection exactly as selected', () => {
    expect(highlightSelectionRange(selection(4, 3, 4, 7), thai)).toEqual(
      range(4, 3, 4, 7),
    )
  })
})

describe('highlightSelectionRange — clamping', () => {
  const verses = [abide, branch]

  it('clamps offsets past the stored verse text', () => {
    expect(highlightSelectionRange(selection(5, 0, 5, 900), verses)).toEqual(
      range(5, 0, 5, branch.text.length),
    )
  })

  it('pulls a start before the passage to its first verse', () => {
    expect(highlightSelectionRange(selection(1, 4, 4, 5), verses)).toEqual(
      range(4, 0, 4, 5),
    )
  })

  it('pulls an end past the passage to its last verse', () => {
    expect(highlightSelectionRange(selection(4, 0, 9, 3), verses)).toEqual(
      range(4, 0, 5, branch.text.length),
    )
  })

  it('skips over verses missing from the passage', () => {
    const gapped = [abide, verse(9, 'These things I command you')]
    expect(highlightSelectionRange(selection(5, 2, 8, 4), gapped)).toBe(null)
  })

  it('rejects a selection entirely outside the passage', () => {
    expect(highlightSelectionRange(selection(20, 0, 20, 5), verses)).toBe(null)
  })

  it('rejects a collapsed selection', () => {
    expect(highlightSelectionRange(selection(4, 5, 4, 5), verses)).toBe(null)
  })

  it('keeps a whitespace-only selection exactly as selected', () => {
    expect(highlightSelectionRange(selection(4, 5, 4, 6), verses)).toEqual(
      range(4, 5, 4, 6),
    )
  })
})
