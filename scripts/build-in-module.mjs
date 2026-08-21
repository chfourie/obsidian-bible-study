// Repo-side runner for IN (book 102): turns the curated Markdown source that
// sits beside the PDF in resources/ into the in-at-e1 book module artifact
// published as a GitHub release. The conversion logic lives in the generic
// scripts/book-pipeline/*.ts (vitest-covered); this file is IO glue.
//
// Usage:
//   node scripts/build-in-module.mjs [path/to/source.md]

import { build } from 'esbuild'
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises'
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

const source = await readFile(process.argv[2] ?? SOURCE_FILE, 'utf8')
const registry = parseBookRegistry(await readFile(REGISTRY_FILE, 'utf8'))
const refOverrides = parseRefOverrides(
  await readFile(REF_OVERRIDES_FILE, 'utf8'),
)
const artifact = buildBookArtifact(source, registry, refOverrides)

// The registry records the work the curated source was made from, so a PDF
// that is present must be the one the grid was curated against.
const provenance = registry.find((entry) => entry.moduleId === MODULE_ID)
const pdf = await readFile(path.join('resources', provenance.source)).catch(
  () => null,
)
if (pdf !== null && sha256Hex(pdf.toString('binary')) !== provenance.sourceChecksum) {
  const { createHash } = await import('node:crypto')
  const actual = createHash('sha256').update(pdf).digest('hex')
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
console.log(`sha256(${ARTIFACT_FILE}) = ${checksum}`)
console.log(`Artifacts written to ${OUT_DIR}/ — attach both files to the`)
console.log(`GitHub release tagged "${MODULE_ID}-module".`)
