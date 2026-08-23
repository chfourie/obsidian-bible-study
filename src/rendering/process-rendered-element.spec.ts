import { describe, expect, it, vi } from 'vitest'
import type { Passage } from './module-passage-source'
import {
  processRenderedElement,
  type RenderedSection,
} from './process-rendered-element'
import type { ReferenceRenderDeps } from './render-reference'
import type { RenderContext } from './reference-render-model'

const context: RenderContext = {
  knownTranslationIds: ['web'],
  defaultTranslationId: 'web',
}

const passage: Passage = {
  status: 'ok',
  attribution: null,
  verses: [{ verseId: 43015004, segments: [{ text: 'Remain.', redLetter: false }] }],
}

const setup = () => {
  const deps: ReferenceRenderDeps = {
    passages: { passage: async () => passage },
    openReference: vi.fn(),
  }
  const root = document.createElement('div')
  return { root, deps }
}

const wholeNote = (source: string): RenderedSection => ({
  noteSource: source,
  lineStart: 0,
  lineEnd: source.split('\n').length - 1,
})

const process = (
  root: HTMLElement,
  deps: ReferenceRenderDeps,
  sectionSource = '',
  sourcePath: string | null = null,
) =>
  processRenderedElement(
    root,
    context,
    deps,
    wholeNote(sectionSource),
    sourcePath,
  )

const chipLabels = (root: HTMLElement): string[] =>
  [...root.querySelectorAll('.scripture-study-chip-ref')].map(
    (ref) => ref.textContent ?? '',
  )

describe('processRenderedElement', () => {
  it('passes the note path so its own occurrences stay off the surface', async () => {
    const { root, deps } = setup()
    deps.intersections = {
      intersecting: () => [
        {
          file: 'Sermons/Abiding.md',
          annotationReference: null,
          occurrences: [],
        },
        {
          file: 'Topics/Union.md',
          annotationReference: null,
          occurrences: [],
        },
      ],
      openNote: vi.fn(),
    }
    root.innerHTML = '<p>{John 15:4}</p>'

    await process(root, deps, '', 'Sermons/Abiding.md')

    const toggle = root.querySelector('.scripture-study-intersections-toggle')
    expect(toggle?.textContent).toBe('◆1')
  })

  it('replaces a brace reference with a chip, keeping surrounding text', async () => {
    const { root, deps } = setup()
    root.innerHTML = '<p>Abide: {John 15:4} in him.</p>'

    await process(root, deps)

    const paragraph = root.querySelector('p')
    expect(paragraph?.querySelector('.scripture-study-chip')).not.toBeNull()
    expect(paragraph?.textContent).toContain('Abide: ')
    expect(paragraph?.textContent).toContain(' in him.')
    expect(paragraph?.textContent).not.toContain('{')
  })

  it('renders every reference in a text node', async () => {
    const { root, deps } = setup()
    root.innerHTML = '<p>{John 15:4} and {Jhn 15:9}</p>'

    await process(root, deps)

    expect(root.querySelectorAll('.scripture-study-chip')).toHaveLength(2)
  })

  it('leaves invalid brace content untouched', async () => {
    const { root, deps } = setup()
    root.innerHTML = '<p>{"json": true} and {Nowhere 3:16}</p>'

    await process(root, deps)

    expect(root.querySelector('.scripture-study-chip')).toBeNull()
    expect(root.textContent).toBe('{"json": true} and {Nowhere 3:16}')
  })

  it('never renders inside code or pre elements', async () => {
    const { root, deps } = setup()
    root.innerHTML =
      '<p>use <code>{John 15:4}</code></p><pre><code>{John 15:9}</code></pre>'

    await process(root, deps)

    expect(root.querySelector('.scripture-study-chip')).toBeNull()
  })

  it('strips a visible escape backslash and leaves literal text', async () => {
    const { root, deps } = setup()
    root.innerHTML = '<p>\\{John 15:4}</p>'

    await process(root, deps)

    expect(root.querySelector('.scripture-study-chip')).toBeNull()
    expect(root.textContent).toBe('{John 15:4}')
  })

  it('escapes exactly the occurrence the source escaped, later position', async () => {
    const { root, deps } = setup()
    root.innerHTML = '<p>{John 15:4} then {John 15:4}</p>'

    await process(root, deps, '{John 15:4} then \\{John 15:4}')

    expect(root.querySelectorAll('.scripture-study-chip')).toHaveLength(1)
    expect(root.querySelector('p')?.textContent).toBe(
      'John 15:4 then {John 15:4}',
    )
  })

  it('escapes exactly the occurrence the source escaped, earlier position', async () => {
    const { root, deps } = setup()
    root.innerHTML = '<p>{John 15:4} then {John 15:4}</p>'

    await process(root, deps, '\\{John 15:4} then {John 15:4}')

    expect(root.querySelectorAll('.scripture-study-chip')).toHaveLength(1)
    expect(root.querySelector('p')?.textContent).toBe(
      '{John 15:4} then John 15:4',
    )
  })

  it('suppresses every occurrence when the source escapes them all', async () => {
    const { root, deps } = setup()
    root.innerHTML = '<p>{John 15:4} then {John 15:4}</p>'

    await process(root, deps, '\\{John 15:4} then \\{John 15:4}')

    expect(root.querySelector('.scripture-study-chip')).toBeNull()
    expect(root.querySelector('p')?.textContent).toBe(
      '{John 15:4} then {John 15:4}',
    )
  })

  it('ignores code-span candidates when matching source escapes', async () => {
    const { root, deps } = setup()
    root.innerHTML = '<p><code>{John 15:4}</code> then {John 15:4}</p>'

    await process(root, deps, '`{John 15:4}` then \\{John 15:4}')

    expect(root.querySelector('.scripture-study-chip')).toBeNull()
  })

  it('renders inline passages beside the chip', async () => {
    const { root, deps } = setup()
    root.innerHTML = '<p>He said {John 15:4 inline} to them.</p>'

    await process(root, deps)

    expect(root.querySelector('.scripture-study-passage')?.textContent).toBe(
      'Remain.',
    )
  })

  it('resolves a relative reference against an anchor in the same section', async () => {
    const { root, deps } = setup()
    root.innerHTML = '<p>{John 15:4-9} says {:5} here.</p>'

    await process(root, deps, '{John 15:4-9} says {:5} here.')

    expect(chipLabels(root)).toEqual(['John 15:4-9', '[:5]'])
    expect(
      root.querySelectorAll<HTMLElement>('.scripture-study-chip')[1].title,
    ).toBe('John 15:5')
  })

  it('resolves an anchor from an earlier section of the whole note', async () => {
    const { root, deps } = setup()
    const noteSource =
      '---\nref: John 3:16\n---\n# Abiding\n{John 15:4-9}\n\n## Fruit\n{:5} bears fruit.\n'
    root.innerHTML = '<p>{:5} bears fruit.</p>'

    await processRenderedElement(
      root,
      context,
      deps,
      { noteSource, lineStart: 7, lineEnd: 7 },
      null,
    )

    expect(chipLabels(root)).toEqual(['[:5]'])
  })

  it('leaves a relative reference plain without a preceding anchor', async () => {
    const { root, deps } = setup()
    root.innerHTML = '<p>{:5} then {John 15:4-9}</p>'

    await process(root, deps, '{:5} then {John 15:4-9}')

    expect(chipLabels(root)).toEqual(['John 15:4-9'])
    expect(root.textContent).toContain('{:5}')
  })

  it('leaves a relative reference plain when no source is supplied', async () => {
    const { root, deps } = setup()
    root.innerHTML = '<p>{John 15:4-9} says {:5} here.</p>'

    await process(root, deps)

    expect(chipLabels(root)).toEqual(['John 15:4-9'])
  })

  it('keeps an escaped relative reference literal', async () => {
    const { root, deps } = setup()
    root.innerHTML = '<p>{John 15:4-9} {:5} {:5}</p>'

    await process(root, deps, '{John 15:4-9} \\{:5} {:5}')

    expect(chipLabels(root)).toEqual(['John 15:4-9', '[:5]'])
    expect(root.textContent).toContain('{:5}')
  })
})
