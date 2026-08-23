import { describe, expect, it, vi } from 'vitest'
import { App } from 'obsidian'
import type { WordCloudWordView } from '../contracts'
import { ExcludeCloudWordModal } from './exclude-cloud-word-modal'

const word = (rendering: string): WordCloudWordView => ({
  family: 'H0834',
  rendering,
  gloss: 'which',
  transliteration: 'asher',
  lemma: 'אֲשֶׁר',
  count: 9,
  sizeEm: 1,
  active: false,
})

const buttons = (modal: ExcludeCloudWordModal): HTMLButtonElement[] => [
  ...modal.contentEl.querySelectorAll('button'),
]

describe('ExcludeCloudWordModal', () => {
  it('names the word as the cloud shows it, by rendering then number', () => {
    const modal = new ExcludeCloudWordModal(new App(), word('that'), vi.fn())

    modal.open()

    expect(modal.contentEl.textContent).toContain('"that" (H0834)')
  })

  it('falls back to the gloss for a word with no rendering', () => {
    const modal = new ExcludeCloudWordModal(new App(), word(''), vi.fn())

    modal.open()

    expect(modal.contentEl.textContent).toContain('"which" (H0834)')
  })

  it('confirms only from the Exclude button', () => {
    const confirm = vi.fn()
    const modal = new ExcludeCloudWordModal(new App(), word('that'), confirm)
    modal.open()

    buttons(modal)
      .find((button) => button.textContent === 'Cancel')
      ?.click()
    expect(confirm).not.toHaveBeenCalled()

    modal.open()
    buttons(modal)
      .find((button) => button.textContent === 'Exclude')
      ?.click()
    expect(confirm).toHaveBeenCalledOnce()
  })
})
