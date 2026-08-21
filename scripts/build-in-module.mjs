// Repo-side runner for IN (book 102): turns the curated Markdown source that
// sits beside the PDF in resources/ into the in-at-e1 book module artifact
// published as a GitHub release. The conversion logic lives in the generic
// scripts/book-pipeline/*.ts (vitest-covered); this file is IO glue.
//
// Usage:
//   node scripts/build-in-module.mjs [path/to/source.md]

import { build } from 'esbuild'
import { mkdir, readdir, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { pathToFileURL } from 'node:url'

const MODULE_ID = 'in-at-e1'
const SOURCE_FILE = 'resources/IN First Edition.md'
const OUT_DIR = `dist/${MODULE_ID}-module`
const ARTIFACT_FILE = `${MODULE_ID}-module.json`
const REGISTRY_FILE = 'scripts/book-registry.json'
const REF_OVERRIDES_FILE = 'scripts/in-pipeline/ref-overrides.json'

const loadPipeline = async () => {
  const outfile = path.join(tmpdir(), `book-pipeline-${Date.now()}.mjs`)
  await build({
    entryPoints: ['scripts/book-pipeline/build-book-artifact.ts'],
    bundle: true,
    platform: 'node',
    format: 'esm',
    outfile,
  })
  const pipeline = await import(pathToFileURL(outfile).href)
  await rm(outfile, { force: true })
  return pipeline
}

const {
  buildBookArtifact,
  parseBookRegistry,
  parseRefOverrides,
  refSpanCounts,
  sha256Hex,
} = await loadPipeline()

// A figure's image is read from beside the source it is written relative to,
// and travels inside the module as a data URI (spec-books §9): an installed
// Book carries its own pictures and reads no file of its own.
const IMAGE_TYPES = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
}

const imagesUnder = async (dir, prefix = '') => {
  const entries = await readdir(dir, { withFileTypes: true }).catch(() => [])
  const images = {}
  for (const entry of entries) {
    const at = `${prefix}${entry.name}`
    if (entry.isDirectory()) {
      Object.assign(images, await imagesUnder(path.join(dir, entry.name), `${at}/`))
      continue
    }
    const type = IMAGE_TYPES[path.extname(entry.name).toLowerCase()]
    if (type === undefined) continue
    const bytes = await readFile(path.join(dir, entry.name))
    images[at] = `data:${type};base64,${bytes.toString('base64')}`
  }
  return images
}

const sourceFile = process.argv[2] ?? SOURCE_FILE
const source = await readFile(sourceFile, 'utf8')
const images = await imagesUnder(path.dirname(sourceFile))
const registry = parseBookRegistry(await readFile(REGISTRY_FILE, 'utf8'))
const refOverrides = parseRefOverrides(
  await readFile(REF_OVERRIDES_FILE, 'utf8'),
)
const artifact = buildBookArtifact(source, registry, refOverrides, images)

// The registry records the work the curated source was made from, so a PDF
// that is present must be the one the grid was curated against.
const provenance = registry.find((entry) => entry.moduleId === MODULE_ID)
const pdf = await readFile(path.join('resources', provenance.source)).catch(
  () => null,
)
if (pdf !== null) {
  const actual = sha256Hex(pdf)
  if (actual !== provenance.sourceChecksum)
    throw new Error(
      `${provenance.source} is sha256 ${actual}, but the registry records ` +
        `${provenance.sourceChecksum}`,
    )
}

const artifactJson = JSON.stringify(artifact)
const checksum = sha256Hex(artifactJson)
await mkdir(OUT_DIR, { recursive: true })
await writeFile(path.join(OUT_DIR, ARTIFACT_FILE), artifactJson)
await writeFile(
  path.join(OUT_DIR, 'checksums.json'),
  JSON.stringify({ [artifact.manifest.id]: checksum }, null, 2),
)

const { sections } = artifact.manifest.book
const paragraphCount = sections.reduce(
  (total, section) => total + section.paragraphs,
  0,
)
const refSpans = refSpanCounts(artifact)
for (const section of sections) {
  const chapter = String(section.chapter).padStart(2)
  const paragraphs = String(section.paragraphs).padStart(3)
  const refs = String(refSpans.get(section.chapter)).padStart(3)
  console.log(`  ${chapter}  ${paragraphs}  ${refs} refs  ${section.name}`)
}
const refSpanCount = [...refSpans.values()].reduce(
  (total, refs) => total + refs,
  0,
)
console.log(`Sections: ${sections.length}, paragraphs: ${paragraphCount}`)
console.log(
  `Ref spans: ${refSpanCount} ` +
    `(${refOverrides.fix.length} fixed, ${refOverrides.suppress.length} suppressed)`,
)
const figures = Object.values(artifact.books[artifact.manifest.book.number])
  .flatMap((paragraph) => paragraph.figures ?? [])
console.log(
  `Figures: ${figures.length}, module ${(artifactJson.length / 1024 / 1024).toFixed(2)} MB`,
)
console.log(`sha256(${ARTIFACT_FILE}) = ${checksum}`)
console.log(`Artifacts written to ${OUT_DIR}/ — attach both files to the`)
console.log(`GitHub release tagged "${MODULE_ID}-module".`)
