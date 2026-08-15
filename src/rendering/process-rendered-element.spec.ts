import { describe, expect, it, vi } from 'vitest'
import type { Passage } from './module-passage-source'
import {
  escapedReferenceInners,
  processRenderedElement,
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

const process = (
  root: HTMLElement,
  deps: ReferenceRenderDeps,
  escaped: string[] = [],
) => processRenderedElement(root, context, deps, escaped)

describe('processRenderedElement', () => {
  it('replaces a brace reference with a chip, keeping surrounding text', async () => {
    const { root, deps } = setup()
    root.innerHTML = '<p>Abide: {John 15:4} in him.</p>'

    await process(root, deps)

    const paragraph = root.querySelector('p')
    expect(paragraph?.querySelector('.bible-study-chip')).not.toBeNull()
    expect(paragraph?.textContent).toContain('Abide: ')
    expect(paragraph?.textContent).toContain(' in him.')
    expect(paragraph?.textContent).not.toContain('{')
  })

  it('renders every reference in a text node', async () => {
    const { root, deps } = setup()
    root.innerHTML = '<p>{John 15:4} and {Jhn 15:9}</p>'

    await process(root, deps)

    expect(root.querySelectorAll('.bible-study-chip')).toHaveLength(2)
  })

  it('leaves invalid brace content untouched', async () => {
    const { root, deps } = setup()
    root.innerHTML = '<p>{"json": true} and {Nowhere 3:16}</p>'

    await process(root, deps)

    expect(root.querySelector('.bible-study-chip')).toBeNull()
    expect(root.textContent).toBe('{"json": true} and {Nowhere 3:16}')
  })

  it('never renders inside code or pre elements', async () => {
    const { root, deps } = setup()
    root.innerHTML =
      '<p>use <code>{John 15:4}</code></p><pre><code>{John 15:9}</code></pre>'

    await process(root, deps)

    expect(root.querySelector('.bible-study-chip')).toBeNull()
  })

  it('strips a visible escape backslash and leaves literal text', async () => {
    const { root, deps } = setup()
    root.innerHTML = '<p>\\{John 15:4}</p>'

    await process(root, deps)

    expect(root.querySelector('.bible-study-chip')).toBeNull()
    expect(root.textContent).toBe('{John 15:4}')
  })

  it('skips candidates the source marked as escaped, one occurrence each', async () => {
    const { root, deps } = setup()
    root.innerHTML = '<p>{John 15:4} then {John 15:4}</p>'

    await process(root, deps, ['John 15:4'])

    expect(root.querySelectorAll('.bible-study-chip')).toHaveLength(1)
    expect(root.textContent).toContain('{John 15:4}')
  })

  it('renders inline passages inside the flow', async () => {
    const { root, deps } = setup()
    root.innerHTML = '<p>He said {John 15:4 inline} to them.</p>'

    await process(root, deps)

    expect(root.querySelector('.bible-study-passage')?.textContent).toBe(
      '“Remain.”',
    )
  })
})

describe('escapedReferenceInners', () => {
  it('collects the inner text of escaped brace references', () => {
    expect(
      escapedReferenceInners('a \\{John 15:4} b {John 15:9} c \\{not a ref}'),
    ).toEqual(['John 15:4', 'not a ref'])
  })

  it('collects nothing when the source has no escapes', () => {
    expect(escapedReferenceInners('plain {John 15:4}')).toEqual([])
  })
})
