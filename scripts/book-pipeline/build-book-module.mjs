// The IO glue every Book's thin build script shares: read the curated
// Markdown source, its registry entry, its ref overrides and the images
// beside it; build the artifact through the vitest-covered pipeline; write
// dist/<module-id>-module/ and print the per-section counts the maintainer
// reviews before the release that freezes the grid.

import { build } from 'esbuild'
import { mkdir, readdir, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { pathToFileURL } from 'node:url'

const REGISTRY_FILE = 'scripts/book-registry.json'

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

// The registry records the work the curated source was made from, so a
// provenance file that is present must be the one the grid was curated
// against.
const assertProvenance = async (provenance, sha256Hex) => {
  const file = await readFile(path.join('resources', provenance.source)).catch(
    () => null,
  )
  if (file === null) return
  const actual = sha256Hex(file)
  if (actual !== provenance.sourceChecksum)
    throw new Error(
      `${provenance.source} is sha256 ${actual}, but the registry records ` +
        `${provenance.sourceChecksum}`,
    )
}

export const buildBookModule = async ({
  moduleId,
  sourceFile,
  refOverridesFile,
}) => {
  const outDir = `dist/${moduleId}-module`
  const artifactFile = `${moduleId}-module.json`
  const {
    buildBookArtifact,
    curationWaivers,
    notesToCurate,
    parseBookRegistry,
    parseRefOverrides,
    refSpanCounts,
    sha256Hex,
  } = await loadPipeline()

  const source = await readFile(sourceFile, 'utf8')
  const images = await imagesUnder(path.dirname(sourceFile))
  const registry = parseBookRegistry(await readFile(REGISTRY_FILE, 'utf8'))
  const refOverrides = parseRefOverrides(await readFile(refOverridesFile, 'utf8'))
  const artifact = buildBookArtifact(source, registry, refOverrides, images)
  await assertProvenance(
    registry.find((entry) => entry.moduleId === moduleId),
    sha256Hex,
  )

  const artifactJson = JSON.stringify(artifact)
  const checksum = sha256Hex(artifactJson)
  await mkdir(outDir, { recursive: true })
  await writeFile(path.join(outDir, artifactFile), artifactJson)
  await writeFile(
    path.join(outDir, 'checksums.json'),
    JSON.stringify({ [artifact.manifest.id]: checksum }, null, 2),
  )

  const { atom = 'paragraph', sections } = artifact.manifest.book
  const atomLabel = atom === 'verse' ? 'verses' : 'paragraphs'
  const atomCount = sections.reduce(
    (total, section) => total + section.paragraphs,
    0,
  )
  const refSpans = refSpanCounts(artifact)
  for (const section of sections) {
    const chapter = String(section.chapter).padStart(3)
    const atoms = String(section.paragraphs).padStart(3)
    const refs = String(refSpans.get(section.chapter)).padStart(3)
    const reading = section.reading === undefined ? '' : '  (page-order reading)'
    console.log(`  ${chapter}  ${atoms}  ${refs} refs  ${section.name}${reading}`)
  }
  const refSpanCount = [...refSpans.values()].reduce(
    (total, refs) => total + refs,
    0,
  )
  console.log(`Sections: ${sections.length}, ${atomLabel}: ${atomCount}`)
  console.log(
    `Ref spans: ${refSpanCount} ` +
      `(${refOverrides.fix.length} fixed, ${refOverrides.suppress.length} suppressed)`,
  )
  const figures = Object.values(artifact.books[artifact.manifest.book.number])
    .flatMap((paragraph) => paragraph.figures ?? [])
  console.log(
    `Figures: ${figures.length}, module ${(artifactJson.length / 1024 / 1024).toFixed(2)} MB`,
  )
  console.log(`sha256(${artifactFile}) = ${checksum}`)
  console.log(`Artifacts written to ${outDir}/ — attach both files to the`)
  console.log(`GitHub release tagged "${moduleId}-module".`)
  // The curation to-do, never a gate (spec-books §2): the notes are curated
  // over releases and the grid ships with the ones already written.
  const toCurate = notesToCurate(artifact, curationWaivers(source))
  if (toCurate.length > 0) {
    console.warn(`Footnotes to curate: ${toCurate.length}`)
    for (const atom of toCurate) console.warn(`  ${atom}`)
  }
}
