import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { HighlightCue } from '../reference'
import { attachHighlightEditing } from './highlight-editing'
import type { Passage, PassageSource } from './module-passage-source'
import { buildReferenceRenderModel } from './reference-render-model'
import { renderReference, type ReferenceRenderDeps } from './render-reference'

const context = {
  knownTranslationIds: ['web', 'nkjv'],
  defaultTranslationId: 'web',
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
  const write = vi.fn<(cues: readonly HighlightCue[]) => void>()
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

const choose = (index: number): void => {
  const buttons = popover()!.querySelectorAll('.scripture-study-highlight-swatch')
  buttons[index].dispatchEvent(new MouseEvent('click', { bubbles: true }))
}

beforeEach(() => {
  document.body.replaceChildren()
  document.getSelection()?.removeAllRanges()
})

describe('attachHighlightEditing popover gating', () => {
  it('offers five slots and an eraser for a selection inside the verse text', async () => {
    const { parent } = await render('John 15:4 nkjv inline')

    const verse = verseTextOf(parent)
    select({ node: verse, offset: 0 }, { node: verse, offset: 6 })

    const swatches = popover()!.querySelectorAll(
      '.scripture-study-highlight-swatch',
    )
    expect(swatches).toHaveLength(6)
    expect(swatches[5].classList).toContain('scripture-study-highlight-eraser')
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

    expect(write).toHaveBeenCalledWith([
      {
        slot: 2,
        startVerseId: 43015004,
        startChar: 0,
        endVerseId: 43015004,
        endChar: 6,
      },
    ])
  })

  it('erases the cues the selection covers', async () => {
    const { parent, write } = await render(
      'John 15:4 nkjv inline h3/4.0-4.6',
    )

    const verse = verseTextOf(parent)
    select({ node: verse, offset: 0 }, { node: verse, offset: 6 })
    choose(5)

    expect(write).toHaveBeenCalledWith([])
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

    expect(write).toHaveBeenCalledWith([
      {
        slot: 1,
        startVerseId: 43015004,
        startChar: 7,
        endVerseId: 43015004,
        endChar: 12,
      },
    ])
  })
})
