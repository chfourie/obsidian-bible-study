// Pure positioning for body-portaled menu panels, adapted from
// obsidian-journal-folder's sidebar menus. Free of DOM access so it can be
// unit tested; the caller measures the trigger rect + panel size and feeds
// them in.
//
// Placements:
//   'below' — drop below the anchor, right edges aligned (or left with
//             align: 'left'), flipping above when the viewport bottom is
//             too close (toolbar dropdowns).
//   'right' — fly out to the right of the anchor, tops aligned, flipping to
//             the left on overflow (the ribbon icon sits on the left edge).
// A null anchor centres the panel near the top of the viewport — the
// command entry point on mobile, where no ribbon strip exists.

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
export type MenuPanelPlacement = 'below' | 'right'
export type MenuPanelAlign = 'left' | 'right'

// Keep the panel at least this far from every viewport edge.
const MARGIN = 8

export const computeMenuPanelPosition = (opts: {
  anchor: AnchorRect | null
  panel: PanelSize
  viewport: Viewport
  placement?: MenuPanelPlacement
  align?: MenuPanelAlign
  gap?: number
}): MenuPanelPosition => {
  const { anchor, panel, viewport, placement = 'below', align = 'right', gap = 6 } = opts
  if (anchor === null) return centeredPosition(panel, viewport)
  if (placement === 'right')
    return {
      top: clamp(anchor.top, panel.height, viewport.height),
      left: horizontalFlyout(anchor, panel, viewport, gap),
    }
  return {
    top: verticalPosition(anchor, panel, viewport, gap),
    left: clamp(
      align === 'left' ? anchor.left : anchor.right - panel.width,
      panel.width,
      viewport.width,
    ),
  }
}

const centeredPosition = (
  panel: PanelSize,
  viewport: Viewport,
): MenuPanelPosition => ({
  top: clamp(Math.round(viewport.height * 0.12), panel.height, viewport.height),
  left: clamp(
    Math.round((viewport.width - panel.width) / 2),
    panel.width,
    viewport.width,
  ),
})

const horizontalFlyout = (
  anchor: AnchorRect,
  panel: PanelSize,
  viewport: Viewport,
  gap: number,
): number => {
  const right = anchor.right + gap
  if (right + panel.width <= viewport.width - MARGIN) return right
  const left = anchor.left - gap - panel.width
  if (left >= MARGIN) return left
  return clamp(right, panel.width, viewport.width)
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
