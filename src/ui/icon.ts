import { setIcon } from 'obsidian'

// Svelte action painting an Obsidian (lucide) icon into the node, repainted
// when the name changes.
export const icon = (
  node: HTMLElement,
  name: string,
): { update: (next: string) => void } => {
  setIcon(node, name)
  return {
    update(next: string) {
      node.empty()
      setIcon(node, next)
    },
  }
}
