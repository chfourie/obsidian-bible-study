// From the file rather than the modules barrel: the barrel pulls in the plugin
// features, and nothing here may reach Obsidian.
import { isBookManifest, type ModuleManifest } from '../modules/module-manifest'
import {
  isCurrentSearchIndex,
  searchIndex,
  type SearchIndex,
} from './search-index'
import {
  buildAndPersistSearchIndex,
  loadSearchIndex,
  type IndexBuildProgress,
  type SearchIndexSource,
} from './search-index-store'
import { isEmptyQuery, type SearchQuery } from './search-query'
import type { SearchHit } from './search-scan'

// Every search a module answers goes through its index: loaded from beside the
// module's content, or built there and then the first time a query meets a
// module without a valid one. Once loaded it stays in memory for as long as
// the plugin runs, re-stamped against the manifest on every search so a module
// downloaded again is noticed.
export class SearchEngine {
  readonly #loaded = new Map<string, SearchIndex>()

  constructor(
    private readonly source: SearchIndexSource,
    private readonly scriptureBooks: readonly number[],
  ) {}

  async search(
    moduleId: string,
    query: SearchQuery,
    onProgress?: (progress: IndexBuildProgress) => void,
  ): Promise<SearchHit[]> {
    if (isEmptyQuery(query)) return []
    const index = await this.#index(moduleId, onProgress)
    return index === null ? [] : searchIndex(index, query)
  }

  // A module with no manifest is not installed: nothing to index, and no index
  // file left behind for it.
  async #index(
    moduleId: string,
    onProgress?: (progress: IndexBuildProgress) => void,
  ): Promise<SearchIndex | null> {
    const manifest = await this.source.manifest(moduleId)
    if (manifest === null) return null
    const checksum = manifest.sourceChecksum
    const loaded = this.#loaded.get(moduleId)
    if (loaded !== undefined && isCurrentSearchIndex(loaded, checksum))
      return loaded
    const index =
      (await loadSearchIndex(this.source, moduleId, checksum)) ??
      (await buildAndPersistSearchIndex(
        this.source,
        moduleId,
        this.#booksOf(manifest),
        onProgress,
      ))
    this.#loaded.set(moduleId, index)
    return index
  }

  // A Book module holds one book and nothing else, so its index is built over
  // that book alone; a translation is built over the Canonical Grid's.
  #booksOf(manifest: ModuleManifest): readonly number[] {
    return isBookManifest(manifest)
      ? [manifest.book.number]
      : this.scriptureBooks
  }
}
