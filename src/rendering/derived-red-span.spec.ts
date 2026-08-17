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

  it('starts red at the first double quote when speech opens mid-verse', () => {
    const text = 'Jesus said, “Follow Me.”'

    expect(derivedRedSpan(text, partial(false, true))).toEqual({
      start: 12,
      end: text.length,
    })
  })

  it('ends red after the last double quote when speech closes mid-verse', () => {
    expect(
      derivedRedSpan('“Let it be so now,” Jesus replied.', partial(true, false)),
    ).toEqual({ start: 0, end: 19 })
  })

  it('spans first to last quote mark when red touches neither edge', () => {
    expect(
      derivedRedSpan('He said, “Go,” and left.', partial(false, false)),
    ).toEqual({ start: 9, end: 14 })
  })

  it('ignores the cue flags when the translation reorders clauses', () => {
    const text =
      'But Jesus answered and said to him, “Permit it to be so now, for thus it is fitting for us to fulfill all righteousness.” Then he allowed Him.'

    expect(derivedRedSpan(text, partial(true, false))).toEqual({
      start: text.indexOf('“'),
      end: text.indexOf('”') + 1,
    })
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

  it('anchors on spaced French guillemets', () => {
    const text = 'Il dit : « Va. »'

    expect(derivedRedSpan(text, partial(false, true))).toEqual({
      start: 9,
      end: text.length,
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

  it('covers the whole verse on a lone quote mark', () => {
    const text = 'He said, “Go and see him.'

    expect(derivedRedSpan(text, partial(false, false))).toEqual({
      start: 0,
      end: text.length,
    })
  })

  it('runs red from a lone opening quote to the verse end when red touches only the end', () => {
    const text =
      'These twelve Jesus sent out with the following instructions: “Do not go onto the road of the Gentiles'

    expect(derivedRedSpan(text, partial(false, true))).toEqual({
      start: text.indexOf('“'),
      end: text.length,
    })
  })

  it('runs red from the verse start through a lone closing quote when red touches only the start', () => {
    const text = 'and on the third day be raised to life.” Then Peter replied.'

    expect(derivedRedSpan(text, partial(true, false))).toEqual({
      start: 0,
      end: text.indexOf('”') + 1,
    })
  })

  it('covers the whole verse on a lone quote mark when red touches both edges', () => {
    const text = '“Away from Me! For it is written, he said.'

    expect(derivedRedSpan(text, partial(true, true))).toEqual({
      start: 0,
      end: text.length,
    })
  })

  it('starts red at a lone closing quote when red touches only the end', () => {
    const text = '…the prophet.” Then Jesus said, Go.'

    expect(derivedRedSpan(text, partial(false, true))).toEqual({
      start: 13,
      end: text.length,
    })
  })

  it('keeps narration between two quoted speeches red', () => {
    const text = '“Away from Me!” he told him. “For it is written.”'

    expect(derivedRedSpan(text, partial(true, true))).toEqual({
      start: 0,
      end: text.length,
    })
  })

  it('starts red at a carried-over closing quote', () => {
    const text = '…the prophet.” Then Jesus said, “Go.”'

    expect(derivedRedSpan(text, partial(false, true))).toEqual({
      start: 13,
      end: text.length,
    })
  })

  it('ends red after a trailing opening quote', () => {
    const text = '“Go,” he said, adding, “'

    expect(derivedRedSpan(text, partial(true, false))).toEqual({
      start: 0,
      end: text.length,
    })
  })
})
