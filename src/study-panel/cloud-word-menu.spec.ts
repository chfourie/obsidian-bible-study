import { beforeEach, describe, expect, it, vi } from 'vitest'
import { Menu } from '../../tests/mocks/obsidian'
import type { WordCloudWordView } from '../contracts'
import { showCloudWordMenu, type CloudWordMenuActions } from './cloud-word-menu'

const word = (active = false): WordCloudWordView => ({
  family: 'G0026',
  rendering: 'love',
  gloss: 'love',
  transliteration: 'agapē',
  lemma: 'ἀγάπη',
  count: 3,
  sizeEm: 1,
  active,
})

const actions = (): CloudWordMenuActions => ({
  toggleEmphasis: vi.fn(),
  openWordStudy: vi.fn(),
  exclude: vi.fn(),
})

const shown = (): Menu => {
  if (Menu.lastShown === null) throw new Error('no menu shown')
  return Menu.lastShown
}

const titles = (): string[] => shown().items.map((item) => item.title)

describe('showCloudWordMenu', () => {
  beforeEach(() => {
    Menu.lastShown = null
  })

  it('offers highlighting, a word study and exclusion, in that order', () => {
    showCloudWordMenu(word(), new MouseEvent('click'), actions())

    expect(titles()).toEqual([
      'Highlight occurrences',
      'Word study',
      'Exclude from key words…',
    ])
  })

  it('offers to clear the highlight, checked, while the word is active', () => {
    showCloudWordMenu(word(true), new MouseEvent('click'), actions())

    expect(shown().items[0].title).toBe('Clear highlight')
    expect(shown().items[0].checked).toBe(true)
  })

  it('opens at the pointer for a mouse activation', () => {
    const event = new MouseEvent('click', { clientX: 10, clientY: 20 })

    showCloudWordMenu(word(), event, actions())

    expect(shown().shownAt).toBe(event)
  })

  it('opens under the word for a keyboard activation', () => {
    const target = document.createElement('span')
    target.getBoundingClientRect = () =>
      ({ left: 30, bottom: 40 }) as DOMRect
    const event = new KeyboardEvent('keydown', { key: 'Enter' })
    Object.defineProperty(event, 'target', { value: target })

    showCloudWordMenu(word(), event, actions())

    expect(shown().shownAt).toEqual({ x: 30, y: 40 })
  })

  it('routes each item to its action, the word study with its own event', () => {
    const given = actions()
    showCloudWordMenu(word(), new MouseEvent('click'), given)
    const studyClick = new MouseEvent('click', { metaKey: true })

    shown().items[0].click()
    shown().items[1].click(studyClick)
    shown().items[2].click()

    expect(given.toggleEmphasis).toHaveBeenCalledOnce()
    expect(given.openWordStudy).toHaveBeenCalledWith(studyClick)
    expect(given.exclude).toHaveBeenCalledOnce()
  })
})
