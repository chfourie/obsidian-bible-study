// Test-only stand-in for any imported .svelte component. Vitest never
// compiles Svelte; specs exercise the models behind the components instead.
export default function MockSvelteComponent(): void {}
