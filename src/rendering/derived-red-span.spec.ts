import { describe, expect, it } from 'vitest'
import type { RedLetterCue } from '../reference'
import { derivedRedSpan } from './derived-red-span'

const partial = (redAtStart: boolean, redAtEnd: boolean): RedLetterCue => ({
  kind: 'partial',
  redAtStart,
  redAtEnd,
})

describe('derivedRedSpan', () => {
  it('derives nothing for an uncued verse', () => {
    expect(derivedRedSpan('Jesus wept.', { kind: 'none' })).toBeNull()
  })

  it('covers the whole verse for a full cue', () => {
    expect(derivedRedSpan('Follow Me.', { kind: 'full' })).toEqual({
      start: 0,
      end: 10,
    })
  })

  it('anchors a red start to the first double quote when red opens mid-verse', () => {
    const text = 'Jesus said, “Follow Me.”'

    expect(derivedRedSpan(text, partial(false, true))).toEqual({
      start: 12,
      end: text.length,
    })
  })

  it('anchors a red end to the last double quote when red closes mid-verse', () => {
    expect(
      derivedRedSpan('“Let it be so now,” Jesus replied.', partial(true, false)),
    ).toEqual({ start: 0, end: 19 })
  })

  it('spans first opening to last closing quote when red touches neither edge', () => {
    expect(
      derivedRedSpan('He said, “Go,” and left.', partial(false, false)),
    ).toEqual({ start: 9, end: 14 })
  })

  it('ignores nested single quotes inside the speech', () => {
    expect(
      derivedRedSpan('“Take ‘this’ cup,” he said.', partial(true, false)),
    ).toEqual({ start: 0, end: 18 })
  })

  it('anchors on straight double quotes', () => {
    expect(derivedRedSpan('He said, "Go."', partial(false, true))).toEqual({
      start: 9,
      end: 14,
    })
  })

  it('anchors on guillemets', () => {
    expect(derivedRedSpan('Il dit, «Va.»', partial(false, false))).toEqual({
      start: 8,
      end: 13,
    })
  })

  it('anchors on low-nine German quotes', () => {
    expect(derivedRedSpan('Er sagte: „Komm.“', partial(false, true))).toEqual({
      start: 10,
      end: 17,
    })
  })

  it('covers the whole verse when the text prints no double quotes', () => {
    expect(
      derivedRedSpan('But Jesus answered, It is written.', partial(false, true)),
    ).toEqual({ start: 0, end: 34 })
  })

  it('covers the whole verse when only single quotes appear', () => {
    expect(
      derivedRedSpan("Jesus said, 'It is written.'", partial(false, true)),
    ).toEqual({ start: 0, end: 28 })
  })

  it('covers the whole verse when both anchors would collide on a lone quote mark', () => {
    const text = 'He said, “Go and see him.'

    expect(derivedRedSpan(text, partial(false, false))).toEqual({
      start: 0,
      end: text.length,
    })
  })

  it('covers the whole verse when red touches both edges around a plain middle', () => {
    const text = '“Away from Me!” he told him. “For it is written.”'

    expect(derivedRedSpan(text, partial(true, true))).toEqual({
      start: 0,
      end: text.length,
    })
  })

  it('skips a carried-over closing quote when seeking the red start', () => {
    const text = '…the prophet.” Then Jesus said, “Go.”'

    expect(derivedRedSpan(text, partial(false, true))).toEqual({
      start: 32,
      end: text.length,
    })
  })

  it('skips a trailing opening quote when seeking the red end', () => {
    expect(
      derivedRedSpan('“Go,” he said, adding, “', partial(true, false)),
    ).toEqual({ start: 0, end: 5 })
  })

  it('skips a carried-over German closing quote at the verse start', () => {
    const text = 'Propheten.“ Jesus sagte: „Komm.“'

    expect(derivedRedSpan(text, partial(false, true))).toEqual({
      start: 25,
      end: text.length,
    })
  })

  it('covers the whole verse when no opening-shaped mark exists for a red start', () => {
    const text = '…the prophet.” Then Jesus said, Go.'

    expect(derivedRedSpan(text, partial(false, true))).toEqual({
      start: 0,
      end: text.length,
    })
  })

  it('anchors a spaced French opening guillemet by its leading whitespace', () => {
    const text = 'Il dit : « Va. »'

    expect(derivedRedSpan(text, partial(false, true))).toEqual({
      start: 9,
      end: text.length,
    })
  })

  it('anchors at position zero when the verse text starts with a quote mark', () => {
    const text = '“Go,” he said. “Come.”'

    expect(derivedRedSpan(text, partial(false, false))).toEqual({
      start: 0,
      end: text.length,
    })
  })
})
