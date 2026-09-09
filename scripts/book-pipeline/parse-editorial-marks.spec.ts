import { describe, expect, it } from 'vitest'
import {
  assertNoEditorialMarks,
  stripEditorialMarks,
} from './parse-editorial-marks'

const channelsOf = (wrapped: string) => {
  const { offsetOf: _offsetOf, ...channels } = stripEditorialMarks(wrapped)
  return channels
}

describe('stripEditorialMarks', () => {
  it('leaves unmarked text alone and emits no channel for it', () => {
    expect(channelsOf('And the high hills shall be made low,')).toEqual({
      text: 'And the high hills shall be made low,',
    })
  })

  it('drops a supplied wrapper and identifies the words it held', () => {
    expect(
      channelsOf('tread upon the earth, <supplied>even</supplied> on Mount Sinai,'),
    ).toEqual({
      text: 'tread upon the earth, even on Mount Sinai,',
      supplied: [{ start: 22, end: 26 }],
    })
  })

  it('keeps a mark glyph in the text with one span per wrapper', () => {
    expect(
      channelsOf('<marks>⌈⌈</marks>which<marks>⌉⌉</marks> the angels'),
    ).toEqual({
      text: '⌈⌈which⌉⌉ the angels',
      marks: [
        { start: 0, end: 2 },
        { start: 7, end: 9 },
      ],
    })
  })

  it('identifies emended words as plain text with an emended span', () => {
    expect(
      channelsOf(
        '<marks>⌈</marks>how <emended>steadfast</emended> they are<marks>⌉</marks>',
      ),
    ).toEqual({
      text: '⌈how steadfast they are⌉',
      marks: [
        { start: 0, end: 1 },
        { start: 23, end: 24 },
      ],
      emended: [{ start: 5, end: 14 }],
    })
  })

  it('nests a supplied word inside an interpolation and an emended word inside a wrapper', () => {
    expect(
      channelsOf(
        '<marks>[</marks>And <supplied>appear</supplied> from His camp<marks>]</marks> ' +
          '<emended>a <supplied>b</supplied></emended>',
      ),
    ).toEqual({
      text: '[And appear from His camp] a b',
      supplied: [
        { start: 5, end: 11 },
        { start: 29, end: 30 },
      ],
      marks: [
        { start: 0, end: 1 },
        { start: 25, end: 26 },
      ],
      emended: [{ start: 27, end: 30 }],
    })
  })

  it('maps an offset into the wrapped text onto the stored string', () => {
    const { offsetOf } = stripEditorialMarks(
      'a <marks>⌈</marks>b<marks>⌉</marks> c',
    )
    expect(offsetOf(0)).toBe(0)
    expect(offsetOf(2)).toBe(2)
    expect(offsetOf('a <marks>⌈</marks>'.length)).toBe(3)
    expect(offsetOf('a <marks>⌈</marks>b<marks>⌉</marks> '.length)).toBe(6)
  })

  it.each([
    ['<marks>⌈<emended>how⌉</marks> steadfast</emended>', /<\/marks> closes <emended>.*nest, never overlap/],
    ['a <mark>x</mark>', /<mark> is not one of <supplied>, <marks>, <emended>/],
    ['a <Marks>x</Marks>', /<Marks> is not one of/],
    ['a <marks class="x">⌈</marks>', /<marks class="x"> is not one of/],
    ['a <marks></marks> b', /empty <marks><\/marks>/],
    ['a <supplied> </supplied> b', /empty <supplied><\/supplied>/],
    ['a < b', /raw `<`/],
    ['a <marks>⌈ b', /<marks> is never closed/],
    ['a ⌈</marks> b', /<\/marks> closes nothing/],
  ])('fails on %s', (text, message) => {
    expect(() => stripEditorialMarks(text)).toThrow(message)
  })
})

describe('assertNoEditorialMarks', () => {
  it('lets furniture without a `<` through', () => {
    expect(() => assertNoEditorialMarks('heading', 'I-V. Parable of Enoch')).not.toThrow()
  })

  it('fails, citing the furniture, on a wrapper or a raw `<`', () => {
    expect(() =>
      assertNoEditorialMarks('heading', 'The <marks>⌈</marks>Watchers'),
    ).toThrow(/heading "The <marks>⌈<\/marks>Watchers": furniture never carries an Editorial mark/)
    expect(() => assertNoEditorialMarks('figure caption', 'a < b')).toThrow(
      /figure caption "a < b"/,
    )
  })
})
