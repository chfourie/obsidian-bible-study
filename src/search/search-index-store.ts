import type { ModuleManifest } from '../modules'
import {
  buildSearchIndex,
  isCurrentSearchIndex,
  type SearchIndex,
} from './search-index'
import {
  bookAtoms,
  type ModuleAtom,
  type SearchContentSource,
} from './search-scan'

// Where a module's index file lives. ModuleStore satisfies it by keeping the
// file inside the module's own directory, so installing over a module or
// deleting it takes the index with it.
export type SearchIndexFileStore = {
  readSearchIndex: (moduleId: string) => Promise<string | null>
  writeSearchIndex: (moduleId: string, content: string) => Promise<void>
}

// Everything the index needs of module storage: the content to index, the
// checksum that stamps it, and the file it is kept in.
export type SearchIndexSource = SearchContentSource &
  SearchIndexFileStore & {
    manifest: (moduleId: string) => Promise<ModuleManifest | null>
  }

// How far a build has read through the module's books — what the pane shows
// while a module is being indexed for the first time.
export type IndexBuildProgress = {
  done: number
  total: number
}

// A module with no manifest is not installed; it indexes as nothing, and the
// empty stamp is replaced the moment a real manifest turns up.
const moduleChecksum = async (
  source: SearchIndexSource,
  moduleId: string,
): Promise<string> =>
  (await source.manifest(moduleId))?.sourceChecksum ?? ''

const parseSearchIndex = (content: string): SearchIndex | null => {
  try {
    const index = JSON.parse(content) as SearchIndex
    return Array.isArray(index.terms) && Array.isArray(index.verseIds)
      ? index
      : null
  } catch {
    return null
  }
}

// The persisted index for this module, or null when there is none to trust —
// unreadable, written in an older format, or built from content the module no
// longer holds. Every one of those means a whole rebuild.
export const loadSearchIndex = async (
  source: SearchIndexSource,
  moduleId: string,
  sourceChecksum: string,
): Promise<SearchIndex | null> => {
  const content = await source.readSearchIndex(moduleId)
  if (content === null) return null
  const index = parseSearchIndex(content)
  if (index === null) return null
  return isCurrentSearchIndex(index, sourceChecksum) ? index : null
}

// The one way an index comes into existence: read the module's books in the
// order given, index every atom, persist the result. The lazy path calls it on
// the first search that meets an unindexed module; installing a module will
// call the very same function.
export const buildAndPersistSearchIndex = async (
  source: SearchIndexSource,
  moduleId: string,
  books: readonly number[],
  onProgress?: (progress: IndexBuildProgress) => void,
): Promise<SearchIndex> => {
  const atoms: ModuleAtom[] = []
  for (const [done, book] of books.entries()) {
    onProgress?.({ done, total: books.length })
    const content = await source.bookContent(moduleId, book)
    if (content !== null) atoms.push(...bookAtoms(content))
  }
  onProgress?.({ done: books.length, total: books.length })
  const index = buildSearchIndex(atoms, await moduleChecksum(source, moduleId))
  await source.writeSearchIndex(moduleId, JSON.stringify(index))
  return index
}
