import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { OccurrenceGroup } from '../vault-index'
import type { Passage, PassageSource } from './module-passage-source'
import {
  buildReferenceRenderModel,
  type ReferenceRenderModel,
} from './reference-render-model'
import { renderReference, type ReferenceRenderDeps } from './render-reference'

const context = {
  knownTranslationIds: ['web', 'nkjv'],
  defaultTranslationId: 'web',
}

const model = (text: string): ReferenceRenderModel => {
  const built = buildReferenceRenderModel(text, context)
  if (!built) throw new Error(`unparseable: ${text}`)
  return built
}

const passageOf = (...texts: string[]): Passage => ({
  status: 'ok',
  attribution: null,
  verses: texts.map((text, index) => ({
    verseId: 43015004 + index,
    segments: [{ text, redLetter: false }],
  })),
})

const setup = (passage: Passage | (() => Passage) = passageOf('Remain.')) => {
  const openReference = vi.fn()
  const passages: PassageSource = {
    passage: async () =>
      typeof passage === 'function' ? passage() : passage,
  }
  const deps: ReferenceRenderDeps = { passages, openReference }
  const parent = document.createElement('p')
  return { parent, deps, openReference }
}

beforeEach(() => {
  document.body.replaceChildren()
})

describe('renderReference chip', () => {
  it('renders a clickable chip with the normalized reference', async () => {
    const { parent, deps, openReference } = setup()

    await renderReference(parent, model('jhn 15:9,4-6'), deps)

    const chip = parent.querySelector('.bible-study-chip')
    expect(chip?.textContent).toContain('John 15:4-6,9')
    chip?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    expect(openReference).toHaveBeenCalledWith(
      expect.objectContaining({ referenceText: 'John 15:4-6,9' }),
    )
  })

  it('shows a translation label only when explicitly specified', async () => {
    const { parent, deps } = setup()

    await renderReference(parent, model('John 15:4 nkjv'), deps)
    await renderReference(parent, model('John 15:9'), deps)

    const labels = parent.querySelectorAll('.bible-study-chip-translation')
    expect([...labels].map((label) => label.textContent)).toEqual(['NKJV'])
  })

  it('opens the reader from the keyboard with Enter and Space', async () => {
    const { parent, deps, openReference } = setup()

    await renderReference(parent, model('John 15:4'), deps)

    const chip = parent.querySelector('.bible-study-chip')
    chip?.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }),
    )
    chip?.dispatchEvent(
      new KeyboardEvent('keydown', { key: ' ', bubbles: true }),
    )
    chip?.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'a', bubbles: true }),
    )
    expect(openReference).toHaveBeenCalledTimes(2)
  })

  it('renders a nav icon inside the chip', async () => {
    const { parent, deps } = setup()

    await renderReference(parent, model('John 15:4'), deps)

    expect(parent.querySelector('.bible-study-chip-icon')).not.toBeNull()
  })

  it('highlights invalid trailing tokens beside the chip', async () => {
    const { parent, deps } = setup()

    await renderReference(parent, model('John 15:4 bogus xyz'), deps)

    const tokens = parent.querySelectorAll('.bible-study-invalid-token')
    expect([...tokens].map((token) => token.textContent)).toEqual([
      'bogus',
      'xyz',
    ])
  })

  it('renders no passage text in bare chip mode', async () => {
    const { parent, deps } = setup()

    await renderReference(parent, model('John 15:4'), deps)

    expect(parent.querySelector('.bible-study-passage')).toBeNull()
  })
})

describe('renderReference inline', () => {
  it('renders the chip followed by a quoted passage run', async () => {
    const { parent, deps } = setup(passageOf('Remain in me, and I in you.'))

    await renderReference(parent, model('John 15:4 inline'), deps)

    expect(parent.querySelector('.bible-study-chip')).not.toBeNull()
    const passage = parent.querySelector('.bible-study-passage')
    expect(passage?.textContent).toBe('“Remain in me, and I in you.”')
  })

  it('shows a loading placeholder until the passage arrives', async () => {
    let resolvePassage: (passage: Passage) => void = () => {}
    const { parent, deps } = setup()
    deps.passages = {
      passage: () =>
        new Promise<Passage>((resolve) => {
          resolvePassage = resolve
        }),
    }

    const rendered = renderReference(parent, model('John 15:4 inline'), deps)

    const placeholder = parent.querySelector('.bible-study-passage')
    expect(placeholder?.classList.contains('bible-study-loading')).toBe(true)
    expect(placeholder?.textContent).toBe('Loading John 15:4…')

    resolvePassage(passageOf('Remain.'))
    await rendered
    expect(
      parent.querySelector('.bible-study-passage')?.textContent,
    ).toBe('“Remain.”')
    expect(parent.querySelector('.bible-study-loading')).toBeNull()
  })

  it('adds superscript verse numbers only for multi-verse references', async () => {
    const single = setup(passageOf('Remain.'))
    const multi = setup(passageOf('Remain.', 'I am the vine.'))

    await renderReference(single.parent, model('John 15:4 inline'), single.deps)
    await renderReference(
      multi.parent,
      model('John 15:4-5 inline'),
      multi.deps,
    )

    expect(single.parent.querySelectorAll('sup')).toHaveLength(0)
    const sups = multi.parent.querySelectorAll('sup.bible-study-verse-number')
    expect([...sups].map((sup) => sup.textContent)).toEqual(['4', '5'])
  })

  it('marks red-letter segments with the red-letter class', async () => {
    const { parent, deps } = setup({
      status: 'ok',
      attribution: null,
      verses: [
        {
          verseId: 43015004,
          segments: [
            { text: 'He said, ', redLetter: false },
            { text: 'Remain in me.', redLetter: true },
          ],
        },
      ],
    })

    await renderReference(parent, model('John 15:4 inline'), deps)

    const red = parent.querySelector('.bible-study-red-letter')
    expect(red?.textContent).toBe('Remain in me.')
  })

  it('degrades to a muted unavailable line with a retry icon', async () => {
    const { parent, deps } = setup({ status: 'unavailable' })

    await renderReference(parent, model('John 15:4 nkjv inline'), deps)

    const unavailable = parent.querySelector('.bible-study-unavailable')
    expect(unavailable?.textContent).toContain(
      'John 15:4 (NKJV) unavailable offline',
    )
    expect(unavailable?.querySelector('.bible-study-retry')).not.toBeNull()
  })

  it('retries the passage when the retry icon is clicked', async () => {
    let available = false
    const { parent, deps } = setup(() =>
      available ? passageOf('Remain.') : { status: 'unavailable' },
    )

    await renderReference(parent, model('John 15:4 inline'), deps)
    available = true
    parent
      .querySelector('.bible-study-retry')
      ?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    await new Promise((resolve) => window.setTimeout(resolve, 0))

    expect(parent.querySelector('.bible-study-passage')?.textContent).toBe(
      '“Remain.”',
    )
  })

  it('retries the passage from the keyboard', async () => {
    let available = false
    const { parent, deps } = setup(() =>
      available ? passageOf('Remain.') : { status: 'unavailable' },
    )

    await renderReference(parent, model('John 15:4 inline'), deps)
    available = true
    parent
      .querySelector('.bible-study-retry')
      ?.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }),
      )
    await new Promise((resolve) => window.setTimeout(resolve, 0))

    expect(parent.querySelector('.bible-study-passage')?.textContent).toBe(
      '“Remain.”',
    )
  })

  it('names the substituted translation when the fallback served', async () => {
    const { parent, deps } = setup({
      ...passageOf('Remain in me.'),
      fallback: { requested: 'nkjv', served: 'web' },
    } as Passage)

    await renderReference(parent, model('John 15:4 nkjv inline'), deps)

    expect(
      parent.querySelector('.bible-study-fallback-notice')?.textContent,
    ).toBe('WEB (NKJV unavailable)')
  })

  it('shows no fallback notice when the requested translation served', async () => {
    const { parent, deps } = setup(passageOf('Remain in me.'))

    await renderReference(parent, model('John 15:4 inline'), deps)

    expect(parent.querySelector('.bible-study-fallback-notice')).toBeNull()
  })

  it('treats a fully absent passage as unavailable', async () => {
    const { parent, deps } = setup(passageOf())

    await renderReference(parent, model('John 15:4 inline'), deps)

    expect(parent.querySelector('.bible-study-unavailable')).not.toBeNull()
  })
})

describe('renderReference in-note intersections', () => {
  const occurrenceGroup = (
    file: string,
    annotation: boolean,
  ): OccurrenceGroup => ({ file, annotation, occurrences: [] })

  const intersectionsSetup = (groups: OccurrenceGroup[]) => {
    const base = setup()
    const openNote = vi.fn()
    base.deps.intersections = {
      intersecting: () => groups,
      openNote,
    }
    return { ...base, openNote }
  }

  const openPanel = (parent: HTMLElement): void => {
    parent
      .querySelector('.bible-study-intersections-toggle')
      ?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
  }

  it('renders no intersection surface without an intersection source', async () => {
    const { parent, deps } = setup()

    await renderReference(parent, model('John 15:4'), deps)

    expect(parent.querySelector('.bible-study-intersections')).toBeNull()
  })

  it('renders no intersection surface when nothing intersects', async () => {
    const { parent, deps } = intersectionsSetup([])

    await renderReference(parent, model('John 15:4'), deps)

    expect(parent.querySelector('.bible-study-intersections')).toBeNull()
  })

  it('shows annotation and mention counts beside the chip', async () => {
    const { parent, deps } = intersectionsSetup([
      occurrenceGroup('Annotations/John 15.4.md', true),
      occurrenceGroup('Sermons/Fruitfulness.md', false),
      occurrenceGroup('Topics/Union.md', false),
    ])

    await renderReference(parent, model('John 15:4'), deps)

    const toggle = parent.querySelector('.bible-study-intersections-toggle')
    expect(toggle?.textContent).toContain('●1')
    expect(toggle?.textContent).toContain('◆2')
  })

  it('excludes the containing note from the surface', async () => {
    const { parent, deps } = intersectionsSetup([
      occurrenceGroup('Sermons/Fruitfulness.md', false),
    ])

    await renderReference(
      parent,
      model('John 15:4'),
      deps,
      'Sermons/Fruitfulness.md',
    )

    expect(parent.querySelector('.bible-study-intersections')).toBeNull()
  })

  it('expands to annotations first, then mentions', async () => {
    const { parent, deps } = intersectionsSetup([
      occurrenceGroup('Annotations/John 15.4.md', true),
      occurrenceGroup('Sermons/Fruitfulness.md', false),
    ])
    await renderReference(parent, model('John 15:4'), deps)

    openPanel(parent)

    const labels = parent.querySelectorAll('.bible-study-intersections-group')
    expect([...labels].map((label) => label.textContent)).toEqual([
      'Annotations',
      'Mentions',
    ])
    const notes = parent.querySelectorAll('.bible-study-intersections-note')
    expect([...notes].map((note) => note.textContent)).toEqual([
      'John 15.4',
      'Sermons/Fruitfulness.md',
    ])
  })

  it('collapses the surface when toggled again', async () => {
    const { parent, deps } = intersectionsSetup([
      occurrenceGroup('Sermons/Fruitfulness.md', false),
    ])
    await renderReference(parent, model('John 15:4'), deps)

    openPanel(parent)
    openPanel(parent)

    expect(
      parent.querySelector('.bible-study-intersections-panel'),
    ).toBeNull()
  })

  it('opens an intersecting note when its entry is clicked', async () => {
    const { parent, deps, openNote } = intersectionsSetup([
      occurrenceGroup('Sermons/Fruitfulness.md', false),
    ])
    await renderReference(parent, model('John 15:4'), deps)

    openPanel(parent)
    parent
      .querySelector('.bible-study-intersections-note')
      ?.dispatchEvent(new MouseEvent('click', { bubbles: true }))

    expect(openNote).toHaveBeenCalledWith('Sermons/Fruitfulness.md')
  })

  it('renders the surface inside the callout body', async () => {
    const { parent, deps } = intersectionsSetup([
      occurrenceGroup('Sermons/Fruitfulness.md', false),
    ])

    await renderReference(parent, model('John 15:4 callout'), deps)

    expect(
      parent.querySelector('.callout-content .bible-study-intersections'),
    ).not.toBeNull()
  })
})

describe('renderReference callout', () => {
  it('renders a bible callout instead of a chip', async () => {
    const { parent, deps } = setup()

    await renderReference(parent, model('John 15:4 callout'), deps)

    expect(parent.querySelector('.bible-study-chip')).toBeNull()
    expect(
      parent.querySelector('.callout[data-callout="bible"]'),
    ).not.toBeNull()
  })

  it('titles the callout with the reference and the served translation', async () => {
    const { parent, deps } = setup()

    await renderReference(parent, model('jhn 15:4 callout'), deps)

    expect(
      parent.querySelector('.callout-title-inner')?.textContent,
    ).toBe('John 15:4 · WEB')
  })

  it('opens the reader from the title nav icon', async () => {
    const { parent, deps, openReference } = setup()

    await renderReference(parent, model('John 15:4 callout'), deps)

    parent
      .querySelector('.bible-study-callout-nav')
      ?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    expect(openReference).toHaveBeenCalledWith(
      expect.objectContaining({ referenceText: 'John 15:4' }),
    )
  })

  it('opens the reader from the title nav icon with the keyboard', async () => {
    const { parent, deps, openReference } = setup()

    await renderReference(parent, model('John 15:4 callout'), deps)

    parent
      .querySelector('.bible-study-callout-nav')
      ?.dispatchEvent(
        new KeyboardEvent('keydown', { key: ' ', bubbles: true }),
      )
    expect(openReference).toHaveBeenCalledWith(
      expect.objectContaining({ referenceText: 'John 15:4' }),
    )
  })

  it('renders body prose with verse numbers even for a single verse', async () => {
    const { parent, deps } = setup(passageOf('Remain in me, and I in you.'))

    await renderReference(parent, model('John 15:4 callout'), deps)

    const content = parent.querySelector('.callout-content')
    const sup = content?.querySelector('sup.bible-study-verse-number')
    expect(sup?.textContent).toBe('4')
    expect(content?.textContent).toContain('Remain in me, and I in you.')
  })

  it('shows a muted attribution line when the translation carries one', async () => {
    const attributed: Passage = {
      ...passageOf('Remain.'),
      attribution: 'Copyright © 1982, Thomas Nelson',
    } as Passage
    const { parent, deps } = setup(attributed)

    await renderReference(parent, model('John 15:4 callout'), deps)

    expect(
      parent.querySelector('.bible-study-attribution')?.textContent,
    ).toBe('Copyright © 1982, Thomas Nelson')
  })

  it('shows no attribution line without a copyright string', async () => {
    const { parent, deps } = setup(passageOf('Remain.'))

    await renderReference(parent, model('John 15:4 callout'), deps)

    expect(parent.querySelector('.bible-study-attribution')).toBeNull()
  })

  it('names the substituted translation in the callout body', async () => {
    const { parent, deps } = setup({
      ...passageOf('Remain in me.'),
      fallback: { requested: 'nkjv', served: 'web' },
    } as Passage)

    await renderReference(parent, model('John 15:4 nkjv callout'), deps)

    expect(
      parent.querySelector(
        '.callout-content .bible-study-fallback-notice',
      )?.textContent,
    ).toBe('WEB (NKJV unavailable)')
  })

  it('degrades the callout body when the passage is unavailable', async () => {
    const { parent, deps } = setup({ status: 'unavailable' })

    await renderReference(parent, model('John 15:4 callout'), deps)

    expect(
      parent.querySelector('.callout-content .bible-study-unavailable'),
    ).not.toBeNull()
  })
})
