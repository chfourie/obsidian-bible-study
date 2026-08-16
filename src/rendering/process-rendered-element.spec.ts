import { describe, expect, it, vi } from 'vitest'
import type { Passage } from './module-passage-source'
import { processRenderedElement } from './process-rendered-element'
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

const process = (
  root: HTMLElement,
  deps: ReferenceRenderDeps,
  sectionSource = '',
  sourcePath: string | null = null,
) => processRenderedElement(root, context, deps, sectionSource, sourcePath)

describe('processRenderedElement', () => {
  it('passes the note path so its own occurrences stay off the surface', async () => {
    const { root, deps } = setup()
    deps.intersections = {
      intersecting: () => [
        { file: 'Sermons/Abiding.md', annotation: false, occurrences: [] },
        { file: 'Topics/Union.md', annotation: false, occurrences: [] },
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
})
