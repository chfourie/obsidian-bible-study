import { describe, expect, it } from 'vitest'
import { opensInNewPane } from './new-pane-modifier'

describe('opensInNewPane', () => {
  it('asks for a new pane when the platform modifier is held', () => {
    expect(opensInNewPane(new MouseEvent('click', { metaKey: true }))).toBe(true)
    expect(opensInNewPane(new MouseEvent('click', { ctrlKey: true }))).toBe(true)
    expect(
      opensInNewPane(new KeyboardEvent('keydown', { key: 'Enter', metaKey: true })),
    ).toBe(true)
  })

  it('reuses the open pane for a plain activation', () => {
    expect(opensInNewPane(new MouseEvent('click'))).toBe(false)
    expect(
      opensInNewPane(new KeyboardEvent('keydown', { key: 'Enter', shiftKey: true })),
    ).toBe(false)
  })
})
