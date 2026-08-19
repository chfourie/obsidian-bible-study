import { describe, expect, it } from 'vitest'
import { passageSelectionRange } from './passage-selection'

type Part = string | HTMLElement

const element = <K extends keyof HTMLElementTagNameMap>(
  tag: K,
  cls: string | null,
  parts: Part[],
): HTMLElementTagNameMap[K] => {
  const created = document.createElement(tag)
  if (cls !== null) created.className = cls
  created.append(...parts)
  return created
}

const host = (...parts: Part[]): HTMLElement => element('div', null, parts)

const verse = (verseId: number, ...parts: Part[]): HTMLElement => {
  const holder = element('span', null, parts)
  holder.dataset.verseId = String(verseId)
  return holder
}

const chip = (text: string): HTMLElement => element('span', 'chip', [text])

const attribution = (text: string): HTMLElement =>
  element('div', 'attribution', [text])

const number = (label: string): HTMLElement => element('sup', null, [label])

const rangeOver = (
  start: { node: Node; offset: number },
  end: { node: Node; offset: number },
): Range => {
  const range = document.createRange()
  range.setStart(start.node, start.offset)
  range.setEnd(end.node, end.offset)
  return range
}

const textOf = (node: Node): Text => node.firstChild as Text

describe('passageSelectionRange', () => {
  it('maps a selection inside one verse to its character offsets', () => {
    const passage = host(verse(43015004, 'Remain in me'))
    const text = textOf(passage.querySelector('[data-verse-id]')!)

    expect(
      passageSelectionRange(
        passage,
        rangeOver({ node: text, offset: 7 }, { node: text, offset: 9 }),
      ),
    ).toEqual({
      startVerseId: 43015004,
      startChar: 7,
      endVerseId: 43015004,
      endChar: 9,
    })
  })

  it('counts characters across the segments a verse is split into', () => {
    const first = element('span', null, ['Remain '])
    const second = element('span', null, ['in me'])
    const passage = host(verse(43015004, first, second))

    expect(
      passageSelectionRange(
        passage,
        rangeOver(
          { node: textOf(first), offset: 0 },
          { node: textOf(second), offset: 2 },
        ),
      ),
    ).toEqual({
      startVerseId: 43015004,
      startChar: 0,
      endVerseId: 43015004,
      endChar: 9,
    })
  })

  it('spans verses when the selection crosses them', () => {
    const fourth = verse(43015004, 'Remain in me')
    const fifth = verse(43015005, 'I am the vine')
    const passage = host(number('4'), fourth, ' ', number('5'), fifth)

    expect(
      passageSelectionRange(
        passage,
        rangeOver(
          { node: textOf(fourth), offset: 7 },
          { node: textOf(fifth), offset: 4 },
        ),
      ),
    ).toEqual({
      startVerseId: 43015004,
      startChar: 7,
      endVerseId: 43015005,
      endChar: 4,
    })
  })

  it('clamps a selection that strays outside the verse text', () => {
    const reference = chip('John 15:4')
    const credit = attribution('World English Bible')
    const passage = host(
      reference,
      number('4'),
      verse(43015004, 'Remain in me'),
      credit,
    )

    expect(
      passageSelectionRange(
        passage,
        rangeOver(
          { node: textOf(reference), offset: 2 },
          { node: textOf(credit), offset: 3 },
        ),
      ),
    ).toEqual({
      startVerseId: 43015004,
      startChar: 0,
      endVerseId: 43015004,
      endChar: 12,
    })
  })

  it('ignores a selection that never touches verse text', () => {
    const reference = chip('John 15:4')
    const passage = host(reference, verse(43015004, 'Remain in me'))

    expect(
      passageSelectionRange(
        passage,
        rangeOver(
          { node: textOf(reference), offset: 0 },
          { node: textOf(reference), offset: 4 },
        ),
      ),
    ).toBeNull()
  })

  it('ignores a collapsed selection', () => {
    const passage = host(verse(43015004, 'Remain in me'))
    const text = textOf(passage.querySelector('[data-verse-id]')!)

    expect(
      passageSelectionRange(
        passage,
        rangeOver({ node: text, offset: 3 }, { node: text, offset: 3 }),
      ),
    ).toBeNull()
  })
})
