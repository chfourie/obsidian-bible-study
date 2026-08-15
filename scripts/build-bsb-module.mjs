// Repo-side BSB pipeline runner (spec §7.1): converts the Berean
// bsb_tables.tsv into the pre-normalized tagged-module artifact that gets
// published as a GitHub release. The conversion logic lives in
// scripts/bsb-pipeline/*.ts (vitest-covered); this file is IO glue.
//
// Usage:
//   node scripts/build-bsb-module.mjs [path/to/bsb_tables.tsv]
// Without an argument the TSV is fetched from bereanbible.com.

import { build } from 'esbuild'
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { pathToFileURL } from 'node:url'

const TSV_URL = 'https://bereanbible.com/bsb_tables.tsv'
const OUT_DIR = 'dist/bsb-module'

const loadPipeline = async () => {
  const outfile = path.join(tmpdir(), `bsb-pipeline-${Date.now()}.mjs`)
  await build({
    entryPoints: ['scripts/bsb-pipeline/build-bsb-artifact.ts'],
    bundle: true,
    platform: 'node',
    format: 'esm',
    outfile,
  })
  const pipeline = await import(pathToFileURL(outfile).href)
  await rm(outfile, { force: true })
  return pipeline
}

const loadTsv = async (tsvPath) => {
  if (tsvPath) return readFile(tsvPath, 'utf8')
  console.log(`Fetching ${TSV_URL} …`)
  const response = await fetch(TSV_URL)
  if (!response.ok) throw new Error(`TSV fetch failed: HTTP ${response.status}`)
  return response.text()
}

const { buildBsbArtifact, sha256Hex } = await loadPipeline()
const tsv = await loadTsv(process.argv[2])
const artifact = buildBsbArtifact(tsv)

const bookCount = Object.keys(artifact.books).length
const verseCount = Object.values(artifact.books).reduce(
  (total, book) => total + Object.keys(book).length,
  0,
)
if (bookCount !== 66) console.warn(`WARNING: expected 66 books, got ${bookCount}`)

const artifactJson = JSON.stringify(artifact)
const checksum = sha256Hex(artifactJson)
await mkdir(OUT_DIR, { recursive: true })
await writeFile(path.join(OUT_DIR, 'bsb-module.json'), artifactJson)
await writeFile(
  path.join(OUT_DIR, 'checksums.json'),
  JSON.stringify({ bsb: checksum }, null, 2),
)

console.log(`Books: ${bookCount}, verses: ${verseCount}`)
console.log(`sha256(bsb-module.json) = ${checksum}`)
console.log(`Artifacts written to ${OUT_DIR}/ — attach both files to the`)
console.log('GitHub release tagged "bsb-module".')
