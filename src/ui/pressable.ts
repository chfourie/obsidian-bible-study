import { activate } from './keyboard-activate'

export type PressHandler = (event: MouseEvent | KeyboardEvent) => void

// Svelte action giving an element a click + Enter/Space handler through
// explicit listeners on the node itself. Svelte 5's compiled `onclick` is
// delegated: it only registers on the mount target and the main window's
// `document`, so a node portaled into a popout window's document never
// receives it. Direct listeners follow the node wherever it is adopted.
export function pressable(node: HTMLElement, handler: PressHandler) {
  let current = handler
  const onClick = (event: MouseEvent) => current(event)
  const onKeydown = (event: KeyboardEvent) =>
    activate((keyEvent) => current(keyEvent))(event)
  node.addEventListener('click', onClick)
  node.addEventListener('keydown', onKeydown)
  return {
    update(next: PressHandler) {
      current = next
    },
    destroy() {
      node.removeEventListener('click', onClick)
      node.removeEventListener('keydown', onKeydown)
    },
  }
}
