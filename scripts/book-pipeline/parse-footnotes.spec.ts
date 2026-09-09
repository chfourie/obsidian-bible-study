import { describe, expect, it } from 'vitest'
import { liftAtomNotes, liftFootnotes } from './parse-footnotes'

const noted = (source: string) => {
  const { offsetOf: _offsetOf, ...channels } = liftFootnotes(source)
  return channels
}

describe('liftFootnotes', () => {
  it('leaves text without a marker alone and emits no channel', () => {
    expect(noted('And the high hills shall be made low,')).toEqual({
      text: 'And the high hills shall be made low,',
    })
  })

  it('lifts the note out of the text, anchored where it stood', () => {
    expect(
      noted('But ye have not been steadfast. [Footnote: So Dillmann.] Ye have turned.'),
    ).toEqual({
      text: 'But ye have not been steadfast. Ye have turned.',
      footnotes: [{ start: 31, text: 'So Dillmann.' }],
    })
  })

  it('reads a numbered marker, the shape Humility’s source writes', () => {
    expect(noted('men may have had times. [Footnote2: ME is exacting.]')).toEqual({
      text: 'men may have had times.',
      footnotes: [{ start: 23, text: 'ME is exacting.' }],
    })
  })

  it('anchors two notes of one atom in the order they stand', () => {
    expect(
      noted('And behold [Footnote: G reads “and lo”.] He cometh. [Footnote: Charles emends.]'),
    ).toEqual({
      text: 'And behold He cometh.',
      footnotes: [
        { start: 10, text: 'G reads “and lo”.' },
        { start: 21, text: 'Charles emends.' },
      ],
    })
  })

  it('says where an offset into the source lands once the notes are gone', () => {
    const { offsetOf } = liftFootnotes('one [Footnote: a note] two')
    expect(offsetOf(0)).toBe(0)
    expect(offsetOf('one [Footnote: a note] '.length)).toBe('one '.length)
  })

  it('refuses a marker the lift did not recognise', () => {
    expect(() => liftFootnotes('And behold [Footnote 3 So Dillmann.]')).toThrow(
      'a `[Footnote` marker the build cannot read',
    )
  })

  it('refuses an Editorial-mark wrapper inside a note', () => {
    expect(() =>
      liftFootnotes('And behold [Footnote: <marks>⌈</marks> is Charles’s.]'),
    ).toThrow('a Footnote carries no Editorial mark')
  })
})

describe('liftAtomNotes', () => {
  it('lifts the notes and strips the wrappers, every offset over the stored string', () => {
    const { offsetOf: _offsetOf, ...atom } = liftAtomNotes(
      '5:4',
      'But ye have not <emended>been steadfast</emended>. [Footnote: So Dillmann.] Ye have turned.',
    )
    expect(atom).toEqual({
      text: 'But ye have not been steadfast. Ye have turned.',
      emended: [{ start: 16, end: 30 }],
      footnotes: [{ start: 31, text: 'So Dillmann.' }],
    })
  })

  it('anchors a note that stands inside a wrapper at the stored offset', () => {
    const { footnotes, marks } = liftAtomNotes(
      '1:2',
      '<marks>⌈⌈</marks>which [Footnote: Charles’s bracket.]<marks>⌉⌉</marks> the angels',
    )
    expect(marks).toEqual([
      { start: 0, end: 2 },
      { start: 7, end: 9 },
    ])
    expect(footnotes).toEqual([{ start: 7, text: 'Charles’s bracket.' }])
  })

  it('carries a source offset through both lifts', () => {
    const { text, offsetOf } = liftAtomNotes(
      '5:6',
      'a <marks>⌈</marks>line [Footnote: note] and another',
    )
    const wrapped = 'a <marks>⌈</marks>line [Footnote: note] '
    expect(text.slice(offsetOf(wrapped.length))).toBe('and another')
  })

  it('cites the atom when a note is malformed', () => {
    expect(() => liftAtomNotes('1:9', 'And behold [Footnote no colon]')).toThrow(
      'atom 1:9: a `[Footnote` marker the build cannot read',
    )
  })
})
