// Repo-side runner for 1 Enoch (book 103): turns the curated Markdown source
// that sits beside the Project Gutenberg #77935 text in resources/ into the
// 1en-c1912 book module artifact published as a GitHub release. The
// conversion logic lives in the generic scripts/book-pipeline/*.ts
// (vitest-covered) and the IO glue in
// scripts/book-pipeline/build-book-module.mjs; this file names the book.
//
// Usage:
//   node scripts/build-enoch-module.mjs [path/to/source.md]

import { buildBookModule } from './book-pipeline/build-book-module.mjs'

await buildBookModule({
  moduleId: '1en-c1912',
  sourceFile: process.argv[2] ?? 'resources/1 Enoch Charles 1912.md',
  refOverridesFile: 'scripts/enoch-pipeline/ref-overrides.json',
})
