import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { App } from 'obsidian'
import type { WordCloudWordView } from '../contracts'
import { DEFAULT_SETTINGS, type ScriptureStudySettings } from '../data-access'
import { cloudExclusionEditor } from './cloud-exclusion-modal'

const word: WordCloudWordView = {
  family: 'G0026',
  rendering: 'love',
  gloss: 'love',
  transliteration: 'agapē',
  lemma: 'ἀγάπη',
  count: 3,
  sizeEm: 1,
  active: false,
}

const setup = (exclusions: string[] = []) => {
  let settings: ScriptureStudySettings = {
    ...DEFAULT_SETTINGS,
    wordCloudExclusions: exclusions,
  }
  const updateSettings = vi.fn(
    async (update: (s: ScriptureStudySettings) => ScriptureStudySettings) => {
      settings = update(settings)
      return settings
    },
  )
  const editor = cloudExclusionEditor({} as App, { updateSettings })
  editor.confirmAndExclude(word)
  const button = (text: string) =>
    [...document.body.querySelectorAll('button')].find(
      (candidate) => candidate.textContent === text,
    )
  return { updateSettings, exclusions: () => settings.wordCloudExclusions, button }
}

// The mocked Modal keeps its contentEl off the document; attach it so the
// buttons can be found the way a user finds them.
vi.mock('obsidian', async (importOriginal) => {
  const actual = await importOriginal<typeof import('obsidian')>()
  class AttachedModal extends actual.Modal {
    override open(): void {
      document.body.appendChild(this.contentEl)
      super.open()
    }
    override close(): void {
      super.close()
      this.contentEl.remove()
    }
  }
  return { ...actual, Modal: AttachedModal }
})

describe('cloudExclusionEditor', () => {
  beforeEach(() => {
    document.body.innerHTML = ''
  })

  it('names the word and waits for confirmation before saving anything', () => {
    const { updateSettings, button } = setup()

    expect(document.body.textContent).toContain('"love" (G0026, love)')
    expect(button('Exclude')).toBeDefined()
    expect(updateSettings).not.toHaveBeenCalled()
  })

  it('adds the family to the Cloud Exclusions once confirmed', async () => {
    const { exclusions, button } = setup(['G1722'])

    button('Exclude')?.click()
    await Promise.resolve()

    expect(exclusions()).toEqual(['G1722', 'G0026'])
    expect(button('Exclude')).toBeUndefined()
  })

  it('saves nothing when cancelled', () => {
    const { updateSettings, button } = setup()

    button('Cancel')?.click()

    expect(updateSettings).not.toHaveBeenCalled()
    expect(button('Cancel')).toBeUndefined()
  })

  it('leaves a family already excluded listed once', async () => {
    const { exclusions, button } = setup(['G0026'])

    button('Exclude')?.click()
    await Promise.resolve()

    expect(exclusions()).toEqual(['G0026'])
  })
})
