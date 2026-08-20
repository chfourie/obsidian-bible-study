import type { NavigationOptions } from '../contracts'
import { decodeVerseId, isNonBiblicalBook, type Reference } from '../reference'
import type { IndexBuildProgress } from './search-index-store'
import {
  isEmptyQuery,
  parseSearchQuery,
  type SearchQuery,
} from './search-query'
import {
  bookViews,
  groupHitsByBook,
  type SearchBookGroup,
  type SearchBookView,
  type SearchHitView,
} from './search-results'
import type { SearchHit } from './search-scan'
import {
  hitsInTestament,
  scopeModuleIds,
  type SearchScope,
  type SearchScopeOptions,
  type SearchTranslation,
  type TestamentFilter,
} from './search-scope'

export type SearchPaneDeps = {
  scopeOptions: () => SearchScopeOptions
  scope: () => SearchScope
  chooseScope: (scope: SearchScope) => void
  search: (
    moduleId: string,
    query: SearchQuery,
    onProgress: (progress: IndexBuildProgress) => void,
  ) => Promise<SearchHit[]>
  openHit: (
    reference: Reference,
    translationId: string | null,
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

// One installed Book as the picker shows it: offered whether or not the scope
// currently takes it in.
export type SearchScopeBookView = {
  moduleId: string
  bookId: number
  label: string
  selected: boolean
}

export type SearchScopeView = {
  translations: SearchTranslation[]
  translationId: string | null
  testament: TestamentFilter
  books: SearchScopeBookView[]
}

export type SearchPaneViewState = {
  // What the box holds, which is not what was searched until it is submitted.
  query: string
  status: SearchPaneStatus
  scope: SearchScopeView
  translationLabel: string | null
  // The query the results on screen came from, null while none has run.
  submittedQuery: string | null
  // How far the module's index has been built, only while one is being built,
  // and the module it is being built for.
  indexing: IndexBuildProgress | null
  indexingLabel: string | null
  totalHits: number
  books: SearchBookView[]
}

export class SearchPaneModel {
  #query = ''
  #submittedQuery: string | null = null
  #status: SearchPaneStatus = 'idle'
  #groups: SearchBookGroup[] = []
  // Collapse and expansion live and die with the pane's current results: a new
  // search starts every group open and capped again.
  readonly #collapsedBooks = new Set<number>()
  readonly #expandedBooks = new Set<number>()
  #indexing: IndexBuildProgress | null = null
  #indexingLabel: string | null = null
  #totalHits = 0
  #searchToken = 0
  readonly #listeners = new Set<() => void>()

  constructor(private readonly deps: SearchPaneDeps) {}

  subscribe(listener: () => void): () => void {
    this.#listeners.add(listener)
    return () => this.#listeners.delete(listener)
  }

  get view(): SearchPaneViewState {
    const scope = this.deps.scope()
    return {
      query: this.#query,
      status: this.#status,
      scope: this.#scopeView(scope),
      translationLabel: scope.translation?.label ?? null,
      submittedQuery: this.#submittedQuery,
      indexing: this.#indexing,
      indexingLabel: this.#indexingLabel,
      totalHits: this.#totalHits,
      books: bookViews(this.#groups, this.#collapsedBooks, this.#expandedBooks),
    }
  }

  // Typing alone never searches: the query waits in the box until submitted.
  setQuery(query: string): void {
    if (query === this.#query) return
    this.#query = query
    this.#notify()
  }

  // Exactly one translation is searched, so choosing one replaces the last;
  // an id no longer installed leaves the scope as it stands.
  chooseTranslation(translationId: string): void {
    const translation = this.deps
      .scopeOptions()
      .translations.find((candidate) => candidate.id === translationId)
    if (translation === undefined) return
    this.#chooseScope({ ...this.deps.scope(), translation })
  }

  chooseTestament(testament: TestamentFilter): void {
    this.#chooseScope({ ...this.deps.scope(), testament })
  }

  toggleBook(moduleId: string): void {
    const scope = this.deps.scope()
    const selected = scope.books.some((book) => book.moduleId === moduleId)
    const books = selected
      ? scope.books.filter((book) => book.moduleId !== moduleId)
      : this.deps
          .scopeOptions()
          .books.filter(
            (book) =>
              book.moduleId === moduleId ||
              scope.books.some((chosen) => chosen.moduleId === book.moduleId),
          )
    this.#chooseScope({ ...scope, books })
  }

  async submit(): Promise<void> {
    const token = ++this.#searchToken
    const text = this.#query
    const query = parseSearchQuery(text)
    this.#groups = []
    this.#collapsedBooks.clear()
    this.#expandedBooks.clear()
    this.#totalHits = 0
    if (isEmptyQuery(query)) {
      this.#submittedQuery = null
      this.#settle('idle')
      return
    }
    this.#submittedQuery = text
    const scope = this.deps.scope()
    const moduleIds = scopeModuleIds(scope)
    if (moduleIds.length === 0) {
      this.#settle('no-translation')
      return
    }
    this.#settle('searching')
    const hits: SearchHit[] = []
    for (const moduleId of moduleIds) {
      // A module met without a valid index is built one before it can answer;
      // the pane says so, and how far it has got, until the results land.
      const found = await this.deps.search(moduleId, query, (progress) => {
        if (token !== this.#searchToken) return
        this.#indexing = progress
        this.#indexingLabel = this.#labelOf(scope, moduleId)
        this.#settle('indexing')
      })
      // A submission overtaken while it ran leaves the newer one's results
      // standing.
      if (token !== this.#searchToken) return
      hits.push(...found)
    }
    // Atom ids sort into Canonical Grid order across modules on their own:
    // scripture holds books 1-66 and every Book sits above them.
    const scoped = hitsInTestament(hits, scope.testament).sort(
      (a, b) => a.verseId - b.verseId,
    )
    this.#groups = groupHitsByBook(scoped)
    this.#totalHits = scoped.length
    this.#settle(scoped.length === 0 ? 'no-results' : 'ok')
  }

  toggleBookCollapsed(book: number): void {
    if (this.#collapsedBooks.has(book)) this.#collapsedBooks.delete(book)
    else this.#collapsedBooks.add(book)
    this.#notify()
  }

  expandBookHits(book: number): void {
    this.#expandedBooks.add(book)
    this.#notify()
  }

  // A Book carries its own edition rather than a translation, and the reader
  // resolves it from the paragraph's book number.
  openHit(hit: SearchHitView, options?: NavigationOptions): void {
    const { book } = decodeVerseId(hit.verseId)
    if (isNonBiblicalBook(book)) {
      this.deps.openHit(hit.reference, null, options)
      return
    }
    const translation = this.deps.scope().translation
    if (translation === null) return
    this.deps.openHit(hit.reference, translation.id, options)
  }

  // The searchable modules can change under a live pane — a module installed
  // or removed moves the scope with it. Results already on screen came from
  // the modules they named and stay as they are.
  refresh(): void {
    this.#notify()
  }

  #scopeView(scope: SearchScope): SearchScopeView {
    return {
      translations: this.deps.scopeOptions().translations,
      translationId: scope.translation?.id ?? null,
      testament: scope.testament,
      books: this.deps.scopeOptions().books.map((book) => ({
        ...book,
        selected: scope.books.some(
          (chosen) => chosen.moduleId === book.moduleId,
        ),
      })),
    }
  }

  #labelOf(scope: SearchScope, moduleId: string): string | null {
    if (scope.translation?.id === moduleId) return scope.translation.label
    return (
      scope.books.find((book) => book.moduleId === moduleId)?.label ?? null
    )
  }

  #chooseScope(scope: SearchScope): void {
    this.deps.chooseScope(scope)
    this.#notify()
  }

  #settle(status: SearchPaneStatus): void {
    if (status !== 'indexing') {
      this.#indexing = null
      this.#indexingLabel = null
    }
    this.#status = status
    this.#notify()
  }

  #notify(): void {
    this.#listeners.forEach((listener) => listener())
  }
}
