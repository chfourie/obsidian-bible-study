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

    const chip = parent.querySelector('.scripture-study-chip')
    expect(chip?.textContent).toContain('John 15:4-6,9')
    chip?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    expect(openReference).toHaveBeenCalledWith(
      expect.objectContaining({ referenceText: 'John 15:4-6,9' }),
      { newPane: false },
    )
  })

  it('asks for a new reader pane when the chip is Cmd/Ctrl-clicked', async () => {
    const { parent, deps, openReference } = setup()

    await renderReference(parent, model('John 15:4'), deps)

    const chip = parent.querySelector('.scripture-study-chip')
    chip?.dispatchEvent(new MouseEvent('click', { bubbles: true, metaKey: true }))
    expect(openReference).toHaveBeenCalledWith(expect.anything(), {
      newPane: true,
    })
  })

  it('shows a translation label only when explicitly specified', async () => {
    const { parent, deps } = setup()

    await renderReference(parent, model('John 15:4 nkjv'), deps)
    await renderReference(parent, model('John 15:9'), deps)

    const labels = parent.querySelectorAll('.scripture-study-chip-translation')
    expect([...labels].map((label) => label.textContent)).toEqual(['NKJV'])
  })

  it('opens the reader from the keyboard with Enter and Space', async () => {
    const { parent, deps, openReference } = setup()

    await renderReference(parent, model('John 15:4'), deps)

    const chip = parent.querySelector('.scripture-study-chip')
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

    expect(parent.querySelector('.scripture-study-chip-icon')).not.toBeNull()
  })

  it('highlights invalid trailing tokens beside the chip', async () => {
    const { parent, deps } = setup()

    await renderReference(parent, model('John 15:4 bogus xyz'), deps)

    const tokens = parent.querySelectorAll('.scripture-study-invalid-token')
    expect([...tokens].map((token) => token.textContent)).toEqual([
      'bogus',
      'xyz',
    ])
  })

  it('renders no passage text in bare chip mode', async () => {
    const { parent, deps } = setup()

    await renderReference(parent, model('John 15:4'), deps)

    expect(parent.querySelector('.scripture-study-passage')).toBeNull()
  })
})

describe('renderReference inline', () => {
  it('renders the chip and the passage inside one block', async () => {
    const { parent, deps } = setup(passageOf('Remain in me, and I in you.'))

    await renderReference(parent, model('John 15:4 inline'), deps)

    const block = parent.querySelector(
      '.scripture-study-block.scripture-study-inline-block',
    )
    expect(block?.querySelector('.scripture-study-chip')).not.toBeNull()
    const passage = block?.querySelector('.scripture-study-passage')
    expect(passage?.textContent).toBe('Remain in me, and I in you.')
  })

  it('renders verses as one continuous run', async () => {
    const { parent, deps } = setup(passageOf('Remain in me.', 'I am the vine.'))

    await renderReference(parent, model('John 15:4-5 inline'), deps)

    const passage = parent.querySelector('.scripture-study-passage')
    expect(passage?.textContent).toBe('4Remain in me. 5I am the vine.')
    expect(passage?.querySelector('.scripture-study-verse-line')).toBeNull()
  })

  it('starts verses carrying line data on their own line and renders their breaks', async () => {
    const poetic: Passage = {
      status: 'ok',
      attribution: null,
      verses: [
        {
          verseId: 43015004,
          segments: [{ text: 'Prose verse.', redLetter: false }],
        },
        {
          verseId: 43015005,
          hasLineData: true,
          segments: [
            { text: 'First line, ', redLetter: false },
            { text: 'second line.', redLetter: false, lineBreakBefore: true },
          ],
        },
      ],
    }
    const { parent, deps } = setup(poetic)

    await renderReference(parent, model('John 15:4-5 inline'), deps)

    const passage = parent.querySelector('.scripture-study-passage')
    expect(passage?.querySelectorAll('br')).toHaveLength(2)
    expect(passage?.textContent).toBe('4Prose verse.5First line, second line.')
  })

  it('keeps verses without line data flowing as continuous text', async () => {
    const { parent, deps } = setup(passageOf('Remain in me.', 'I am the vine.'))

    await renderReference(parent, model('John 15:4-5 inline'), deps)

    const passage = parent.querySelector('.scripture-study-passage')
    expect(passage?.querySelectorAll('br')).toHaveLength(0)
  })

  it('starts every Psalms verse on a new line even without line data', async () => {
    const psalm: Passage = {
      status: 'ok',
      attribution: null,
      verses: [
        {
          verseId: 19023001,
          segments: [{ text: 'The LORD is my shepherd.', redLetter: false }],
        },
        {
          verseId: 19023002,
          segments: [{ text: 'He makes me lie down.', redLetter: false }],
        },
      ],
    }
    const { parent, deps } = setup(psalm)

    await renderReference(parent, model('Psalms 23:1-2 inline'), deps)

    const passage = parent.querySelector('.scripture-study-passage')
    expect(passage?.querySelectorAll('br')).toHaveLength(1)
  })

  it('renders indent depth and psalm headings in the inline run', async () => {
    const psalm: Passage = {
      status: 'ok',
      attribution: null,
      verses: [
        {
          verseId: 19023001,
          hasLineData: true,
          segments: [
            {
              text: 'A Psalm of David. ',
              redLetter: false,
              lineStart: true,
              psalmHeading: true,
            },
            {
              text: 'The LORD is my shepherd; ',
              redLetter: false,
              lineStart: true,
              lineBreakBefore: true,
              indent: 1,
            },
            {
              text: 'I shall not want.',
              redLetter: false,
              lineStart: true,
              lineBreakBefore: true,
              indent: 2,
            },
          ],
        },
      ],
    }
    const { parent, deps } = setup(psalm)

    await renderReference(parent, model('Psalms 23:1 inline'), deps)

    const passage = parent.querySelector('.scripture-study-passage')
    expect(
      passage?.querySelector('.scripture-study-psalm-heading')?.textContent,
    ).toBe('A Psalm of David. ')
    expect(
      passage?.querySelector('.scripture-study-indent-1')?.textContent,
    ).toBe('The LORD is my shepherd; ')
    expect(
      passage?.querySelector('.scripture-study-indent-2')?.textContent,
    ).toBe('I shall not want.')
    expect(passage?.querySelectorAll('br')).toHaveLength(2)
  })

  it('applies the indent class only to the segment starting its line', async () => {
    const poetic: Passage = {
      status: 'ok',
      attribution: null,
      verses: [
        {
          verseId: 19023002,
          hasLineData: true,
          segments: [
            {
              text: 'He makes me ',
              redLetter: false,
              lineStart: true,
              indent: 1,
            },
            { text: 'lie down', redLetter: false, indent: 1, strongs: ['H7257'] },
            { text: ' in green pastures.', redLetter: false, indent: 1 },
          ],
        },
      ],
    }
    const { parent, deps } = setup(poetic)

    await renderReference(parent, model('Psalms 23:2 inline'), deps)

    const indented = parent.querySelectorAll('.scripture-study-indent-1')
    expect([...indented].map((span) => span.textContent)).toEqual([
      'He makes me ',
    ])
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

    const placeholder = parent.querySelector('.scripture-study-passage')
    expect(placeholder?.classList.contains('scripture-study-loading')).toBe(true)
    expect(placeholder?.textContent).toBe('Loading John 15:4…')

    resolvePassage(passageOf('Remain.'))
    await rendered
    expect(
      parent.querySelector('.scripture-study-passage')?.textContent,
    ).toBe('Remain.')
    expect(parent.querySelector('.scripture-study-loading')).toBeNull()
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
    const sups = multi.parent.querySelectorAll('sup.scripture-study-verse-number')
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

    const red = parent.querySelector('.scripture-study-red-letter')
    expect(red?.textContent).toBe('Remain in me.')
  })

  it('marks supplied segments with the supplied class and keeps copy text clean', async () => {
    const { parent, deps } = setup({
      status: 'ok',
      attribution: null,
      verses: [
        {
          verseId: 40001001,
          segments: [
            { text: 'the', redLetter: false, supplied: true },
            { text: ' book of the genealogy', redLetter: false },
          ],
        },
      ],
    })

    await renderReference(parent, model('Matthew 1:1 inline'), deps)

    const supplied = parent.querySelector('.scripture-study-supplied')
    expect(supplied?.textContent).toBe('the')
    expect(parent.querySelector('.scripture-study-passage')?.textContent).toBe(
      'the book of the genealogy',
    )
  })

  it('marks a segment both red-letter and supplied with both classes', async () => {
    const { parent, deps } = setup({
      status: 'ok',
      attribution: null,
      verses: [
        {
          verseId: 43015004,
          segments: [{ text: 'Me', redLetter: true, supplied: true }],
        },
      ],
    })

    await renderReference(parent, model('John 15:4 inline'), deps)

    const span = parent.querySelector('.scripture-study-red-letter')
    expect(span?.classList.contains('scripture-study-supplied')).toBe(true)
  })

  it('degrades to a muted unavailable line with a retry icon', async () => {
    const { parent, deps } = setup({ status: 'unavailable' })

    await renderReference(parent, model('John 15:4 nkjv inline'), deps)

    const unavailable = parent.querySelector('.scripture-study-unavailable')
    expect(unavailable?.textContent).toContain(
      'John 15:4 (NKJV) unavailable offline',
    )
    expect(unavailable?.querySelector('.scripture-study-retry')).not.toBeNull()
  })

  it('retries the passage when the retry icon is clicked', async () => {
    let available = false
    const { parent, deps } = setup(() =>
      available ? passageOf('Remain.') : { status: 'unavailable' },
    )

    await renderReference(parent, model('John 15:4 inline'), deps)
    available = true
    parent
      .querySelector('.scripture-study-retry')
      ?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    await new Promise((resolve) => window.setTimeout(resolve, 0))

    expect(parent.querySelector('.scripture-study-passage')?.textContent).toBe(
      'Remain.',
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
      .querySelector('.scripture-study-retry')
      ?.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }),
      )
    await new Promise((resolve) => window.setTimeout(resolve, 0))

    expect(parent.querySelector('.scripture-study-passage')?.textContent).toBe(
      'Remain.',
    )
  })

  it('names the substituted translation when the fallback served', async () => {
    const { parent, deps } = setup({
      ...passageOf('Remain in me.'),
      fallback: { requested: 'nkjv', served: 'web' },
    } as Passage)

    await renderReference(parent, model('John 15:4 nkjv inline'), deps)

    expect(
      parent.querySelector('.scripture-study-fallback-notice')?.textContent,
    ).toBe('WEB (NKJV unavailable)')
  })

  it('shows no fallback notice when the requested translation served', async () => {
    const { parent, deps } = setup(passageOf('Remain in me.'))

    await renderReference(parent, model('John 15:4 inline'), deps)

    expect(parent.querySelector('.scripture-study-fallback-notice')).toBeNull()
  })

  it('treats a fully absent passage as unavailable', async () => {
    const { parent, deps } = setup(passageOf())

    await renderReference(parent, model('John 15:4 inline'), deps)

    expect(parent.querySelector('.scripture-study-unavailable')).not.toBeNull()
  })
})

describe('renderReference first-run install nudge', () => {
  const noTranslationModel = (text: string): ReferenceRenderModel => {
    const built = buildReferenceRenderModel(text, {
      knownTranslationIds: ['web', 'nkjv'],
      defaultTranslationId: null,
    })
    if (!built) throw new Error(`unparseable: ${text}`)
    return built
  }

  it('offers a one-click install CTA when no translation is installed', async () => {
    const { parent, deps } = setup({ status: 'unavailable' })
    deps.firstRun = {
      translationName: 'World English Bible',
      install: vi.fn(async () => {}),
    }

    await renderReference(parent, noTranslationModel('John 15:4 inline'), deps)

    const cta = parent.querySelector('.scripture-study-install-cta')
    expect(cta?.textContent).toBe('Install World English Bible')
  })

  it('runs the one-click install when the CTA is activated', async () => {
    const install = vi.fn(async () => {})
    const { parent, deps } = setup({ status: 'unavailable' })
    deps.firstRun = { translationName: 'World English Bible', install }

    await renderReference(parent, noTranslationModel('John 15:4 inline'), deps)
    parent
      .querySelector('.scripture-study-install-cta')
      ?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    await new Promise((resolve) => window.setTimeout(resolve, 0))

    expect(install).toHaveBeenCalledTimes(1)
  })

  it('disables the CTA while installing so rapid clicks start one install', async () => {
    let resolveInstall: () => void = () => {}
    const install = vi.fn(
      () => new Promise<void>((resolve) => (resolveInstall = resolve)),
    )
    const { parent, deps } = setup({ status: 'unavailable' })
    deps.firstRun = { translationName: 'World English Bible', install }

    await renderReference(parent, noTranslationModel('John 15:4 inline'), deps)
    const cta = parent.querySelector('.scripture-study-install-cta')
    cta?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    cta?.dispatchEvent(new MouseEvent('click', { bubbles: true }))

    expect(install).toHaveBeenCalledTimes(1)
    expect(cta?.textContent).toBe('Installing World English Bible…')
    expect(cta?.getAttribute('aria-disabled')).toBe('true')
    resolveInstall()
    await new Promise((resolve) => window.setTimeout(resolve, 0))
  })

  it('re-enables the CTA and shows the failure when the install fails', async () => {
    const install = vi.fn(async () => {
      throw new Error('network gone')
    })
    const { parent, deps } = setup({ status: 'unavailable' })
    deps.firstRun = { translationName: 'World English Bible', install }

    await renderReference(parent, noTranslationModel('John 15:4 inline'), deps)
    const cta = parent.querySelector('.scripture-study-install-cta')
    cta?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    await new Promise((resolve) => window.setTimeout(resolve, 0))

    expect(
      parent.querySelector('.scripture-study-install-error')?.textContent,
    ).toContain('network gone')
    expect(cta?.textContent).toBe('Install World English Bible')
    expect(cta?.getAttribute('aria-disabled')).toBeNull()

    cta?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    await new Promise((resolve) => window.setTimeout(resolve, 0))
    expect(install).toHaveBeenCalledTimes(2)
    expect(parent.querySelectorAll('.scripture-study-install-error')).toHaveLength(1)
  })

  it('shows no CTA when a translation is merely unavailable offline', async () => {
    const { parent, deps } = setup({ status: 'unavailable' })
    deps.firstRun = {
      translationName: 'World English Bible',
      install: vi.fn(async () => {}),
    }

    await renderReference(parent, model('John 15:4 nkjv inline'), deps)

    expect(parent.querySelector('.scripture-study-install-cta')).toBeNull()
  })
})

describe('renderReference in-note intersections', () => {
  const occurrenceGroup = (
    file: string,
    annotation: boolean,
  ): OccurrenceGroup => ({
    file,
    annotation,
    annotationReference: annotation
      ? { book: 43, ranges: [{ startId: 43015004, endId: 43015004 }] }
      : null,
    occurrences: [],
  })

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
      .querySelector('.scripture-study-intersections-toggle')
      ?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
  }

  it('renders no intersection surface without an intersection source', async () => {
    const { parent, deps } = setup()

    await renderReference(parent, model('John 15:4'), deps)

    expect(parent.querySelector('.scripture-study-intersections')).toBeNull()
  })

  it('renders no intersection surface when nothing intersects', async () => {
    const { parent, deps } = intersectionsSetup([])

    await renderReference(parent, model('John 15:4'), deps)

    expect(parent.querySelector('.scripture-study-intersections')).toBeNull()
  })

  it('shows annotation and mention counts beside the chip', async () => {
    const { parent, deps } = intersectionsSetup([
      occurrenceGroup('Annotations/John 15.4.md', true),
      occurrenceGroup('Sermons/Fruitfulness.md', false),
      occurrenceGroup('Topics/Union.md', false),
    ])

    await renderReference(parent, model('John 15:4'), deps)

    const toggle = parent.querySelector('.scripture-study-intersections-toggle')
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

    expect(parent.querySelector('.scripture-study-intersections')).toBeNull()
  })

  it('expands to annotations first, then mentions', async () => {
    const { parent, deps } = intersectionsSetup([
      occurrenceGroup('Annotations/John 15.4.md', true),
      occurrenceGroup('Sermons/Fruitfulness.md', false),
    ])
    await renderReference(parent, model('John 15:4'), deps)

    openPanel(parent)

    const labels = parent.querySelectorAll('.scripture-study-intersections-group')
    expect([...labels].map((label) => label.textContent)).toEqual([
      'Annotations',
      'Mentions',
    ])
    const notes = parent.querySelectorAll('.scripture-study-intersections-note')
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
      parent.querySelector('.scripture-study-intersections-panel'),
    ).toBeNull()
  })

  it('opens an intersecting note when its entry is clicked', async () => {
    const { parent, deps, openNote } = intersectionsSetup([
      occurrenceGroup('Sermons/Fruitfulness.md', false),
    ])
    await renderReference(parent, model('John 15:4'), deps)

    openPanel(parent)
    parent
      .querySelector('.scripture-study-intersections-note')
      ?.dispatchEvent(new MouseEvent('click', { bubbles: true }))

    expect(openNote).toHaveBeenCalledWith('Sermons/Fruitfulness.md')
  })

  it('renders the surface inside the block', async () => {
    const { parent, deps } = intersectionsSetup([
      occurrenceGroup('Sermons/Fruitfulness.md', false),
    ])

    await renderReference(parent, model('John 15:4 block'), deps)

    expect(
      parent.querySelector('.scripture-study-block .scripture-study-intersections'),
    ).not.toBeNull()
  })
})

describe('renderReference block', () => {
  it('renders the chip on its own line above the passage', async () => {
    const { parent, deps } = setup()

    await renderReference(parent, model('John 15:4 block'), deps)

    const block = parent.querySelector('.scripture-study-block')
    expect(block?.classList.contains('scripture-study-inline-block')).toBe(false)
    expect(
      block?.querySelector('.scripture-study-block-ref .scripture-study-chip'),
    ).not.toBeNull()
    expect(block?.querySelector('.scripture-study-passage')).not.toBeNull()
  })

  it('opens the reader from the chip', async () => {
    const { parent, deps, openReference } = setup()

    await renderReference(parent, model('jhn 15:4 block'), deps)

    parent
      .querySelector('.scripture-study-chip')
      ?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    expect(openReference).toHaveBeenCalledWith(
      expect.objectContaining({ referenceText: 'John 15:4' }),
      { newPane: false },
    )
  })

  it('numbers verses even for a single verse', async () => {
    const { parent, deps } = setup(passageOf('Remain in me, and I in you.'))

    await renderReference(parent, model('John 15:4 block'), deps)

    const passage = parent.querySelector('.scripture-study-passage')
    const sup = passage?.querySelector('sup.scripture-study-verse-number')
    expect(sup?.textContent).toBe('4')
    expect(passage?.textContent).toContain('Remain in me, and I in you.')
  })

  it('renders one verse per line', async () => {
    const { parent, deps } = setup(passageOf('Remain in me.', 'I am the vine.'))

    await renderReference(parent, model('John 15:4-5 block'), deps)

    const lines = parent.querySelectorAll(
      '.scripture-study-passage .scripture-study-verse-line',
    )
    expect([...lines].map((line) => line.textContent)).toEqual([
      '4Remain in me.',
      '5I am the vine.',
    ])
  })

  it('renders intra-verse line breaks inside a verse line', async () => {
    const poetic: Passage = {
      status: 'ok',
      attribution: null,
      verses: [
        {
          verseId: 19023001,
          hasLineData: true,
          segments: [
            { text: 'The LORD is my shepherd, ', redLetter: false },
            { text: 'I lack nothing.', redLetter: false, lineBreakBefore: true },
          ],
        },
      ],
    }
    const { parent, deps } = setup(poetic)

    await renderReference(parent, model('Psalms 23:1 block'), deps)

    const line = parent.querySelector(
      '.scripture-study-passage .scripture-study-verse-line',
    )
    expect(line?.querySelectorAll('br')).toHaveLength(1)
    expect(line?.textContent).toBe(
      '1The LORD is my shepherd, I lack nothing.',
    )
  })

  it('renders indent depth and psalm headings within a block verse line', async () => {
    const psalm: Passage = {
      status: 'ok',
      attribution: null,
      verses: [
        {
          verseId: 19023001,
          hasLineData: true,
          segments: [
            {
              text: 'A Psalm of David. ',
              redLetter: false,
              lineStart: true,
              psalmHeading: true,
            },
            {
              text: 'The LORD is my shepherd; ',
              redLetter: false,
              lineStart: true,
              lineBreakBefore: true,
              indent: 1,
            },
            {
              text: 'I shall not want.',
              redLetter: false,
              lineStart: true,
              lineBreakBefore: true,
              indent: 2,
            },
          ],
        },
      ],
    }
    const { parent, deps } = setup(psalm)

    await renderReference(parent, model('Psalms 23:1 block'), deps)

    const line = parent.querySelector(
      '.scripture-study-passage .scripture-study-verse-line',
    )
    expect(
      line?.querySelector('.scripture-study-psalm-heading')?.textContent,
    ).toBe('A Psalm of David. ')
    expect(line?.querySelector('.scripture-study-indent-1')?.textContent).toBe(
      'The LORD is my shepherd; ',
    )
    expect(line?.querySelector('.scripture-study-indent-2')?.textContent).toBe(
      'I shall not want.',
    )
    expect(line?.querySelectorAll('br')).toHaveLength(2)
  })

  it('shows a muted attribution line when the translation carries one', async () => {
    const attributed: Passage = {
      ...passageOf('Remain.'),
      attribution: 'Copyright © 1982, Thomas Nelson',
    } as Passage
    const { parent, deps } = setup(attributed)

    await renderReference(parent, model('John 15:4 block'), deps)

    expect(
      parent.querySelector('.scripture-study-attribution')?.textContent,
    ).toBe('Copyright © 1982, Thomas Nelson')
  })

  it('shows no attribution line without a copyright string', async () => {
    const { parent, deps } = setup(passageOf('Remain.'))

    await renderReference(parent, model('John 15:4 block'), deps)

    expect(parent.querySelector('.scripture-study-attribution')).toBeNull()
  })

  it('names the substituted translation in the block body', async () => {
    const { parent, deps } = setup({
      ...passageOf('Remain in me.'),
      fallback: { requested: 'nkjv', served: 'web' },
    } as Passage)

    await renderReference(parent, model('John 15:4 nkjv block'), deps)

    expect(
      parent.querySelector(
        '.scripture-study-block .scripture-study-fallback-notice',
      )?.textContent,
    ).toBe('WEB (NKJV unavailable)')
  })

  it('degrades the block body when the passage is unavailable', async () => {
    const { parent, deps } = setup({ status: 'unavailable' })

    await renderReference(parent, model('John 15:4 block'), deps)

    expect(
      parent.querySelector('.scripture-study-block .scripture-study-unavailable'),
    ).not.toBeNull()
  })
})

describe('renderReference highlights', () => {
  const remain = (): Passage => ({
    status: 'ok',
    attribution: null,
    verses: [
      {
        verseId: 43015004,
        segments: [{ text: 'Remain in me.', redLetter: false }],
      },
    ],
  })

  it('tints the cued span in an inline passage', async () => {
    const { parent, deps } = setup(remain())

    await renderReference(parent, model('John 15:4 inline h1/4.0-6'), deps)

    const highlight = parent.querySelector('.scripture-study-highlight-1')
    expect(highlight?.textContent).toBe('Remain')
    expect(parent.querySelector('.scripture-study-passage')?.textContent).toBe(
      'Remain in me.',
    )
  })

  it('tints the cued span in a block passage', async () => {
    const { parent, deps } = setup(remain())

    await renderReference(parent, model('John 15:4 block h4/4.7-13'), deps)

    expect(
      parent.querySelector('.scripture-study-highlight-4')?.textContent,
    ).toBe('in me.')
  })

  it('keeps red-letter text red under a highlight', async () => {
    const { parent, deps } = setup({
      status: 'ok',
      attribution: null,
      verses: [
        {
          verseId: 43015004,
          segments: [{ text: 'Remain in me.', redLetter: true }],
        },
      ],
    })

    await renderReference(parent, model('John 15:4 inline h2/4.0-6'), deps)

    const highlight = parent.querySelector('.scripture-study-highlight-2')
    expect(highlight?.classList.contains('scripture-study-red-letter')).toBe(
      true,
    )
  })

  it('renders no highlights on a fallback-served passage', async () => {
    const { parent, deps } = setup({
      ...remain(),
      fallback: { requested: 'nkjv', served: 'web' },
    } as Passage)

    await renderReference(parent, model('John 15:4 nkjv inline h1/4.0-6'), deps)

    expect(parent.querySelector('.scripture-study-highlight-1')).toBeNull()
    expect(
      parent.querySelector('.scripture-study-passage')?.textContent,
    ).toContain('Remain in me.')
  })

  it('renders no passage text for a chip carrying cues', async () => {
    const { parent, deps } = setup(remain())

    await renderReference(parent, model('John 15:4 h1/4.0-6'), deps)

    expect(parent.querySelector('.scripture-study-passage')).toBeNull()
    expect(parent.querySelector('.scripture-study-invalid-token')).toBeNull()
  })
})
