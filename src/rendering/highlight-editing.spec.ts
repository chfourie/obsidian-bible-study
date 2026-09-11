import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { CueLists } from '../highlights'
import { attachHighlightEditing, strokedCues } from './highlight-editing'
import type { Passage, PassageSource } from './module-passage-source'
import { buildReferenceRenderModel } from './reference-render-model'
import { renderReference, type ReferenceRenderDeps } from './render-reference'

const context = {
  knownTranslationIds: ['web', 'nkjv'],
  defaultTranslationId: 'web',
  pageBreaks: true,
}

const passageOf = (...texts: string[]): Passage => ({
  status: 'ok',
  attribution: 'World English Bible',
  verses: texts.map((text, index) => ({
    verseId: 43015004 + index,
    segments: [{ text, redLetter: false }],
  })),
})

const render = async (
  source: string,
  passage: Passage = passageOf('Remain in me'),
) => {
  const write = vi.fn<(cues: CueLists) => void>()
  const passages: PassageSource = { passage: async () => passage }
  const deps: ReferenceRenderDeps = {
    passages,
    openReference: vi.fn(),
    editHighlights: (host, editContext) =>
      attachHighlightEditing(host, editContext, write),
  }
  const model = buildReferenceRenderModel(source, context)
  if (!model) throw new Error(`unparseable: ${source}`)
  const parent = document.body.createDiv()
  await renderReference(parent, model, deps)
  return { parent, write }
}

const verseTextOf = (parent: HTMLElement, index = 0): Text => {
  const holder = parent.querySelectorAll('[data-verse-id]')[index]
  const walker = document.createTreeWalker(holder, NodeFilter.SHOW_TEXT)
  return walker.nextNode() as Text
}

const select = (
  start: { node: Node; offset: number },
  end: { node: Node; offset: number },
): void => {
  const range = document.createRange()
  range.setStart(start.node, start.offset)
  range.setEnd(end.node, end.offset)
  const selection = document.getSelection()
  selection?.removeAllRanges()
  selection?.addRange(range)
  document.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }))
}

const popover = (): HTMLElement | null =>
  document.querySelector('.scripture-study-highlight-popover')

const swatches = (): NodeListOf<HTMLElement> =>
  popover()!.querySelectorAll('.scripture-study-highlight-swatch')

const choose = (index: number): void => {
  swatches()[index].dispatchEvent(new MouseEvent('click', { bubbles: true }))
}

const press = (target: Element, key: string): void => {
  target.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }))
}

const cueAt = (slot: number, startChar: number, endChar: number) => ({
  slot,
  startVerseId: 43015004,
  startChar,
  endVerseId: 43015004,
  endChar,
})

beforeEach(() => {
  document.body.replaceChildren()
  document.getSelection()?.removeAllRanges()
})

describe('attachHighlightEditing popover gating', () => {
  it('offers five highlight slots, five underline slots, an eraser and show only this, in three rows', async () => {
    const { parent } = await render('John 15:4 nkjv inline')

    const verse = verseTextOf(parent)
    select({ node: verse, offset: 0 }, { node: verse, offset: 6 })

    const choices = swatches()
    expect(choices).toHaveLength(12)
    expect(choices[0].classList).toContain('scripture-study-highlight-1')
    expect(choices[5].classList).toContain('scripture-study-underline-swatch-1')
    expect(choices[9].classList).toContain('scripture-study-underline-swatch-5')
    expect(choices[10].classList).toContain('scripture-study-highlight-eraser')
    expect(choices[11].classList).toContain('scripture-study-excerpt-choice')
    expect(choices[11].textContent).toBe('Show only this')
    const rows = popover()!.querySelectorAll('.scripture-study-highlight-popover-row')
    expect(rows).toHaveLength(3)
    expect(rows[0].querySelectorAll('.scripture-study-highlight-swatch')).toHaveLength(5)
    expect(rows[1].lastElementChild).toBe(choices[10])
    expect(rows[2].lastElementChild).toBe(choices[11])
  })

  it('stays away when the selection never touches the verse text', async () => {
    const { parent } = await render('John 15:4 nkjv block')

    const attribution = parent.querySelector('.scripture-study-attribution')!
      .firstChild as Text
    select({ node: attribution, offset: 0 }, { node: attribution, offset: 5 })

    expect(popover()).toBeNull()
  })

  it('stays away for a collapsed selection', async () => {
    const { parent } = await render('John 15:4 nkjv inline')

    const verse = verseTextOf(parent)
    select({ node: verse, offset: 3 }, { node: verse, offset: 3 })

    expect(popover()).toBeNull()
  })

  it('stays away on a fallback-served passage', async () => {
    const { parent } = await render('John 15:4 nkjv inline', {
      ...(passageOf('Remain in me') as Extract<Passage, { status: 'ok' }>),
      fallback: { requested: 'nkjv', served: 'web' },
    })

    const verse = verseTextOf(parent)
    select({ node: verse, offset: 0 }, { node: verse, offset: 6 })

    expect(popover()).toBeNull()
  })

  it('stays away on an unavailable passage', async () => {
    const { parent } = await render('John 15:4 nkjv inline', {
      status: 'unavailable',
    })

    expect(parent.querySelector('[data-verse-id]')).toBeNull()
    document.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }))
    expect(popover()).toBeNull()
  })
})

describe('attachHighlightEditing strokes', () => {
  it('paints the chosen slot over the snapped selection', async () => {
    const { parent, write } = await render('John 15:4 nkjv inline')

    const verse = verseTextOf(parent)
    select({ node: verse, offset: 0 }, { node: verse, offset: 4 })
    choose(1)

    expect(write).toHaveBeenCalledWith({
      highlights: [cueAt(2, 0, 6)],
      underlines: [],
      excerpt: [],
    })
  })

  it('erases the cues the selection covers', async () => {
    const { parent, write } = await render(
      'John 15:4 nkjv inline h3/4.0-4.6',
    )

    const verse = verseTextOf(parent)
    select({ node: verse, offset: 0 }, { node: verse, offset: 6 })
    choose(10)

    expect(write).toHaveBeenCalledWith({
      highlights: [],
      underlines: [],
      excerpt: [],
    })
  })

  it('underlines the snapped selection, leaving a highlight under it intact', async () => {
    const { parent, write } = await render(
      'John 15:4 nkjv inline h3/4.0-4.6',
    )

    const verse = verseTextOf(parent)
    select({ node: verse, offset: 1 }, { node: verse, offset: 4 })
    choose(6)

    expect(write).toHaveBeenCalledWith({
      highlights: [cueAt(3, 0, 6)],
      underlines: [cueAt(2, 0, 6)],
      excerpt: [],
    })
  })

  it('lets a second underline slot claim the overlap and leaves the excerpt as it was', async () => {
    const { parent, write } = await render(
      'John 15:4 nkjv inline u1/4.0-4.12 x/4.0-4.12',
    )

    const verse = verseTextOf(parent)
    select({ node: verse, offset: 7 }, { node: verse, offset: 12 })
    choose(9)

    expect(write).toHaveBeenCalledWith({
      highlights: [],
      underlines: [cueAt(1, 0, 7), cueAt(5, 7, 12)],
      excerpt: [{ startVerseId: 43015004, startChar: 0, endVerseId: 43015004, endChar: 12 }],
    })
  })

  it('erases both channels under the selection in one write', async () => {
    const { parent, write } = await render(
      'John 15:4 nkjv inline h1/4.0-4.12 u2/4.0-4.12',
    )

    const verse = verseTextOf(parent)
    select({ node: verse, offset: 0 }, { node: verse, offset: 6 })
    choose(10)

    expect(write).toHaveBeenCalledTimes(1)
    expect(write).toHaveBeenCalledWith({
      highlights: [cueAt(1, 6, 12)],
      underlines: [cueAt(2, 6, 12)],
      excerpt: [],
    })
  })

  it('clears the selection and closes the popover once a slot is chosen', async () => {
    const { parent } = await render('John 15:4 nkjv inline')

    const verse = verseTextOf(parent)
    select({ node: verse, offset: 0 }, { node: verse, offset: 6 })
    choose(0)

    expect(popover()).toBeNull()
    expect(document.getSelection()?.isCollapsed).toBe(true)
  })

  it('keeps the popover alive while the mouse is released on a swatch', async () => {
    const { parent, write } = await render('John 15:4 nkjv inline')

    const verse = verseTextOf(parent)
    select({ node: verse, offset: 0 }, { node: verse, offset: 6 })
    const swatch = popover()!.querySelector('.scripture-study-highlight-swatch')!
    swatch.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }))
    swatch.dispatchEvent(new MouseEvent('click', { bubbles: true }))

    expect(write).toHaveBeenCalledTimes(1)
  })

  it('clamps a selection that strays past the verse text', async () => {
    const { parent, write } = await render(
      'John 15:4 nkjv block',
      passageOf('Remain in me'),
    )

    const verse = verseTextOf(parent)
    const attribution = parent.querySelector('.scripture-study-attribution')!
      .firstChild as Text
    select({ node: verse, offset: 7 }, { node: attribution, offset: 5 })
    choose(0)

    expect(write).toHaveBeenCalledWith({
      highlights: [cueAt(1, 7, 12)],
      underlines: [],
      excerpt: [],
    })
  })
})

describe('attachHighlightEditing keyboard navigation', () => {
  const open = async () => {
    const { parent, write } = await render('John 15:4 nkjv inline')
    const verse = verseTextOf(parent)
    select({ node: verse, offset: 0 }, { node: verse, offset: 6 })
    return { write, choices: swatches() }
  }

  it('makes only the first choice tabbable', async () => {
    const { choices } = await open()

    expect([...choices].map((choice) => choice.tabIndex)).toEqual([
      0, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1,
    ])
  })

  it('moves focus with the arrow keys across both rows and wraps at the ends', async () => {
    const { choices } = await open()

    choices[0].focus()
    press(choices[0], 'ArrowRight')
    expect(document.activeElement).toBe(choices[1])
    expect(choices[1].tabIndex).toBe(0)
    expect(choices[0].tabIndex).toBe(-1)
    press(choices[1], 'ArrowLeft')
    press(choices[0], 'ArrowLeft')
    expect(document.activeElement).toBe(choices[11])
    press(choices[11], 'ArrowDown')
    expect(document.activeElement).toBe(choices[0])
    press(choices[0], 'ArrowUp')
    expect(document.activeElement).toBe(choices[11])
  })

  it('jumps to the first and last choice with Home and End', async () => {
    const { choices } = await open()

    choices[3].focus()
    press(choices[3], 'End')
    expect(document.activeElement).toBe(choices[11])
    press(choices[11], 'Home')
    expect(document.activeElement).toBe(choices[0])
  })

  it('activates the focused choice with Enter or Space', async () => {
    const { choices, write } = await open()

    choices[0].focus()
    press(choices[0], 'ArrowRight')
    press(choices[1], 'ArrowRight')
    press(choices[2], 'ArrowRight')
    press(choices[3], 'ArrowRight')
    press(choices[4], 'ArrowRight')
    press(choices[5], 'ArrowRight')
    press(document.activeElement!, 'Enter')

    expect(write).toHaveBeenCalledWith({
      highlights: [],
      underlines: [cueAt(2, 0, 6)],
      excerpt: [],
    })
  })

  it('closes on Escape', async () => {
    const { choices } = await open()

    choices[0].focus()
    press(choices[0], 'Escape')

    expect(popover()).toBeNull()
  })
})

describe('attachHighlightEditing show only this', () => {
  const SHOW_ONLY = 11

  const versedPassage = (...verses: [number, string][]): Passage => ({
    status: 'ok',
    attribution: 'World English Bible',
    verses: verses.map(([verseId, text]) => ({
      verseId,
      segments: [{ text, redLetter: false }],
    })),
  })

  const part = (
    startVerseId: number,
    startChar: number,
    endVerseId: number,
    endChar: number,
  ) => ({ startVerseId, startChar, endVerseId, endChar })

  it('creates one excerpt part from the word-snapped selection on a clean passage', async () => {
    const { parent, write } = await render('John 15:4 nkjv inline')

    const verse = verseTextOf(parent)
    select({ node: verse, offset: 0 }, { node: verse, offset: 4 })
    choose(SHOW_ONLY)

    expect(write).toHaveBeenCalledWith({
      highlights: [],
      underlines: [],
      excerpt: [part(43015004, 0, 43015004, 6)],
    })
  })

  it('leaves highlights and underlines untouched', async () => {
    const { parent, write } = await render(
      'John 15:4 nkjv inline h1/4.0-4.12 u2/4.7-4.12',
    )

    const verse = verseTextOf(parent)
    select({ node: verse, offset: 0 }, { node: verse, offset: 6 })
    choose(SHOW_ONLY)

    expect(write).toHaveBeenCalledWith({
      highlights: [cueAt(1, 0, 12)],
      underlines: [cueAt(2, 7, 12)],
      excerpt: [part(43015004, 0, 43015004, 6)],
    })
  })

  it('yields one part per contiguous run when the selection crosses a Verse Gap', async () => {
    const { parent, write } = await render(
      'John 15:4,9 nkjv inline',
      versedPassage([43015004, 'Remain in me'], [43015009, 'Abide here now']),
    )

    const first = verseTextOf(parent, 0)
    const second = verseTextOf(parent, 1)
    select({ node: first, offset: 0 }, { node: second, offset: 14 })
    choose(SHOW_ONLY)

    expect(write).toHaveBeenCalledWith({
      highlights: [],
      underlines: [],
      excerpt: [part(43015004, 0, 43015004, 12), part(43015009, 0, 43015009, 14)],
    })
  })

  it('merges a selection reaching over elided text into one part', async () => {
    const { parent, write } = await render(
      'John 15:4-5 nkjv inline x/4.0-4.6 x/5.0-5.4',
      versedPassage([43015004, 'Remain in me'], [43015005, 'I am the vine']),
    )

    const first = verseTextOf(parent, 0)
    const second = verseTextOf(parent, 1)
    select({ node: first, offset: 0 }, { node: second, offset: 4 })
    choose(SHOW_ONLY)

    expect(write).toHaveBeenCalledWith({
      highlights: [],
      underlines: [],
      excerpt: [part(43015004, 0, 43015005, 4)],
    })
  })

  it('adds a second, non-joining part when the gesture is repeated elsewhere', () => {
    const context = {
      highlights: [],
      underlines: [],
      excerpt: [part(43015004, 0, 43015004, 6)],
      verses: [{ verseId: 43015004, text: 'Remain in me, and I in you' }],
    }

    expect(
      strokedCues(
        context,
        { startVerseId: 43015004, startChar: 18, endVerseId: 43015004, endChar: 26 },
        { kind: 'showOnly' },
      ),
    ).toEqual({
      highlights: [],
      underlines: [],
      excerpt: [part(43015004, 0, 43015004, 6), part(43015004, 18, 43015004, 26)],
    })
  })
})
