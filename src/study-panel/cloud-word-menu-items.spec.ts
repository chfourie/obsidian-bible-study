import { describe, expect, it, vi } from 'vitest'
import type { WordCloudWordView } from '../contracts'
import {
  buildCloudWordMenuItems,
  type CloudWordMenuActions,
} from './cloud-word-menu-items'

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

describe('buildCloudWordMenuItems', () => {
  it('offers highlighting, a word study and exclusion, in that order', () => {
    const items = buildCloudWordMenuItems(word(), actions())

    expect(items.map((item) => [item.title, item.icon, item.checked])).toEqual([
      ['Highlight occurrences', 'highlighter', false],
      ['Word study', 'book-open', undefined],
      ['Exclude from key words…', 'eye-off', undefined],
    ])
  })

  it('offers to clear the highlight, checked, while the word is active', () => {
    const [highlight] = buildCloudWordMenuItems(word(true), actions())

    expect(highlight.title).toBe('Clear highlight')
    expect(highlight.checked).toBe(true)
  })

  it('routes each item to its action, the word study with its own event', () => {
    const given = actions()
    const items = buildCloudWordMenuItems(word(), given)
    const studyClick = new MouseEvent('click', { metaKey: true })

    items[0].onClick(new MouseEvent('click'))
    items[1].onClick(studyClick)
    items[2].onClick(new MouseEvent('click'))

    expect(given.toggleEmphasis).toHaveBeenCalledOnce()
    expect(given.openWordStudy).toHaveBeenCalledWith(studyClick)
    expect(given.exclude).toHaveBeenCalledOnce()
  })
})
