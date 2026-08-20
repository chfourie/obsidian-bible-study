import {
  NO_WORD_STUDY,
  NOOP_REFERENCE_NAVIGATOR,
  type NavigationOptions,
  type ReferenceNavigator,
  type StrongsEntryView,
  type WordStudyOpener,
} from '../contracts'
import {
  bookName,
  decodeVerseId,
  referenceLabel,
  type Reference,
} from '../reference'

// All the panel asks of the reference-navigation seam: an occurrence row
// walks exactly the way a Ref Span does.
export type WordStudyNavigator = Pick<ReferenceNavigator, 'openReference'>

// One extended number's dictionary entry as the panel studies it: the entry
// itself, the rest of its Strong's Family, and the Strong's 1890 derivation
// the brief lexicons carry none of.
export type WordStudyEntry = {
  entry: StrongsEntryView
  siblings: string[]
  derivation: string | null
}

// The Strong's Dictionaries seen from the Word Study Panel: one entry per
// extended number, and the install the panel offers while the module is
// missing. Lookups are per number rather than per family — only the
// concordance below matches at family granularity.
export type WordStudyDictionary = {
  installed: () => Promise<boolean>
  entryFor: (strongsNumber: string) => Promise<WordStudyEntry | null>
  install: () => Promise<void>
  attribution: string
  // Named separately because it belongs on screen only where a derivation is.
  etymologyAttribution: string
}

// Stands in when the panel runs without the dictionaries wired up: every
// number degrades to the install affordance, which installs nothing.
export const INERT_WORD_STUDY_DICTIONARY: WordStudyDictionary = {
  installed: async () => false,
  entryFor: async () => null,
  install: async () => {},
  attribution: '',
  etymologyAttribution: '',
}

// The Tagged Translation one concordance reads. The id is the translation's
// own code, which is what the occurrence count is named with.
export type ConcordanceTranslation = { id: string; name: string }

// One stretch of an occurrence's verse text: the words the family is tagged
// on stand emphasized, the rest reads plainly.
export type ConcordanceSegment = { text: string; emphasis: boolean }

export type ConcordanceVerse = {
  verseId: number
  segments: ConcordanceSegment[]
}

// The Concordance Indexes seen from the Word Study Panel: which translation a
// panel reads, the verses one family is tagged in there, and the rendering of
// as many of them as the reader has actually opened.
export type WordStudyConcordance = {
  translationFor: (
    preferredId: string | null,
  ) => Promise<ConcordanceTranslation | null>
  occurrences: (
    translationId: string,
    strongsNumber: string,
  ) => Promise<number[]>
  versesFor: (
    translationId: string,
    strongsNumber: string,
    verseIds: number[],
  ) => Promise<ConcordanceVerse[]>
}

// Stands in when the panel runs without any concordance wired up: no
// translation, so the panel simply carries no occurrence list.
export const INERT_WORD_STUDY_CONCORDANCE: WordStudyConcordance = {
  translationFor: async () => null,
  occurrences: async () => [],
  versesFor: async () => [],
}

export type WordStudyDeps = {
  dictionary: WordStudyDictionary
  concordance?: WordStudyConcordance
  // How the panel's own links walk: the same opener the Study Panel's entry
  // cards use, so a plain activation retargets and a modified one spawns.
  opener?: WordStudyOpener
  // Where an occurrence row leads: the same seam a Ref Span navigates by.
  navigator?: WordStudyNavigator
}

// A derivation as the panel renders it: plain stretches of text, and the
// Strong's Numbers it cites, which are walkable.
export type EtymologySegment = { text: string; number: string | null }

const CITATION = /[HG]\d{4}[A-Za-z]?/g

const etymologyOf = (derivation: string | null): EtymologySegment[] | null => {
  if (derivation === null || derivation === '') return null
  const segments: EtymologySegment[] = []
  let read = 0
  for (const citation of derivation.matchAll(CITATION)) {
    const at = citation.index
    if (at > read) segments.push({ text: derivation.slice(read, at), number: null })
    segments.push({ text: citation[0], number: citation[0] })
    read = at + citation[0].length
  }
  if (read < derivation.length)
    segments.push({ text: derivation.slice(read), number: null })
  return segments
}

export type WordStudyStatus =
  // A panel restored without a number, or one never given one.
  | 'empty'
  | 'loading'
  | 'ok'
  // The number is well-formed but the dictionaries carry no entry for it.
  | 'no-entry'
  // The Strong's Dictionaries module is not installed — as after a layout
  // restore on a vault that never had it.
  | 'no-dictionary'

// The install the panel offers in place of the dictionary area, non-null
// exactly while the status is 'no-dictionary'.
export type WordStudyInstall = { busy: boolean; error: string | null }

export type ConcordanceVerseView = ConcordanceVerse & { reference: string }

// One book's share of the occurrences. Collapsed until the reader asks for it
// — a family like H3068 runs to thousands of verses, so rows are rendered a
// book at a time and never before they are wanted.
export type ConcordanceBookView = {
  book: number
  name: string
  count: number
  expanded: boolean
  // Null until this book's expansion has loaded its rows.
  verses: ConcordanceVerseView[] | null
}

export type ConcordanceView = {
  translation: ConcordanceTranslation
  total: number
  // The section heading: the count, named with the translation it counts in.
  label: string
  // True while the number under study shares its family with other entries:
  // the tagging cannot tell them apart, so the occurrences cover them all.
  familyUndifferentiated: boolean
  books: ConcordanceBookView[]
}

export type WordStudyViewState = {
  number: string | null
  // Names the tab: the number under study, until there is one.
  title: string
  status: WordStudyStatus
  entry: StrongsEntryView | null
  // The rest of the entry's Strong's Family, each one walkable.
  siblings: string[]
  // Non-null exactly while the 1890 dictionary states a derivation for the
  // number under study.
  etymology: EtymologySegment[] | null
  attribution: string | null
  etymologyAttribution: string | null
  install: WordStudyInstall | null
  // The family's occurrences in one Tagged Translation, or null while no
  // tagged translation is installed to count them in.
  concordance: ConcordanceView | null
}

const UNTITLED = 'Word study'

// How a panel is opened: the number, and the translation the tapped word came
// from, which is the concordance it reads unless that translation is not one.
export type WordStudyTarget = { translationId?: string | null }

const occurrenceLabel = (total: number, translationId: string): string => {
  const translation = translationId.toUpperCase()
  if (total === 0) return `No occurrences in ${translation}`
  if (total === 1) return `1 occurrence in ${translation}`
  return `${total.toLocaleString('en-US')} occurrences in ${translation}`
}

const verseReference = (verseId: number): Reference => ({
  book: decodeVerseId(verseId).book,
  ranges: [{ startId: verseId, endId: verseId }],
})

// One book's occurrences, held apart from the view so an expansion renders
// rows for that book alone.
type ConcordanceBook = {
  book: number
  verseIds: number[]
  expanded: boolean
  verses: ConcordanceVerseView[] | null
}

type LoadedConcordance = {
  translation: ConcordanceTranslation
  total: number
  books: ConcordanceBook[]
}

const groupByBook = (verseIds: number[]): ConcordanceBook[] => {
  const books = new Map<number, number[]>()
  for (const verseId of verseIds) {
    const book = decodeVerseId(verseId).book
    books.set(book, [...(books.get(book) ?? []), verseId])
  }
  return [...books.keys()]
    .sort((a, b) => a - b)
    .map((book) => ({
      book,
      verseIds: books.get(book) ?? [],
      expanded: false,
      verses: null,
    }))
}

const errorMessage = (error: unknown): string =>
  error instanceof Error ? error.message : String(error)

export class WordStudyModel {
  #number: string | null = null
  #status: WordStudyStatus = 'empty'
  #found: WordStudyEntry | null = null
  #installing = false
  #installError: string | null = null
  #loadToken = 0
  #translationId: string | null = null
  #concordance: LoadedConcordance | null = null
  readonly #listeners = new Set<() => void>()

  constructor(private readonly deps: WordStudyDeps) {}

  subscribe(listener: () => void): () => void {
    this.#listeners.add(listener)
    return () => this.#listeners.delete(listener)
  }

  // The number the panel persists, so a restored tab comes back to it.
  get number(): string | null {
    return this.#number
  }

  // The translation the panel persists beside its number, so a restored tab
  // comes back to the same concordance.
  get translationId(): string | null {
    return this.#translationId
  }

  get view(): WordStudyViewState {
    const found = this.#found
    const etymology = etymologyOf(found?.derivation ?? null)
    return {
      concordance: this.#concordanceView(),
      number: this.#number,
      title: this.#number ?? UNTITLED,
      status: this.#status,
      entry: found?.entry ?? null,
      siblings: found?.siblings ?? [],
      etymology,
      attribution: found === null ? null : this.deps.dictionary.attribution,
      etymologyAttribution:
        etymology === null ? null : this.deps.dictionary.etymologyAttribution,
      install:
        this.#status === 'no-dictionary'
          ? { busy: this.#installing, error: this.#installError }
          : null,
    }
  }

  async show(
    strongsNumber: string,
    target: WordStudyTarget = {},
  ): Promise<void> {
    this.#number = strongsNumber
    this.#status = 'loading'
    this.#found = null
    this.#concordance = null
    this.#translationId = target.translationId ?? null
    this.#notify()
    await this.#load()
  }

  // Expanding a book renders its rows the first time it is asked for, and
  // keeps them for every expansion after.
  async toggleConcordanceBook(book: number): Promise<void> {
    const loaded = this.#concordance
    const found = loaded?.books.find((entry) => entry.book === book)
    if (loaded === null || found === undefined) return
    found.expanded = !found.expanded
    this.#notify()
    if (!found.expanded || found.verses !== null) return
    const token = this.#loadToken
    const verses = await this.#concordanceSource().versesFor(
      loaded.translation.id,
      this.#number ?? '',
      found.verseIds,
    )
    if (token !== this.#loadToken) return
    found.verses = verses.map((verse) => ({
      ...verse,
      reference: referenceLabel(verseReference(verse.verseId)),
    }))
    this.#notify()
  }

  // An occurrence row walks the way a Ref Span does: to that chapter in the
  // concordance's own translation, in this reader or a new one.
  openOccurrence(verseId: number, options: NavigationOptions = {}): void {
    const translationId = this.#concordance?.translation.id ?? null
    ;(this.deps.navigator ?? NOOP_REFERENCE_NAVIGATOR).openReference(
      verseReference(verseId),
      translationId,
      options,
    )
  }

  // Walking an etymology citation or a family sibling is the same move the
  // Study Panel's entry cards make: plain retargets, modified spawns.
  async open(
    strongsNumber: string,
    options: NavigationOptions = {},
  ): Promise<void> {
    await (this.deps.opener ?? NO_WORD_STUDY).openWordStudy(strongsNumber, options)
  }

  async installDictionary(): Promise<void> {
    if (this.#installing) return
    this.#installing = true
    this.#installError = null
    this.#notify()
    try {
      await this.deps.dictionary.install()
    } catch (error) {
      this.#installing = false
      this.#installError = errorMessage(error)
      this.#notify()
      return
    }
    this.#installing = false
    await this.#load()
  }

  // A number that arrived while an earlier one was still loading wins: only
  // the newest token is allowed to settle the panel.
  async #load(): Promise<void> {
    const number = this.#number
    if (number === null) return
    const token = ++this.#loadToken
    await Promise.all([
      this.#loadEntry(number, token),
      this.#loadConcordance(number, token),
    ])
  }

  async #loadEntry(number: string, token: number): Promise<void> {
    if (!(await this.deps.dictionary.installed())) {
      if (token !== this.#loadToken) return
      this.#status = 'no-dictionary'
      this.#found = null
      this.#notify()
      return
    }
    const found = await this.deps.dictionary.entryFor(number)
    if (token !== this.#loadToken) return
    this.#found = found
    this.#status = found === null ? 'no-entry' : 'ok'
    this.#notify()
  }

  // The concordance stands on its own: a number the dictionaries carry no
  // entry for still has occurrences, and still lists them.
  async #loadConcordance(number: string, token: number): Promise<void> {
    const source = this.#concordanceSource()
    const translation = await source.translationFor(this.#translationId)
    if (token !== this.#loadToken) return
    if (translation === null) {
      this.#concordance = null
      this.#notify()
      return
    }
    const verseIds = await source.occurrences(translation.id, number)
    if (token !== this.#loadToken) return
    this.#concordance = {
      translation,
      total: verseIds.length,
      books: groupByBook(verseIds),
    }
    this.#notify()
  }

  #concordanceSource(): WordStudyConcordance {
    return this.deps.concordance ?? INERT_WORD_STUDY_CONCORDANCE
  }

  #concordanceView(): ConcordanceView | null {
    const loaded = this.#concordance
    if (loaded === null) return null
    return {
      translation: loaded.translation,
      total: loaded.total,
      label: occurrenceLabel(loaded.total, loaded.translation.id),
      familyUndifferentiated: (this.#found?.siblings ?? []).length > 0,
      books: loaded.books.map(({ book, verseIds, expanded, verses }) => ({
        book,
        name: bookName(book),
        count: verseIds.length,
        expanded,
        verses: expanded ? verses : null,
      })),
    }
  }

  #notify(): void {
    this.#listeners.forEach((listener) => listener())
  }
}
