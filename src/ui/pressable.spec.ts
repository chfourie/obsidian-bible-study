import { describe, expect, it, vi } from 'vitest'
import { pressable } from './pressable'

const keydown = (key: string) =>
  new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true })

describe('pressable', () => {
  it('fires on click', () => {
    const node = document.createElement('span')
    const handler = vi.fn()
    pressable(node, handler)

    node.dispatchEvent(new MouseEvent('click', { bubbles: true }))

    expect(handler).toHaveBeenCalledTimes(1)
  })

  it('fires on Enter and Space but not other keys', () => {
    const node = document.createElement('span')
    const handler = vi.fn()
    pressable(node, handler)

    node.dispatchEvent(keydown('Enter'))
    node.dispatchEvent(keydown(' '))
    node.dispatchEvent(keydown('a'))

    expect(handler).toHaveBeenCalledTimes(2)
  })

  it('fires for a node living in a foreign document, as after a popout portal', () => {
    const popoutDoc = document.implementation.createHTMLDocument()
    const node = popoutDoc.createElement('span')
    popoutDoc.body.appendChild(node)
    const handler = vi.fn()
    pressable(node, handler)

    node.dispatchEvent(new MouseEvent('click', { bubbles: true }))

    expect(handler).toHaveBeenCalledTimes(1)
  })

  it('keeps listening after the node is adopted into another document', () => {
    const node = document.createElement('span')
    const handler = vi.fn()
    pressable(node, handler)
    const popoutDoc = document.implementation.createHTMLDocument()
    popoutDoc.body.appendChild(node)

    node.dispatchEvent(new MouseEvent('click', { bubbles: true }))

    expect(handler).toHaveBeenCalledTimes(1)
  })

  it('routes events to the latest handler after update', () => {
    const node = document.createElement('span')
    const first = vi.fn()
    const second = vi.fn()
    const action = pressable(node, first)

    action.update(second)
    node.dispatchEvent(new MouseEvent('click', { bubbles: true }))

    expect(first).not.toHaveBeenCalled()
    expect(second).toHaveBeenCalledTimes(1)
  })

  it('stops firing after destroy', () => {
    const node = document.createElement('span')
    const handler = vi.fn()
    const action = pressable(node, handler)

    action.destroy()
    node.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    node.dispatchEvent(keydown('Enter'))

    expect(handler).not.toHaveBeenCalled()
  })
})
