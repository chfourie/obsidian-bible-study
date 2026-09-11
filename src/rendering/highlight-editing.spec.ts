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
    editHighlights: (host, editContext, surface) =>
      attachHighlightEditing(host, editContext, write, { surface }),
  }
  const model = buildReferenceRenderModel(source, context)
  if (!model) throw new Error(`unparseable: ${source}`)
  const parent = document.body.createDiv()
  await renderReference(parent, model, deps)
  return { parent, write, deps }
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

describe('Passage Editing', () => {
  const SHOW = 11
  const IN_MODE = { passageEditing: true }
  const HIDE = 12
  const CONTROL = '.scripture-study-passage-edit'
  const TOOLBAR = '.scripture-study-passage-editing-toolbar'
  const ELIDED = '.scripture-study-elided'
  const ELLIPSIS = '.scripture-study-passage-ellipsis'

  const controlOf = (parent: HTMLElement): HTMLElement | null =>
    parent.querySelector<HTMLElement>(CONTROL)

  const toolbarOf = (parent: HTMLElement): HTMLElement | null =>
    parent.querySelector<HTMLElement>(TOOLBAR)

  const click = (target: Element): void => {
    target.dispatchEvent(new MouseEvent('click', { bubbles: true }))
  }

  const pointerDown = (target: Node): void => {
    target.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true }))
  }

  const enter = (parent: HTMLElement): void => {
    const control = controlOf(parent)
    if (control === null) throw new Error('no passage editing control')
    click(control)
  }

  const toolbarButton = (parent: HTMLElement, label: string): HTMLElement => {
    const button = [...toolbarOf(parent)!.querySelectorAll<HTMLElement>('[role=button]')]
      .find((candidate) => candidate.textContent === label)
    if (button === undefined) throw new Error(`no ${label} in the toolbar`)
    return button
  }

  const part = (
    startVerseId: number,
    startChar: number,
    endVerseId: number,
    endChar: number,
  ) => ({ startVerseId, startChar, endVerseId, endChar })

  const twoVerses = (): Passage => ({
    status: 'ok',
    attribution: 'World English Bible',
    verses: [
      { verseId: 43015004, segments: [{ text: 'Remain in me', redLetter: false }] },
      { verseId: 43015005, segments: [{ text: 'I am the vine', redLetter: false }] },
    ],
  })

  describe('hover control', () => {
    it('stands at the chip’s end of an editable inline passage and a block one', async () => {
      const inline = await render('John 15:4 nkjv inline')
      const block = await render('John 15:4 nkjv block')

      for (const { parent } of [inline, block]) {
        const control = controlOf(parent)
        expect(control).not.toBeNull()
        expect(control!.closest('.scripture-study-chip')).not.toBeNull()
        expect(control!.parentElement!.lastElementChild).toBe(control)
        expect(control!.getAttribute('aria-label')).toBe('Edit passage')
      }
    })

    it('is absent on a bare chip', async () => {
      const { parent } = await render('John 15:4 nkjv')

      expect(controlOf(parent)).toBeNull()
    })

    it('is absent on a fallback-served passage', async () => {
      const { parent } = await render('John 15:4 nkjv inline', {
        ...(passageOf('Remain in me') as Extract<Passage, { status: 'ok' }>),
        fallback: { requested: 'nkjv', served: 'web' },
      })

      expect(controlOf(parent)).toBeNull()
    })

    it('is absent on a passage over the display cap', async () => {
      const { parent } = await render('John 1-21 nkjv block')

      expect(parent.textContent).toContain('Reference too long to display')
      expect(controlOf(parent)).toBeNull()
    })

    it('is absent on an unavailable passage', async () => {
      const { parent } = await render('John 15:4 nkjv inline', {
        status: 'unavailable',
      })

      expect(controlOf(parent)).toBeNull()
    })

    it('enters the mode without opening the reader', async () => {
      const { parent, deps } = await render('John 15:4 nkjv inline')

      enter(parent)

      expect(deps.openReference).not.toHaveBeenCalled()
      expect(controlOf(parent)!.getAttribute('aria-pressed')).toBe('true')
      expect(toolbarOf(parent)).not.toBeNull()
    })

    it('enters the mode from the keyboard, the chip staying closed', async () => {
      const { parent, deps } = await render('John 15:4 nkjv inline')

      press(controlOf(parent)!, 'Enter')

      expect(deps.openReference).not.toHaveBeenCalled()
      expect(toolbarOf(parent)).not.toBeNull()
    })
  })

  describe('the whole passage, elided text faded', () => {
    it('shows the elided text faded with no ellipsis while in the mode', async () => {
      const { parent } = await render('John 15:4 nkjv inline x/4.7-4.9')
      expect(parent.querySelectorAll(ELLIPSIS)).toHaveLength(2)

      enter(parent)

      const passage = parent.querySelector('.scripture-study-passage')!
      expect(passage.querySelectorAll(ELLIPSIS)).toHaveLength(0)
      expect(
        [...passage.querySelectorAll(ELIDED)].map((span) => span.textContent),
      ).toEqual(['Remain ', ' me'])
      expect(passage.querySelector('[data-verse-id]')!.textContent).toBe('Remain in me')
    })

    it('renders cut to its kept parts again after Done', async () => {
      const { parent } = await render('John 15:4 nkjv inline x/4.7-4.9')

      enter(parent)
      click(toolbarButton(parent, 'Done'))

      expect(parent.querySelectorAll(ELLIPSIS)).toHaveLength(2)
      expect(parent.querySelectorAll(ELIDED)).toHaveLength(0)
      expect(toolbarOf(parent)).toBeNull()
      expect(controlOf(parent)!.getAttribute('aria-pressed')).toBe('false')
    })

    it('lets a highlight stroke target text that is elided outside the mode', async () => {
      const { parent, write } = await render('John 15:4 nkjv inline x/4.7-4.9')

      enter(parent)
      const verse = verseTextOf(parent)
      select({ node: verse, offset: 0 }, { node: verse, offset: 6 })
      choose(0)

      expect(write).toHaveBeenCalledWith({
        highlights: [cueAt(1, 0, 6)],
        underlines: [],
        excerpt: [part(43015004, 7, 43015004, 9)],
      }, IN_MODE)
    })
  })

  describe('popover', () => {
    it('offers Show and Hide on a third row and no "show only this"', async () => {
      const { parent } = await render('John 15:4 nkjv inline')

      enter(parent)
      const verse = verseTextOf(parent)
      select({ node: verse, offset: 0 }, { node: verse, offset: 6 })

      const choices = swatches()
      expect(choices).toHaveLength(13)
      expect(choices[10].classList).toContain('scripture-study-highlight-eraser')
      expect([...choices].slice(11).map((choice) => choice.textContent)).toEqual([
        'Show',
        'Hide',
      ])
      expect(popover()!.textContent).not.toContain('Show only this')
      const rows = popover()!.querySelectorAll('.scripture-study-highlight-popover-row')
      expect(rows).toHaveLength(3)
      expect(rows[2].querySelectorAll('.scripture-study-highlight-swatch')).toHaveLength(2)
    })

    it('offers "show only this" again once the mode is left', async () => {
      const { parent } = await render('John 15:4 nkjv inline')

      enter(parent)
      click(toolbarButton(parent, 'Done'))
      const verse = verseTextOf(parent)
      select({ node: verse, offset: 0 }, { node: verse, offset: 6 })

      expect(swatches()).toHaveLength(12)
      expect(swatches()[11].textContent).toBe('Show only this')
    })

    it('Show adds the selection to the kept parts', async () => {
      const { parent, write } = await render(
        'John 15:4-5 nkjv inline x/4.0-4.6',
        twoVerses(),
      )

      enter(parent)
      const second = verseTextOf(parent, 1)
      select({ node: second, offset: 0 }, { node: second, offset: 4 })
      choose(SHOW)

      expect(write).toHaveBeenCalledWith({
        highlights: [],
        underlines: [],
        excerpt: [part(43015004, 0, 43015004, 6), part(43015005, 0, 43015005, 4)],
      }, IN_MODE)
    })

    it('Hide splits the part the selection lands inside', async () => {
      const { parent, write } = await render('John 15:4 nkjv inline x/4.0-4.12')

      enter(parent)
      const verse = verseTextOf(parent)
      select({ node: verse, offset: 7 }, { node: verse, offset: 9 })
      choose(HIDE)

      expect(write).toHaveBeenCalledWith({
        highlights: [],
        underlines: [],
        excerpt: [part(43015004, 0, 43015004, 7), part(43015004, 9, 43015004, 12)],
      }, IN_MODE)
    })

    it('Hide on a passage with no excerpt keeps everything but the selection', async () => {
      const { parent, write } = await render('John 15:4-5 nkjv inline', twoVerses())

      enter(parent)
      const first = verseTextOf(parent, 0)
      select({ node: first, offset: 7 }, { node: first, offset: 9 })
      choose(HIDE)

      expect(write).toHaveBeenCalledWith({
        highlights: [],
        underlines: [],
        excerpt: [part(43015004, 0, 43015004, 7), part(43015004, 9, 43015005, 13)],
      }, IN_MODE)
    })

    it('Hide from a clean start keeps one part per contiguous run across a Verse Gap', () => {
      expect(
        strokedCues(
          {
            highlights: [],
            underlines: [],
            excerpt: [],
            verses: [
              { verseId: 43015004, text: 'Remain in me' },
              { verseId: 43015009, text: 'Abide here now' },
            ],
          },
          part(43015009, 0, 43015009, 5),
          { kind: 'hide' },
        ).excerpt,
      ).toEqual([part(43015004, 0, 43015004, 12), part(43015009, 5, 43015009, 14)])
    })
  })

  describe('toolbar', () => {
    it('Clear excerpt removes every part, leaving the other channels alone', async () => {
      const { parent, write } = await render(
        'John 15:4 nkjv inline h1/4.0-4.6 x/4.0-4.6 x/4.10-4.12',
      )

      enter(parent)
      click(toolbarButton(parent, 'Clear excerpt'))

      expect(write).toHaveBeenCalledWith({
        highlights: [cueAt(1, 0, 6)],
        underlines: [],
        excerpt: [],
      }, IN_MODE)
    })

    it('Clear excerpt writes nothing when there is no excerpt', async () => {
      const { parent, write } = await render('John 15:4 nkjv inline')

      enter(parent)
      click(toolbarButton(parent, 'Clear excerpt'))

      expect(write).not.toHaveBeenCalled()
      expect(toolbarButton(parent, 'Clear excerpt').getAttribute('aria-disabled')).toBe('true')
    })

    it('Done leaves the mode without writing', async () => {
      const { parent, write } = await render('John 15:4 nkjv inline x/4.0-4.6')

      enter(parent)
      click(toolbarButton(parent, 'Done'))

      expect(write).not.toHaveBeenCalled()
      expect(toolbarOf(parent)).toBeNull()
    })
  })

  describe('leaving', () => {
    it('leaves on Escape', async () => {
      const { parent } = await render('John 15:4 nkjv inline x/4.0-4.6')

      enter(parent)
      press(document.body, 'Escape')

      expect(toolbarOf(parent)).toBeNull()
      expect(parent.querySelectorAll(ELLIPSIS)).toHaveLength(1)
    })

    it('closes an open popover on Escape first and leaves on the next', async () => {
      const { parent } = await render('John 15:4 nkjv inline')

      enter(parent)
      const verse = verseTextOf(parent)
      select({ node: verse, offset: 0 }, { node: verse, offset: 6 })
      press(document.body, 'Escape')

      expect(popover()).toBeNull()
      expect(toolbarOf(parent)).not.toBeNull()
      press(document.body, 'Escape')
      expect(toolbarOf(parent)).toBeNull()
    })

    it('leaves on a pointer-down outside the widget', async () => {
      const { parent } = await render('John 15:4 nkjv inline x/4.0-4.6')
      const elsewhere = document.body.createDiv()

      enter(parent)
      pointerDown(elsewhere)

      expect(toolbarOf(parent)).toBeNull()
    })

    it('stays for a pointer-down inside the passage, the toolbar or the popover', async () => {
      const { parent } = await render('John 15:4 nkjv inline')

      enter(parent)
      const verse = verseTextOf(parent)
      pointerDown(verse)
      pointerDown(toolbarOf(parent)!)
      select({ node: verse, offset: 0 }, { node: verse, offset: 6 })
      pointerDown(popover()!)

      expect(toolbarOf(parent)).not.toBeNull()
    })

    it('ends on the first occurrence when a second one enters', async () => {
      const first = await render('John 15:4 nkjv inline')
      const second = await render('John 15:5 nkjv inline')

      enter(first.parent)
      enter(second.parent)

      expect(toolbarOf(first.parent)).toBeNull()
      expect(toolbarOf(second.parent)).not.toBeNull()
      expect(controlOf(first.parent)!.getAttribute('aria-pressed')).toBe('false')
    })

    it('leaves the mode with a second press of the control', async () => {
      const { parent } = await render('John 15:4 nkjv inline')

      enter(parent)
      click(controlOf(parent)!)

      expect(toolbarOf(parent)).toBeNull()
    })
  })
})
