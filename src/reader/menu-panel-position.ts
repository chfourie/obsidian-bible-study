// Pure positioning for the body-portaled translation menu panel, adapted from
// obsidian-journal-folder's sidebar menus. Free of DOM access so it can be
// unit tested; the caller measures the trigger rect + panel size and feeds
// them in. The panel drops below the anchor, right edges aligned, flipping
// above when the viewport bottom is too close.

export type AnchorRect = {
  top: number
  left: number
  right: number
  bottom: number
  width: number
}

export type PanelSize = { width: number; height: number }
export type Viewport = { width: number; height: number }
export type MenuPanelPosition = { top: number; left: number }

// Keep the panel at least this far from every viewport edge.
const MARGIN = 8

export const computeMenuPanelPosition = (opts: {
  anchor: AnchorRect
  panel: PanelSize
  viewport: Viewport
  gap?: number
}): MenuPanelPosition => {
  const { anchor, panel, viewport, gap = 6 } = opts
  return {
    top: verticalPosition(anchor, panel, viewport, gap),
    left: clamp(anchor.right - panel.width, panel.width, viewport.width),
  }
}

const verticalPosition = (
  anchor: AnchorRect,
  panel: PanelSize,
  viewport: Viewport,
  gap: number,
): number => {
  const below = anchor.bottom + gap
  if (below + panel.height <= viewport.height - MARGIN) return below
  const above = anchor.top - gap - panel.height
  if (above >= MARGIN) return above
  return clamp(below, panel.height, viewport.height)
}

const clamp = (position: number, size: number, extent: number): number => {
  if (position < MARGIN) return MARGIN
  if (position + size > extent - MARGIN) return Math.max(MARGIN, extent - size - MARGIN)
  return position
}
