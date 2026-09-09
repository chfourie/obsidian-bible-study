// Repo-side runner for IN (book 102): turns the curated Markdown source that
// sits beside the PDF in resources/ into the in-at-e1 book module artifact
// published as a GitHub release. The conversion logic lives in the generic
// scripts/book-pipeline/*.ts (vitest-covered) and the IO glue in
// scripts/book-pipeline/build-book-module.mjs; this file names the book.
//
// Usage:
//   node scripts/build-in-module.mjs [path/to/source.md]

import { buildBookModule } from './book-pipeline/build-book-module.mjs'

await buildBookModule({
  moduleId: 'in-at-e1',
  sourceFile: process.argv[2] ?? 'resources/IN First Edition.md',
  refOverridesFile: 'scripts/in-pipeline/ref-overrides.json',
})
