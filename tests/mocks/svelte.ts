// Test-only stand-in for the svelte runtime entry. Vitest never compiles
// Svelte (components resolve to an inert stub), so mounting is a no-op too;
// specs exercise the models behind the components instead.
export const mount = (): Record<string, unknown> => ({})
export const unmount = (): void => {}
