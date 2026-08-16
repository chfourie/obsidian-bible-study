// Maps Enter/Space to a click handler for keyboard-accessible menu items and
// link-styled spans across the plugin's Svelte components.
export const activate =
  (handler: () => void) =>
  (event: KeyboardEvent): void => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      handler()
    }
  }
