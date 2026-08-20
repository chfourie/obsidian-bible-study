export type PanelDismissHandlers = {
  isInsidePanel: (target: Node) => boolean
  onDismiss: () => void
  onViewportChange: () => void
}

// Wires a floating panel's dismiss and reposition listeners against the
// document the panel actually lives in. `<svelte:window>` and delegated
// handlers bind the main window only, so a panel portaled into an Obsidian
// popout window (a separate Document) would never hear its clicks, Escape,
// scrolls, or resizes. Returns a cleanup that removes every listener.
export function wirePanelDismiss(
  doc: Document,
  handlers: PanelDismissHandlers,
): () => void {
  const onClick = (event: MouseEvent) => {
    const target = event.target as Node | null
    if (target && handlers.isInsidePanel(target)) return
    handlers.onDismiss()
  }
  const onKeydown = (event: KeyboardEvent) => {
    if (event.key === 'Escape') handlers.onDismiss()
  }
  const onViewportChange = () => handlers.onViewportChange()

  const win = doc.defaultView
  doc.addEventListener('click', onClick)
  doc.addEventListener('keydown', onKeydown)
  doc.addEventListener('scroll', onViewportChange, true)
  win?.addEventListener('resize', onViewportChange)
  return () => {
    doc.removeEventListener('click', onClick)
    doc.removeEventListener('keydown', onKeydown)
    doc.removeEventListener('scroll', onViewportChange, true)
    win?.removeEventListener('resize', onViewportChange)
  }
}
