import { BOOK_COUNT } from '../reference'
import {
  CONCORDANCE_INDEX_VERSION,
  buildConcordanceIndex,
} from './concordance-index'
import {
  MODULE_FORMAT_VERSION,
  TRANSLATION_CONTENT_VERSION,
  isTranslationManifest,
  type ModuleManifest,
} from './module-manifest'
import type { ModuleStore } from './module-store'
import type { BookContent } from './normalized-module'

const storedBooks = async (
  store: ModuleStore,
  moduleId: string,
): Promise<Map<number, BookContent>> => {
  const books = new Map<number, BookContent>()
  for (let book = 1; book <= BOOK_COUNT; book += 1) {
    const content = await store.bookContent(moduleId, book)
    if (content !== null) books.set(book, content)
  }
  return books
}

const reindex = async (
  store: ModuleStore,
  manifest: ModuleManifest,
): Promise<void> => {
  await store.saveConcordance(
    manifest.id,
    buildConcordanceIndex(await storedBooks(store, manifest.id)),
  )
  if (manifest.formatVersion < TRANSLATION_CONTENT_VERSION) return
  await store.saveManifest({
    ...manifest,
    formatVersion: MODULE_FORMAT_VERSION,
  })
}

// A Tagged Translation carries every tag its index is made of, so a bump that
// changes only the index — its arrival, and later its occurrence counts — is
// served by re-indexing on the spot: no download, and nothing for the reader to
// notice.
export const reindexConcordances = async (store: ModuleStore): Promise<void> => {
  for (const manifest of await store.installedManifests()) {
    if (!isTranslationManifest(manifest)) continue
    if (!manifest.capabilities.strongsTagged) continue
    const stored = await store.concordanceVersion(manifest.id)
    if (stored === CONCORDANCE_INDEX_VERSION) continue
    await reindex(store, manifest)
  }
}
