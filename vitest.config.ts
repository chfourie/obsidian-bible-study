import { defineConfig } from 'vitest/config'
import path from 'node:path'

export default defineConfig({
  resolve: {
    alias: [
      // Svelte components are untested view glue; specs exercise the models
      // behind them, so any .svelte import resolves to an inert stub.
      {
        find: /^.+\.svelte$/,
        replacement: path.resolve(__dirname, 'tests/mocks/svelte-component.ts'),
      },
      { find: 'obsidian', replacement: path.resolve(__dirname, 'tests/mocks/obsidian.ts') },
      { find: 'src', replacement: path.resolve(__dirname, 'src') },
    ],
  },
  test: {
    environment: 'jsdom',
    include: [
      'tests/**/*.test.ts',
      'src/**/*.spec.ts',
      'scripts/**/*.spec.ts',
    ],
    setupFiles: ['tests/setup-globals.ts'],
    globals: false,
  },
})
