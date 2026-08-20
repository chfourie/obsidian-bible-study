import {
  NO_WORD_STUDY,
  NOOP_REFERENCE_NAVIGATOR,
  type NavigationOptions,
  type ReferenceNavigator,
  type StrongsEntryView,
  type WordStudyOpener,
} from '../contracts'
import {
  occurrencesByBook,
  strongsFamily,
  totalOccurrences,
  type VerseOccurrences,
} from '../modules'
import {
  bookName,
  decodeVerseId,
  referenceLabel,
  type Reference,
} from '../reference'

export type WordStudyNavigator = Pick<ReferenceNavigator, 'openReference'>

// The derivation is Strong's 1890, which the brief lexicons carry none of.
export type WordStudyEntry = {
  entry: StrongsEntryView
  siblings: string[]
  derivation: string | null
}

// The Strong's Dictionaries seen from the Word Study Panel. Lookups are per
// extended number rather than per family — only the concordance below matches
// at family granularity.
export type WordStudyDictionary = {
  installed: () => Promise<boolean>
  entryFor: (strongsNumber: string) => Promise<WordStudyEntry | null>
  // The Strong's Family of a number the dictionaries carry no entry for: the
  // concordance still matches at family granularity, so the panel asks who
  // else the count covers even where the entry itself is missing.
  familySiblings: (strongsNumber: string) => Promise<string[]>
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
  familySiblings: async () => [],
  install: async () => {},
  attribution: '',
  etymologyAttribution: '',
}

// The LSJ Lexicon seen from the Word Study Panel. Greek only — no Hebrew
// counterpart exists, so a Hebrew number is never asked about.
export type WordStudyLsj = {
  installed: () => Promise<boolean>
  entryFor: (strongsNumber: string) => Promise<string | null>
  install: () => Promise<void>
  attribution: string
}

// Stands in when the panel runs without the LSJ module wired up: a Greek
// number degrades to the same inline install, which installs nothing.
export const INERT_WORD_STUDY_LSJ: WordStudyLsj = {
  installed: async () => false,
  entryFor: async () => null,
  install: async () => {},
  attribution: '',
}

export type ConcordanceTranslation = { id: string; name: string }

// One stretch of an occurrence's verse text: the words the family is tagged
// on are the emphasized ones.
export type ConcordanceSegment = { text: string; emphasis: boolean }

export type ConcordanceVerse = {
  verseId: number
  segments: ConcordanceSegment[]
}

// One way a Tagged Translation renders the family — the surface words under
// its tag spans — against the verses it renders them in, and how often in each.
export type ConcordanceRendering = {
  text: string
  occurrences: VerseOccurrences[]
}

// The Concordance Indexes seen from the Word Study Panel, at family
// granularity: the verses, the renderings, and the text of as many of them as
// the reader has opened.
export type WordStudyConcordance = {
  // In install order: a panel reads the first of them unless it was opened on,
  // or switched to, another.
  translations: () => Promise<ConcordanceTranslation[]>
  occurrences: (
    translationId: string,
    strongsNumber: string,
  ) => Promise<VerseOccurrences[]>
  renderings: (
    translationId: string,
    strongsNumber: string,
  ) => Promise<ConcordanceRendering[]>
  // One row per verse, however many occurrences that verse holds.
  versesFor: (
    translationId: string,
    strongsNumber: string,
    occurrences: VerseOccurrences[],
  ) => Promise<ConcordanceVerse[]>
}

// Stands in when the panel runs without any concordance wired up: no
// translation to read, which the panel says in place of the occurrences.
export const INERT_WORD_STUDY_CONCORDANCE: WordStudyConcordance = {
  translations: async () => [],
  occurrences: async () => [],
  renderings: async () => [],
  versesFor: async () => [],
}

export type WordStudyDeps = {
  dictionary: WordStudyDictionary
  concordance?: WordStudyConcordance
  lsj?: WordStudyLsj
  opener?: WordStudyOpener
  navigator?: WordStudyNavigator
}

// A derivation as the panel renders it: plain text, and the Strong's Numbers
// it cites, which are walkable.
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

// The full LSJ entry as a collapsible section of its own, null for every
// number LSJ has no business covering — a Hebrew one, or none at all.
export type LsjSectionView = {
  status: 'loading' | 'ok' | 'no-entry' | 'not-installed'
  expanded: boolean
  // Non-null exactly while the status is 'ok'.
  entry: string | null
  // The inline install, non-null exactly while the status is 'not-installed'.
  install: WordStudyInstall | null
  attribution: string | null
}

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

export type RenderingView = { text: string; count: number; active: boolean }

export type ConcordanceView = {
  // Null exactly while there is no translation to count in — then the message
  // below says which problem that is.
  translation: ConcordanceTranslation | null
  translations: ConcordanceTranslation[]
  // Whether those choices are worth a switcher: more than one to choose
  // between, or a concordance with none of them being read.
  switchable: boolean
  message: string | null
  total: number
  label: string
  // The translation's renderings of the family, most frequent first.
  renderings: RenderingView[]
  family: string
  // True while the number under study shares its family with other entries —
  // or while nothing installed can rule that out. The tagging cannot tell a
  // family's entries apart, so the occurrences cover them all.
  familyUndifferentiated: boolean
  books: ConcordanceBookView[]
}

export type WordStudyViewState = {
  number: string | null
  title: string
  status: WordStudyStatus
  entry: StrongsEntryView | null
  siblings: string[]
  // Non-null exactly while the 1890 dictionary states a derivation.
  etymology: EtymologySegment[] | null
  attribution: string | null
  etymologyAttribution: string | null
  install: WordStudyInstall | null
  lsj: LsjSectionView | null
  // The family's occurrences in one Tagged Translation, or null while no
  // tagged translation is installed to count them in.
  concordance: ConcordanceView | null
}

const UNTITLED = 'Word study'

// The translation the tapped word came from, which is the concordance the
// panel reads unless that translation is not a tagged one.
export type WordStudyTarget = { translationId?: string | null }

const NO_TAGGED_TRANSLATION = 'No Tagged Translation is installed.'

const uninstalledMessage = (name: string): string =>
  `${name} is no longer installed.`

const countPhrase = (total: number): string => {
  if (total === 0) return 'No occurrences'
  if (total === 1) return '1 occurrence'
  return `${total.toLocaleString('en-US')} occurrences`
}

const occurrenceLabel = (
  total: number,
  translation: ConcordanceTranslation | null,
  rendering: string | null,
): string => {
  if (translation === null) return 'Occurrences'
  const counted = `${countPhrase(total)} in ${translation.id.toUpperCase()}`
  return rendering === null ? counted : `${rendering}: ${counted}`
}

const verseReference = (verseId: number): Reference => ({
  book: decodeVerseId(verseId).book,
  ranges: [{ startId: verseId, endId: verseId }],
})

type ConcordanceBook = {
  book: number
  occurrences: VerseOccurrences[]
  expanded: boolean
  verses: ConcordanceVerseView[] | null
}

type LoadedConcordance = {
  translation: ConcordanceTranslation | null
  translations: ConcordanceTranslation[]
  message: string | null
  occurrences: VerseOccurrences[]
  renderings: ConcordanceRendering[]
  // The rendering the occurrence list is filtered to, or null for all of them.
  rendering: string | null
  books: ConcordanceBook[]
}

const groupByBook = (occurrences: VerseOccurrences[]): ConcordanceBook[] =>
  [...occurrencesByBook(occurrences)].map(([book, inBook]) => ({
    book,
    occurrences: inBook,
    expanded: false,
    verses: null,
  }))

const errorMessage = (error: unknown): string =>
  error instanceof Error ? error.message : String(error)

const isGreek = (strongsNumber: string): boolean =>
  strongsNumber.startsWith('G')

// The state behind one inline install affordance: busy while it runs, and the
// error it came back with in place of the module it was asked for.
class InlineInstall {
  #busy = false
  #error: string | null = null

  constructor(private readonly notify: () => void) {}

  get view(): WordStudyInstall {
    return { busy: this.#busy, error: this.#error }
  }

  // False where the install never ran or never finished, so the caller reloads
  // only what an install has actually changed.
  async run(install: () => Promise<void>): Promise<boolean> {
    if (this.#busy) return false
    this.#busy = true
    this.#error = null
    this.notify()
    try {
      await install()
    } catch (error) {
      this.#busy = false
      this.#error = errorMessage(error)
      this.notify()
      return false
    }
    this.#busy = false
    return true
  }
}

export class WordStudyModel {
  #number: string | null = null
  #status: WordStudyStatus = 'empty'
  #found: WordStudyEntry | null = null
  // Null while the dictionaries cannot say at all, as when the module is
  // missing.
  #familySiblings: string[] | null = null
  readonly #install = new InlineInstall(() => this.#notify())
  #loadToken = 0
  // Null exactly where the panel carries no LSJ section at all.
  #lsjStatus: LsjSectionView['status'] | null = null
  #lsjEntry: string | null = null
  // Remembered for as long as the panel lives: a reader who opened the LSJ
  // entry once means it for the numbers they go on to study.
  #lsjExpanded = false
  readonly #lsjInstall = new InlineInstall(() => this.#notify())
  // The concordance settles on its own token: switching translations re-reads
  // the occurrences without disturbing the entry already on screen.
  #concordanceToken = 0
  #translationId: string | null = null
  #concordance: LoadedConcordance | null = null
  readonly #listeners = new Set<() => void>()

  constructor(private readonly deps: WordStudyDeps) {}

  subscribe(listener: () => void): () => void {
    this.#listeners.add(listener)
    return () => this.#listeners.delete(listener)
  }

  get number(): string | null {
    return this.#number
  }

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
      install: this.#status === 'no-dictionary' ? this.#install.view : null,
      lsj: this.#lsjView(),
    }
  }

  #lsjView(): LsjSectionView | null {
    const status = this.#lsjStatus
    if (status === null) return null
    return {
      status,
      expanded: this.#lsjExpanded,
      entry: status === 'ok' ? this.#lsjEntry : null,
      install: status === 'not-installed' ? this.#lsjInstall.view : null,
      attribution: status === 'ok' ? this.#lsjSource().attribution : null,
    }
  }

  async show(
    strongsNumber: string,
    target: WordStudyTarget = {},
  ): Promise<void> {
    this.#number = strongsNumber
    this.#status = 'loading'
    this.#found = null
    this.#familySiblings = null
    this.#lsjStatus = isGreek(strongsNumber) ? 'loading' : null
    this.#lsjEntry = null
    this.#concordance = null
    this.#translationId = target.translationId ?? null
    this.#notify()
    await this.#load()
  }

  async toggleConcordanceBook(book: number): Promise<void> {
    const loaded = this.#concordance
    const found = loaded?.books.find((entry) => entry.book === book)
    if (loaded === null || found === undefined) return
    found.expanded = !found.expanded
    this.#notify()
    if (!found.expanded || found.verses !== null || loaded.translation === null)
      return
    const token = this.#concordanceToken
    const verses = await this.#concordanceSource().versesFor(
      loaded.translation.id,
      this.#number ?? '',
      found.occurrences,
    )
    if (token !== this.#concordanceToken) return
    found.verses = verses.map((verse) => ({
      ...verse,
      reference: referenceLabel(verseReference(verse.verseId)),
    }))
    this.#notify()
  }

  // Books fold shut either way: they are not the same rows once the list
  // narrows.
  toggleRendering(text: string): void {
    const loaded = this.#concordance
    if (loaded === null) return
    loaded.rendering = loaded.rendering === text ? null : text
    loaded.books = groupByBook(this.#filteredOccurrences(loaded))
    this.#notify()
  }

  async useTranslation(translationId: string): Promise<void> {
    const number = this.#number
    if (number === null) return
    const token = ++this.#concordanceToken
    const translations = await this.#concordanceSource().translations()
    if (token !== this.#concordanceToken) return
    this.#translationId = translationId
    const chosen =
      translations.find((translation) => translation.id === translationId) ??
      null
    if (chosen === null) {
      this.#concordance = this.#unavailable(
        translations,
        uninstalledMessage(this.#nameOf(translationId)),
      )
      this.#notify()
      return
    }
    await this.#readConcordance(number, chosen, translations, token)
  }

  openOccurrence(verseId: number, options: NavigationOptions = {}): void {
    const translationId = this.#concordance?.translation?.id ?? null
    ;(this.deps.navigator ?? NOOP_REFERENCE_NAVIGATOR).openReference(
      verseReference(verseId),
      translationId,
      options,
    )
  }

  // The concordance the reader is in travels with the walk, so a sibling or a
  // citation never snaps the occurrences back to another translation.
  async open(
    strongsNumber: string,
    options: NavigationOptions = {},
  ): Promise<void> {
    const translationId = this.#concordance?.translation?.id ?? this.#translationId
    await (this.deps.opener ?? NO_WORD_STUDY).openWordStudy(strongsNumber, {
      ...options,
      ...(translationId === null ? {} : { translationId }),
    })
  }

  toggleLsj(): void {
    this.#lsjExpanded = !this.#lsjExpanded
    this.#notify()
  }

  async installLsj(): Promise<void> {
    const number = this.#number
    if (number === null) return
    const installed = await this.#lsjInstall.run(() =>
      this.#lsjSource().install(),
    )
    if (!installed) return
    this.#lsjExpanded = true
    await this.#loadLsj(number, this.#loadToken)
  }

  async installDictionary(): Promise<void> {
    const installed = await this.#install.run(() =>
      this.deps.dictionary.install(),
    )
    if (installed) await this.#load()
  }

  // A number that arrived while an earlier one was still loading wins: only
  // the newest token is allowed to settle the panel.
  async #load(): Promise<void> {
    const number = this.#number
    if (number === null) return
    const token = ++this.#loadToken
    await Promise.all([
      this.#loadEntry(number, token),
      this.#loadLsj(number, token),
      this.#loadConcordance(number, ++this.#concordanceToken),
    ])
  }

  // Settles on the panel's own token, beside the entry: an optional module
  // missing is a state of this section alone, never of the panel.
  async #loadLsj(number: string, token: number): Promise<void> {
    if (!isGreek(number)) return
    const source = this.#lsjSource()
    if (!(await source.installed())) {
      if (token !== this.#loadToken) return
      this.#lsjStatus = 'not-installed'
      this.#lsjEntry = null
      this.#notify()
      return
    }
    const entry = await source.entryFor(number)
    if (token !== this.#loadToken) return
    this.#lsjEntry = entry
    this.#lsjStatus = entry === null ? 'no-entry' : 'ok'
    this.#notify()
  }

  async #loadEntry(number: string, token: number): Promise<void> {
    if (!(await this.deps.dictionary.installed())) {
      if (token !== this.#loadToken) return
      this.#status = 'no-dictionary'
      this.#found = null
      this.#familySiblings = null
      this.#notify()
      return
    }
    const found = await this.deps.dictionary.entryFor(number)
    if (token !== this.#loadToken) return
    this.#found = found
    this.#status = found === null ? 'no-entry' : 'ok'
    this.#notify()
    if (found !== null) return
    const siblings = await this.deps.dictionary.familySiblings(number)
    if (token !== this.#loadToken) return
    this.#familySiblings = siblings
    this.#notify()
  }

  // A panel opened on a translation reads that one where it can, and the first
  // Tagged Translation installed where it cannot — a preference, not a choice.
  async #loadConcordance(number: string, token: number): Promise<void> {
    const translations = await this.#concordanceSource().translations()
    if (token !== this.#concordanceToken) return
    const preferred = this.#translationId
    const chosen =
      translations.find((translation) => translation.id === preferred) ??
      translations[0] ??
      null
    await this.#readConcordance(number, chosen, translations, token)
  }

  async #readConcordance(
    number: string,
    translation: ConcordanceTranslation | null,
    translations: ConcordanceTranslation[],
    token: number,
  ): Promise<void> {
    if (translation === null) {
      this.#concordance = this.#unavailable(translations, NO_TAGGED_TRANSLATION)
      this.#notify()
      return
    }
    const source = this.#concordanceSource()
    const occurrences = await source.occurrences(translation.id, number)
    if (token !== this.#concordanceToken) return
    const loaded: LoadedConcordance = {
      translation,
      translations,
      message: null,
      occurrences,
      renderings: [],
      rendering: null,
      books: groupByBook(occurrences),
    }
    this.#concordance = loaded
    this.#notify()
    // The chips are read out of the verse text itself, a whole family at a
    // time — far the slower half, so the list stands before they arrive.
    const renderings = await source.renderings(translation.id, number)
    if (token !== this.#concordanceToken) return
    loaded.renderings = renderings
    this.#notify()
  }

  #unavailable(
    translations: ConcordanceTranslation[],
    message: string,
  ): LoadedConcordance {
    return {
      translation: null,
      translations,
      message,
      occurrences: [],
      renderings: [],
      rendering: null,
      books: [],
    }
  }

  // What the translation is called where it is still installed, and its own
  // code where the concordance has just found that it is not.
  #nameOf(translationId: string): string {
    const reading = this.#concordance?.translation ?? null
    const known = [...(this.#concordance?.translations ?? [])]
    if (reading !== null) known.push(reading)
    return (
      known.find((translation) => translation.id === translationId)?.name ??
      translationId.toUpperCase()
    )
  }

  #filteredOccurrences(loaded: LoadedConcordance): VerseOccurrences[] {
    if (loaded.rendering === null) return loaded.occurrences
    const rendering = loaded.renderings.find(
      (candidate) => candidate.text === loaded.rendering,
    )
    return rendering?.occurrences ?? []
  }

  #lsjSource(): WordStudyLsj {
    return this.deps.lsj ?? INERT_WORD_STUDY_LSJ
  }

  #concordanceSource(): WordStudyConcordance {
    return this.deps.concordance ?? INERT_WORD_STUDY_CONCORDANCE
  }

  #concordanceView(): ConcordanceView | null {
    const loaded = this.#concordance
    if (loaded === null) return null
    const total = totalOccurrences(this.#filteredOccurrences(loaded))
    return {
      translation: loaded.translation,
      translations: loaded.translations,
      switchable:
        loaded.translations.length > 1 ||
        (loaded.translation === null && loaded.translations.length > 0),
      message: loaded.message,
      total,
      label: occurrenceLabel(total, loaded.translation, loaded.rendering),
      renderings: [...loaded.renderings]
        .map(({ text, occurrences }) => ({
          text,
          count: totalOccurrences(occurrences),
          active: text === loaded.rendering,
        }))
        .sort((a, b) => b.count - a.count),
      family: strongsFamily(this.#number ?? ''),
      familyUndifferentiated: this.#familyUndifferentiated(loaded),
      books: loaded.books.map(({ book, occurrences, expanded, verses }) => ({
        book,
        name: bookName(book),
        count: totalOccurrences(occurrences),
        expanded,
        verses: expanded ? verses : null,
      })),
    }
  }

  // Occurrences are matched by family whatever the dictionaries know, so the
  // note follows what is knowable: the entry's own siblings, the family index
  // where no entry answers, and — where no dictionary is installed to say
  // either way — the ambiguity itself, which is where it is least visible.
  #familyUndifferentiated(loaded: LoadedConcordance): boolean {
    if (this.#found !== null) return this.#found.siblings.length > 0
    if (this.#familySiblings !== null) return this.#familySiblings.length > 0
    return loaded.occurrences.length > 0
  }

  #notify(): void {
    this.#listeners.forEach((listener) => listener())
  }
}
