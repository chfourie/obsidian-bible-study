// ESLint flat config — Obsidian community-plugin guideline linter.
//
// `eslint-plugin-obsidianmd` is the same ruleset the Obsidian community
// review scanner runs against a submitted plugin. Keeping it wired into the
// repo (`npm run lint`) lets us reproduce the scanner's findings locally
// instead of discovering them only after a release is scanned.
import tsparser from '@typescript-eslint/parser'
import { defineConfig } from 'eslint/config'
import obsidianmd from 'eslint-plugin-obsidianmd'
import svelteParser from 'svelte-eslint-parser'
import tseslint from 'typescript-eslint'

export default defineConfig([
  {
    ignores: [
      'main.js',
      'node_modules/',
      '.claude/',
      'docs/',
      'tests/',
      'scripts/',
      '*.mjs',
      'vitest.config.ts',
    ],
  },
  ...obsidianmd.configs.recommended,
  {
    files: ['src/**/*.ts'],
    languageOptions: {
      parser: tsparser,
      parserOptions: { project: './tsconfig.json' },
    },
  },
  // Svelte components get the obsidianmd ruleset too (prefer-active-doc,
  // restricted imports, …). Type information comes from tsconfig.eslint.json
  // (= tsconfig.json + the .svelte files), which only ESLint reads — the
  // build's `tsc -noEmit` keeps using tsconfig.json and never sees .svelte.
  {
    files: ['src/**/*.svelte'],
    languageOptions: {
      parser: svelteParser,
      parserOptions: {
        parser: tsparser,
        project: './tsconfig.eslint.json',
        extraFileExtensions: ['.svelte'],
      },
    },
    // Same plugin object the obsidianmd config registers for `**/*.ts` —
    // those blocks don't match `.svelte`, so it must be (re-)declared here.
    plugins: { '@typescript-eslint': tseslint.plugin },
    rules: {
      // The core no-undef / no-unused-vars rules don't understand TS
      // syntax (runes, type-annotation parameter names, ambient globals
      // like activeDocument) — disable them in favour of the TS-aware
      // replacement, exactly as typescript-eslint does for `.ts`.
      'no-undef': 'off',
      'no-unused-vars': 'off',
      '@typescript-eslint/no-unused-vars': ['warn', { args: 'none' }],
    },
  },
  {
    files: ['src/**/*.{ts,svelte}'],
    rules: {
      // Sentence case is right for prose and wrong for proper names. Keep
      // `enforceCamelCaseLower` from the upstream options; re-declaring a
      // rule replaces its options wholesale.
      'obsidianmd/ui/sentence-case': [
        'warn',
        {
          enforceCamelCaseLower: true,
          ignoreRegex: [
            // The plugin's own name as it appears in manifest.json.
            '\\bScripture Study\\b',
            // Proper names on the settings surface.
            '\\bAPI\\.Bible\\b',
            "\\bStrong's\\b",
            // Letter names in the annotation-ordering option.
            '\\bA to Z\\b',
          ],
        },
      ],
    },
  },
  {
    // Colocated contract specs run under Vitest + jsdom, where Obsidian's
    // `createEl`/`createSpan` prototype extensions don't exist — the rule's
    // suggested replacements would throw. Plain DOM construction is correct
    // here; the rule still guards every shipped module.
    files: ['src/**/*.spec.ts'],
    rules: {
      'obsidianmd/prefer-create-el': 'off',
      // Specs build static DOM fixtures from literals; there is no
      // untrusted input to sanitize.
      '@microsoft/sdl/no-inner-html': 'off',
      // Specs run under Vitest on Node — fixture files and hashes may use
      // Node built-ins that shipped plugin code must avoid.
      'obsidianmd/no-nodejs-modules': 'off',
    },
  },
])
