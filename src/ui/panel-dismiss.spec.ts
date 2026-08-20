import { afterEach, describe, expect, it, vi } from 'vitest'
import { wirePanelDismiss, type PanelDismissHandlers } from './panel-dismiss'

const cleanups: (() => void)[] = []

const wire = (doc: Document, overrides: Partial<PanelDismissHandlers> = {}) => {
  const handlers = {
    isInsidePanel: vi.fn(() => false),
    onDismiss: vi.fn(),
    onViewportChange: vi.fn(),
    ...overrides,
  }
  const cleanup = wirePanelDismiss(doc, handlers)
  cleanups.push(cleanup)
  return { handlers, cleanup }
}

afterEach(() => {
  while (cleanups.length > 0) cleanups.pop()?.()
})

describe('wirePanelDismiss', () => {
  it('dismisses on a click outside the panel', () => {
    const { handlers } = wire(document)

    document.body.dispatchEvent(new MouseEvent('click', { bubbles: true }))

    expect(handlers.onDismiss).toHaveBeenCalledTimes(1)
  })

  it('keeps the panel open on a click inside it', () => {
    const { handlers } = wire(document, { isInsidePanel: vi.fn(() => true) })

    document.body.dispatchEvent(new MouseEvent('click', { bubbles: true }))

    expect(handlers.onDismiss).not.toHaveBeenCalled()
  })

  it('dismisses on Escape but no other key', () => {
    const { handlers } = wire(document)

    document.body.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'a', bubbles: true }),
    )
    document.body.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }),
    )

    expect(handlers.onDismiss).toHaveBeenCalledTimes(1)
  })

  it('reports viewport changes on scroll and resize', () => {
    const { handlers } = wire(document)

    document.body.dispatchEvent(new Event('scroll', { bubbles: false }))
    window.dispatchEvent(new Event('resize'))

    expect(handlers.onViewportChange).toHaveBeenCalledTimes(2)
  })

  it('listens on the given document, not the global one — the popout case', () => {
    const popoutDoc = document.implementation.createHTMLDocument()
    const { handlers } = wire(popoutDoc)

    document.body.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    expect(handlers.onDismiss).not.toHaveBeenCalled()

    popoutDoc.body.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    expect(handlers.onDismiss).toHaveBeenCalledTimes(1)
  })

  it('removes every listener on cleanup', () => {
    const { handlers, cleanup } = wire(document)

    cleanup()
    document.body.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    document.body.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }),
    )
    document.body.dispatchEvent(new Event('scroll'))
    window.dispatchEvent(new Event('resize'))

    expect(handlers.onDismiss).not.toHaveBeenCalled()
    expect(handlers.onViewportChange).not.toHaveBeenCalled()
  })
})
