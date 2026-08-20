// Repo-side Humility pipeline runner (spec-books §7): converts the Project
// Gutenberg #57121 plain text into the hum-m1895 book module artifact that
// gets published as a GitHub release. The conversion logic lives in
// scripts/humility-pipeline/*.ts (vitest-covered); this file is IO glue.
//
// Usage:
//   node scripts/build-humility-module.mjs [path/to/pg57121.txt]
// Without an argument the source path comes from HUMILITY_SOURCE, and
// without that the text is fetched from gutenberg.org.

import { build } from 'esbuild'
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { pathToFileURL } from 'node:url'

const SOURCE_URL = 'https://www.gutenberg.org/cache/epub/57121/pg57121.txt'
const OUT_DIR = 'dist/hum-m1895-module'
const ARTIFACT_FILE = 'hum-m1895-module.json'
const REGISTRY_FILE = 'scripts/book-registry.json'

const loadPipeline = async () => {
  const outfile = path.join(tmpdir(), `humility-pipeline-${Date.now()}.mjs`)
  await build({
    entryPoints: ['scripts/humility-pipeline/build-humility-artifact.ts'],
    bundle: true,
    platform: 'node',
    format: 'esm',
    outfile,
  })
  const pipeline = await import(pathToFileURL(outfile).href)
  await rm(outfile, { force: true })
  return pipeline
}

const loadSource = async (sourcePath) => {
  if (sourcePath) return readFile(sourcePath, 'utf8')
  console.log(`Fetching ${SOURCE_URL} …`)
  const response = await fetch(SOURCE_URL)
  if (!response.ok)
    throw new Error(`Source fetch failed: HTTP ${response.status}`)
  return response.text()
}

const { buildHumilityArtifact, parseBookRegistry, sha256Hex } =
  await loadPipeline()

const source = await loadSource(process.argv[2] ?? process.env.HUMILITY_SOURCE)
const registry = parseBookRegistry(await readFile(REGISTRY_FILE, 'utf8'))
const artifact = buildHumilityArtifact(source, registry)

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
for (const section of sections) {
  const chapter = String(section.chapter).padStart(2)
  const paragraphs = String(section.paragraphs).padStart(3)
  console.log(`  ${chapter}  ${paragraphs}  ${section.name}`)
}
console.log(`Sections: ${sections.length}, paragraphs: ${paragraphCount}`)
console.log(`sha256(${ARTIFACT_FILE}) = ${checksum}`)
console.log(`Artifacts written to ${OUT_DIR}/ — attach both files to the`)
console.log('GitHub release tagged "hum-m1895-module".')
