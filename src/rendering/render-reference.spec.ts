import { beforeEach, describe, expect, it, vi } from 'vitest'
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
