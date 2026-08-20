import type { NavigationOptions } from '../contracts'
import type { Reference } from '../reference'
import type { IndexBuildProgress } from './search-index-store'
import {
  isEmptyQuery,
  parseSearchQuery,
  type SearchQuery,
} from './search-query'
import {
  groupHitsByBook,
  type SearchBookView,
  type SearchHitView,
} from './search-results'
import type { SearchHit } from './search-scan'

// The module one query runs against, named as the pane shows it. The scope
// picker will choose it; for now it is the Fallback Translation.
export type SearchTranslation = {
  id: string
  label: string
}

export type SearchPaneDeps = {
  translation: () => SearchTranslation | null
  search: (
    moduleId: string,
    query: SearchQuery,
    onProgress: (progress: IndexBuildProgress) => void,
  ) => Promise<SearchHit[]>
  openHit: (
    reference: Reference,
    translationId: string,
    options?: NavigationOptions,
  ) => void
}

export type SearchPaneStatus =
  | 'idle'
  | 'searching'
  | 'indexing'
  | 'no-translation'
  | 'no-results'
  | 'ok'

export type SearchPaneViewState = {
  // What the box holds, which is not what was searched until it is submitted.
  query: string
  status: SearchPaneStatus
  translationLabel: string | null
  // The query the results on screen came from, null while none has run.
  submittedQuery: string | null
  // How far the module's index has been built, only while one is being built.
  indexing: IndexBuildProgress | null
  totalHits: number
  books: SearchBookView[]
}

export class SearchPaneModel {
  #query = ''
  #submittedQuery: string | null = null
  #status: SearchPaneStatus = 'idle'
  #books: SearchBookView[] = []
  #indexing: IndexBuildProgress | null = null
  #totalHits = 0
  #searchToken = 0
  readonly #listeners = new Set<() => void>()

  constructor(private readonly deps: SearchPaneDeps) {}

  subscribe(listener: () => void): () => void {
    this.#listeners.add(listener)
    return () => this.#listeners.delete(listener)
  }

  get view(): SearchPaneViewState {
    return {
      query: this.#query,
      status: this.#status,
      translationLabel: this.deps.translation()?.label ?? null,
      submittedQuery: this.#submittedQuery,
      indexing: this.#indexing,
      totalHits: this.#totalHits,
      books: this.#books,
    }
  }

  // Typing alone never searches: the query waits in the box until submitted.
  setQuery(query: string): void {
    if (query === this.#query) return
    this.#query = query
    this.#notify()
  }

  async submit(): Promise<void> {
    const token = ++this.#searchToken
    const text = this.#query
    const query = parseSearchQuery(text)
    this.#books = []
    this.#totalHits = 0
    if (isEmptyQuery(query)) {
      this.#submittedQuery = null
      this.#settle('idle')
      return
    }
    this.#submittedQuery = text
    const translation = this.deps.translation()
    if (translation === null) {
      this.#settle('no-translation')
      return
    }
    this.#settle('searching')
    // A module met without a valid index is built one before it can answer;
    // the pane says so, and how far it has got, until the results land.
    const hits = await this.deps.search(translation.id, query, (progress) => {
      if (token !== this.#searchToken) return
      this.#indexing = progress
      this.#settle('indexing')
    })
    // A submission overtaken while it ran leaves the newer one's results
    // standing.
    if (token !== this.#searchToken) return
    this.#books = groupHitsByBook(hits)
    this.#totalHits = hits.length
    this.#settle(hits.length === 0 ? 'no-results' : 'ok')
  }

  openHit(hit: SearchHitView, options?: NavigationOptions): void {
    const translation = this.deps.translation()
    if (translation === null) return
    this.deps.openHit(hit.reference, translation.id, options)
  }

  // The searchable module can change under a live pane — a module installed
  // or removed moves the Fallback Translation. Results already on screen came
  // from the module they named and stay as they are.
  refresh(): void {
    this.#notify()
  }

  #settle(status: SearchPaneStatus): void {
    if (status !== 'indexing') this.#indexing = null
    this.#status = status
    this.#notify()
  }

  #notify(): void {
    this.#listeners.forEach((listener) => listener())
  }
}
