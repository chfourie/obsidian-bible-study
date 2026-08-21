import {
  BOOK_COUNT,
  bookCitation,
  bookName,
  chapterCount,
  decodeVerseId,
  formatReference,
  isNonBiblicalBook,
  makeVerseId,
  parseReference,
  rangeContains,
  referenceLabel,
  verseCount,
  type Reference,
  type VerseRange,
} from '../reference'
import {
  CROSS_REFERENCE_MINIMUM_MEMBERS,
  crossReferenceView,
  orderCrossReferences,
  type CrossReference,
  type CrossReferenceEditing,
  type CrossReferenceView,
} from '../cross-references'
import {
  chapterAnnotationViews,
  loadChapterAnnotations,
  type AnnotationDetails,
  type LoadedChapterAnnotation,
} from '../annotations'
import { chapterMentionViews } from '../mentions'
import { verseMarkers, type VerseMarkerCounts } from './verse-markers'
import type {
  BookDetailsView,
  ChapterAnnotationView,
  ChapterMentionView,
  CollectionView,
  EmphasisSpan,
  SelectionKind,
  StrongsEntryView,
  StudyMaterial,
  StudyMaterialSource,
  TranslationRowView,
  VerseDetailsView,
} from '../contracts'
import {
  FONT_SCALE_DEFAULT,
  FONT_SCALE_MAX,
  FONT_SCALE_MIN,
  FONT_SCALE_STEP,
  type AnnotationOrdering,
} from '../data-access'
import { isPoetryVerse, markSpanChannel, verseSegments } from '../rendering'
import type { PassageSource, PassageVerse, VerseSegment } from '../rendering'
import type { Epigraph, Figure, HeadingLevel } from '../modules'

export { FONT_SCALE_MAX, FONT_SCALE_MIN, FONT_SCALE_STEP }
import { isAnnotation, type OccurrenceGroup } from '../vault-index'

export type ReaderToggles = {
  nav: 'tree' | 'breadcrumb'
  layout: 'verse-per-line' | 'continuous'
  strongs: 'off' | 'on'
  redLetter: 'off' | 'on'
  // Book mode only: whether the margin-gutter paragraph numbers stay on or
  // surface on hover (spec-books §5).
  paraNumbers: 'on' | 'hover'
}

export type ReaderBookSection = {
  chapter: number
  name: string
  // The Part this section sits under, for books printed in Parts.
  part?: string
}

// An installed book as the reader needs it: its own contents table plus the
// edition module that fills the translation slot (ADR 0002).
export type ReaderBook = {
  number: number
  title: string
  author: string
  year: number
  editionId: string
  sections: ReaderBookSection[]
}

export type ReaderBookSource = {
  installed: () => Promise<ReaderBook[]>
  epigraphs: (editionId: string, chapter: number) => Promise<Epigraph[]>
}

const NO_BOOKS: ReaderBookSource = {
  installed: async () => [],
  epigraphs: async () => [],
}

// Where the copy-formatted-reference action writes to. The browser API by
// default, with an injectable seam so specs never touch the real clipboard.
export type ReaderClipboard = { writeText: (text: string) => Promise<void> }

const NAVIGATOR_CLIPBOARD: ReaderClipboard = {
  writeText: (text) => navigator.clipboard.writeText(text),
}

export type ReaderStrongsDeps = {
  dictionariesInstalled: () => Promise<boolean>
  entriesFor: (numbers: string[]) => Promise<StrongsEntryView[]>
  attribution: string
}

export type ReaderPosition = { book: number; chapter: number }

// What a nav face asks for beyond the target itself. Views translate the
// platform modifier into this intent, so the model never sees an event.
export type ReaderNavIntent = { newTab?: boolean }

// Where a mod-clicked nav target lands: the shell opens a fresh reader leaf
// there and leaves this pane untouched. A model without a shell has no leaf
// to spawn, so its targets simply open in place. A target that entered from a
// reference — a citation — carries it along, so the spawned tab arrives as the
// same click would in place: passage highlighted, entry banner. Targets
// without one (tree and chapter nav) open plain, as they do in place.
export type ReaderNavTarget = { position: ReaderPosition; entry?: Reference }

export type ReaderNewTab = (target: ReaderNavTarget) => void

// How a chapter move reaches the screen. The pane's shell routes user
// navigation through Obsidian's per-pane history and calls `open` back when
// the new position arrives; a model without a shell opens straight away.
export type ReaderNavigation = (
  position: ReaderPosition,
  open: () => Promise<void>,
) => Promise<void>

const OPEN_DIRECTLY: ReaderNavigation = (_position, open) => open()

export type ReaderFirstRunDeps = {
  translationName: string
  install: () => Promise<void>
}

export type ReaderTranslation = {
  id: string
  label: string
  name: string
  strongsTagged: boolean
}

export type ReaderPaneDeps = {
  passages: PassageSource
  availableTranslations: () => Promise<ReaderTranslation[]>
  intersecting: (reference: Reference) => OccurrenceGroup[]
  crossReferences: CrossReferenceEditing
  annotationDetails: (file: string) => Promise<AnnotationDetails | null>
  strongs: ReaderStrongsDeps
  books?: ReaderBookSource
  newTab?: ReaderNewTab
  firstRun?: ReaderFirstRunDeps
  clipboard?: ReaderClipboard
}

export type ReaderPaneConfig = {
  toggles: ReaderToggles
  translationId: string | null
  annotationOrdering?: AnnotationOrdering
  fontScalePercent?: number
}

const clampFontScale = (percent: number): number =>
  Math.min(FONT_SCALE_MAX, Math.max(FONT_SCALE_MIN, percent))

// A Heading printed above the atom, in segments like the atom's own text so
// that an entry's matched words are emphasized here too (CONTEXT.md — Hit).
export type HeadingRowView = {
  level: HeadingLevel
  segments: VerseSegment[]
}

export type VerseRowView = {
  verseId: number
  label: string
  segments: VerseSegment[]
  // The Headings printed above this atom, in order — empty for scripture and
  // for any book paragraph without furniture of its own.
  headings: HeadingRowView[]
  // The Figures printed with this atom, in source order — each saying whether
  // it prints above the paragraph or below it. Empty for scripture.
  figures: Figure[]
  // A Book atom that keeps its own line breaks — a table's rows or a list's
  // items — prints them whatever the layout is. Scripture's line data is
  // poetry structure the layout toggle governs, so it never sets this.
  keepsLines: boolean
  highlighted: boolean
  annotations: number
  mentions: number
  poetry: boolean
  startsParagraph: boolean
}

export const paragraphsOf = (rows: VerseRowView[]): VerseRowView[][] => {
  const paragraphs: VerseRowView[][] = []
  for (const row of rows) {
    const current = paragraphs[paragraphs.length - 1]
    const previous = current?.[current.length - 1]
    const breaksBefore =
      previous !== undefined &&
      (row.startsParagraph || row.poetry || previous.poetry)
    if (current === undefined || breaksBefore) paragraphs.push([row])
    else current.push(row)
  }
  return paragraphs
}

// The selection's verses joined as one run of segments, a space between
// verses, so a translation row reads as the whole selected span.
const joinedSegments = (verses: { segments: VerseSegment[] }[]): VerseSegment[] =>
  verses.flatMap((verse, index) =>
    index === 0
      ? verse.segments
      : [{ text: ' ', redLetter: false }, ...verse.segments],
  )

export const translationTitle = (translation: {
  name: string
  label: string
}): string => `${translation.name} (${translation.label})`

export type TranslationPill = {
  id: string
  label: string
  name: string
  active: boolean
}

export type BookSectionOption = {
  chapter: number
  name: string
  current: boolean
  part?: string
}

// The section options of one Part, under the Part title the picker shows as
// a group label — a label, never a destination. A book printed without Parts
// is one unlabelled run (spec-books §5).
export type BookSectionGroup = {
  label: string | null
  sections: BookSectionOption[]
}

export const sectionGroups = (
  sections: BookSectionOption[],
): BookSectionGroup[] => {
  const groups: BookSectionGroup[] = []
  for (const section of sections) {
    const label = section.part ?? null
    const current = groups[groups.length - 1]
    if (current === undefined || current.label !== label)
      groups.push({ label, sections: [section] })
    else current.sections.push(section)
  }
  return groups
}

// The attribution comes through as segments so its citation lights up on the
// same channel the prose uses (spec-books §8).
export type EpigraphView = {
  quote: string
  attribution: VerseSegment[]
}

// Everything the pane renders differently for a book: its own contents table
// replaces the scripture tree, the edition pill replaces the translation
// switcher, and the section carries its heading and epigraphs.
export type BookModeView = {
  title: string
  author: string
  edition: string
  sectionName: string
  sections: BookSectionOption[]
  sectionGroups: BookSectionGroup[]
  epigraphs: EpigraphView[]
}

export type ReaderPaneView = {
  status: 'loading' | 'ok' | 'unavailable' | 'no-translation'
  // Null in scripture mode — the pane is in book mode exactly when set.
  book: BookModeView | null
  title: string
  position: ReaderPosition
  rows: VerseRowView[]
  translations: TranslationPill[]
  toggles: ReaderToggles
  // The book the nav tree shows expanded: the reader's own book unless
  // another one is being browsed.
  treeBook: number
  hasPreviousChapter: boolean
  hasNextChapter: boolean
  fontScalePercent: number
  attribution: string | null
  banner: string | null
  strongsAvailable: boolean
  strongsMode: boolean
  installNudge: {
    translationName: string
    busy: boolean
    error: string | null
  } | null
}

const epigraphView = (epigraph: Epigraph): EpigraphView => ({
  quote: epigraph.quote,
  attribution: verseSegments(
    epigraph.refs === undefined
      ? epigraph.attribution
      : { text: epigraph.attribution, refs: epigraph.refs },
    [],
  ),
})

const chapterReference = (position: ReaderPosition): Reference => ({
  book: position.book,
  ranges: [
    {
      startId: makeVerseId(position.book, position.chapter, 1),
      endId: makeVerseId(
        position.book,
        position.chapter,
        verseCount(position.book, position.chapter),
      ),
    },
  ],
})

export class ReaderPaneModel implements StudyMaterialSource {
  #position: ReaderPosition = { book: 1, chapter: 1 }
  #translationId: string | null
  #entry: Reference | null = null
  // The entry's emphasized words, kept beside the passage they were computed
  // against so dismissing the banner can drop them without a reload.
  #emphasis: readonly EmphasisSpan[] = []
  #verses: PassageVerse[] = []
  #rows: VerseRowView[] = []
  #status: ReaderPaneView['status'] = 'loading'
  #available: ReaderTranslation[] = []
  #toggles: ReaderToggles
  #selectedVerseId: number | null = null
  #selectionEnd: number | null = null
  // The loaded details of the current selection, or null while nothing is
  // selected, no surface wants details, or the load is still in flight.
  #details: VerseDetailsView | null = null
  // Whether any surface shows the details right now: loads run only while
  // wanted, so selecting with the details out of sight fetches nothing.
  #detailsWanted = false
  // What the loaded details cover (selection span plus tapped word), and what
  // an in-flight load is fetching — so a repeat request costs nothing.
  #loadedDetailsKey: string | null = null
  #loadingDetailsKey: string | null = null
  #chapterAnnotations: ChapterAnnotationView[] = []
  // The loaded annotations, kept so a changed ordering re-sorts them without
  // re-reading any note. Their scope is always the current chapter.
  #chapterAnnotationItems: LoadedChapterAnnotation[] = []
  #chapterMentions: ChapterMentionView[] = []
  #markers = new Map<number, VerseMarkerCounts>()
  #chapterMaterialToken = 0
  #attribution: string | null = null
  // The installed books, loaded with each passage so a book installed while
  // the pane is open is recognised on the next move.
  #books: ReaderBook[] = []
  #epigraphs: Epigraph[] = []
  #bannerDismissed = false
  #strongsAvailable = false
  #installingSuggested = false
  #installError: string | null = null
  // A tapped word remembers the translation it was tagged in: the word study
  // it opens reads that translation's concordance.
  #wordStrongs: {
    verseId: number
    numbers: string[]
    translationId: string | null
  } | null = null
  // The collection basket is pane-scoped and in-memory: a closed pane
  // releases its model and the half-built cross-reference with it.
  #collection: {
    members: Reference[]
    error: string | null
    confirmingDelete: boolean
    description: string
    // The half-typed reference in the basket's input: model-owned so adding
    // it can clear it on success and keep it for correction on failure.
    typed: string
    // The id of the cross-reference this strip edits, or null when building
    // a brand new one.
    editing: string | null
  } | null = null
  // The book the user expanded in the nav tree to browse, or null while the
  // tree simply follows the reader.
  #browsedBook: number | null = null
  #redLetterOverridden = false
  #navigate: ReaderNavigation = OPEN_DIRECTLY
  #loadToken = 0
  readonly #listeners = new Set<() => void>()
  readonly #selectionListeners = new Set<(kind: SelectionKind) => void>()

  #annotationOrdering: AnnotationOrdering
  #defaultFontScale: number
  #fontScalePercent: number

  constructor(
    private readonly deps: ReaderPaneDeps,
    config: ReaderPaneConfig,
  ) {
    this.#translationId = config.translationId
    this.#toggles = { ...config.toggles }
    this.#annotationOrdering = config.annotationOrdering ?? 'created-oldest-first'
    this.#defaultFontScale = clampFontScale(
      config.fontScalePercent ?? FONT_SCALE_DEFAULT,
    )
    this.#fontScalePercent = this.#defaultFontScale
  }

  subscribe(listener: () => void): () => void {
    this.#listeners.add(listener)
    return () => this.#listeners.delete(listener)
  }

  #notify(): void {
    this.#listeners.forEach((listener) => listener())
  }

  // Only a verse click or a Strong's word tap announces here: the feed marks
  // the user's own act of selecting, not the material changes it causes.
  onSelection(listener: (kind: SelectionKind) => void): () => void {
    this.#selectionListeners.add(listener)
    return () => this.#selectionListeners.delete(listener)
  }

  #announceSelection(kind: SelectionKind): void {
    this.#selectionListeners.forEach((listener) => listener(kind))
  }

  setToggle<Key extends keyof ReaderToggles>(
    toggle: Key,
    value: ReaderToggles[Key],
  ): void {
    if (toggle === 'redLetter') this.#redLetterOverridden = true
    this.#applyToggle(toggle, value)
  }

  // An overridden pane keeps the user's red-letter choice; untouched panes
  // track the global setting.
  setRedLetterDefault(value: ReaderToggles['redLetter']): void {
    if (this.#redLetterOverridden) return
    this.#applyToggle('redLetter', value)
  }

  get redLetterOverridden(): boolean {
    return this.#redLetterOverridden
  }

  #applyToggle<Key extends keyof ReaderToggles>(
    toggle: Key,
    value: ReaderToggles[Key],
  ): void {
    const changed = this.#toggles[toggle] !== value
    this.#toggles = { ...this.#toggles, [toggle]: value }
    this.#notify()
    // The red-letter toggle changes what the passage source serves, so any
    // chapter load that has started refetches — the load token retires an
    // in-flight fetch. Before the first load the pending open picks the
    // toggle up on its own.
    if (toggle === 'redLetter' && changed && this.#loadToken > 0) {
      void this.#loadChapter()
    }
  }

  increaseFontScale(): void {
    this.#setFontScale(this.#fontScalePercent + FONT_SCALE_STEP)
  }

  decreaseFontScale(): void {
    this.#setFontScale(this.#fontScalePercent - FONT_SCALE_STEP)
  }

  resetFontScale(): void {
    this.#setFontScale(this.#defaultFontScale)
  }

  setDefaultFontScale(percent: number): void {
    this.#defaultFontScale = clampFontScale(percent)
  }

  #setFontScale(percent: number): void {
    const clamped = clampFontScale(percent)
    if (clamped === this.#fontScalePercent) return
    this.#fontScalePercent = clamped
    this.#notify()
  }

  // Ordering is pure, so the loaded annotations re-sort in place — no
  // re-query, no re-read of the notes.
  setAnnotationOrdering(ordering: AnnotationOrdering): void {
    if (ordering === this.#annotationOrdering) return
    this.#annotationOrdering = ordering
    this.#chapterAnnotations = chapterAnnotationViews(
      this.#chapterAnnotationItems,
      chapterReference(this.#position).ranges,
      ordering,
    )
    this.#notify()
  }

  get view(): ReaderPaneView {
    const book = this.#bookHere()
    return {
      status: this.#status,
      book: book === null ? null : this.#bookView(book),
      title: this.#title(),
      position: this.#position,
      rows: this.#viewRows(),
      translations:
        book !== null
          ? []
          : this.#available.map((translation) => ({
              id: translation.id,
              label: translation.label,
              name: translation.name,
              active: translation.id === this.#translationId,
            })),
      toggles: this.#toggles,
      treeBook: this.#browsedBook ?? this.#position.book,
      fontScalePercent: this.#fontScalePercent,
      hasPreviousChapter: this.#hasPreviousChapter(),
      hasNextChapter: this.#hasNextChapter(),
      attribution: this.#attribution,
      strongsAvailable: this.#strongsAvailable,
      strongsMode: this.#strongsAvailable && this.#toggles.strongs === 'on',
      installNudge:
        this.#status === 'no-translation' && this.deps.firstRun !== undefined
          ? {
              translationName: this.deps.firstRun.translationName,
              busy: this.#installingSuggested,
              error: this.#installError,
            }
          : null,
      banner:
        this.#entry === null || this.#bannerDismissed
          ? null
          : `Opened at ${referenceLabel(this.#entry)}`,
    }
  }

  // The entry highlight rides along with its banner: dismissing the banner
  // dismisses the highlight too, in both scripture and book mode.
  #viewRows(): VerseRowView[] {
    if (!this.#bannerDismissed) return this.#rows
    return this.#rows.map((row) =>
      row.highlighted ? { ...row, highlighted: false } : row,
    )
  }

  #bookHere(): ReaderBook | null {
    return (
      this.#books.find((book) => book.number === this.#position.book) ?? null
    )
  }

  #sectionOf(book: ReaderBook): ReaderBookSection | null {
    return (
      book.sections.find(
        (section) => section.chapter === this.#position.chapter,
      ) ?? null
    )
  }

  #bookView(book: ReaderBook): BookModeView {
    const sections = book.sections.map((section) => ({
      chapter: section.chapter,
      name: section.name,
      current: section.chapter === this.#position.chapter,
      ...(section.part === undefined ? {} : { part: section.part }),
    }))
    return {
      title: book.title,
      author: book.author,
      edition: `${book.title} ${book.year}`,
      sectionName: this.#sectionOf(book)?.name ?? '',
      sections,
      sectionGroups: sectionGroups(sections),
      epigraphs: this.#epigraphs.map(epigraphView),
    }
  }

  // What this tab offers for study beside its text — the one source the
  // Study Panel renders from.
  get studyMaterial(): StudyMaterial {
    return {
      title: this.#title(),
      bookMode: this.#bookHere() !== null,
      selectedVerseId: this.#selectedVerseId,
      selectionEndId: this.#selectionEnd,
      details: this.#details,
      chapterCrossReferences: this.#chapterCrossReferences(),
      chapterAnnotations: this.#chapterAnnotations,
      chapterMentions: this.#chapterMentions,
      collection: this.#collectionView(),
    }
  }

  #title(): string {
    const book = this.#bookHere()
    if (book === null)
      return `${bookName(this.#position.book)} ${this.#position.chapter}`
    const section = this.#sectionOf(book)
    return section === null ? book.title : `${book.title} — ${section.name}`
  }

  useNavigation(navigate: ReaderNavigation): void {
    this.#navigate = navigate
  }

  // Whether this pane has opened a chapter yet: a pane still showing its
  // construction-time default has no position worth stepping back to.
  get opened(): boolean {
    return this.#loadToken > 0
  }

  // The emphasis spans are the entry's own: whoever opened the reader knows
  // which words matched, the reader only lays them over the passage.
  async openAt(
    reference: Reference,
    translationId: string | null,
    emphasis: readonly EmphasisSpan[] = [],
  ): Promise<void> {
    const { book, chapter } = decodeVerseId(reference.ranges[0].startId)
    await this.#navigate({ book, chapter }, async () => {
      this.#moveTo({ book, chapter })
      if (translationId !== null) this.#translationId = translationId
      this.#entry = reference
      this.#emphasis = emphasis
      this.#bannerDismissed = false
      this.#resetSelection()
      await this.#loadChapter()
    })
  }

  // A citation tapped in book prose. Scripture targets land in the reader as
  // any other entry does — current translation, passage highlighted, entry
  // banner — and a Note pointer's own-book target arrives the same way, so
  // the reader simply stays in the book (spec-books §8). A mod-clicked
  // citation spawns its own tab instead, like every other nav target.
  async openRefSpan(
    ranges: readonly VerseRange[],
    intent: ReaderNavIntent = {},
  ): Promise<void> {
    if (ranges.length === 0) return
    const { book, chapter } = decodeVerseId(ranges[0].startId)
    const entry = { book, ranges: ranges.map((range) => ({ ...range })) }
    if (this.#spawnedTab({ position: { book, chapter }, entry }, intent)) return
    await this.openAt(entry, null)
  }

  // Opens without touching the pane's history — the shell applies restored
  // and replayed positions through here.
  async openPosition(position: ReaderPosition): Promise<void> {
    this.#moveTo(position)
    this.#entry = null
    this.#emphasis = []
    this.#resetSelection()
    await this.#loadChapter()
  }

  // A book browsed in the tree outlives chapter moves inside the reader's own
  // book, but the tree follows the reader the moment its book changes.
  #moveTo(position: ReaderPosition): void {
    if (position.book !== this.#position.book) this.#browsedBook = null
    this.#position = { ...position }
  }

  browseBook(book: number, intent: ReaderNavIntent = {}): void {
    if (this.#spawnedTab({ position: { book, chapter: 1 } }, intent)) return
    this.#browsedBook = this.#browsedBook === book ? null : book
    this.#notify()
  }

  // Whether the target went to a tab of its own. A pane with no shell to
  // spawn one falls through to navigating in place.
  #spawnedTab(target: ReaderNavTarget, intent: ReaderNavIntent): boolean {
    if (intent.newTab !== true || this.deps.newTab === undefined) return false
    this.deps.newTab(target)
    return true
  }

  async installSuggestedTranslation(): Promise<void> {
    const firstRun = this.deps.firstRun
    if (firstRun === undefined || this.#installingSuggested) return
    this.#installingSuggested = true
    this.#installError = null
    this.#notify()
    try {
      await firstRun.install()
    } catch (error) {
      this.#installingSuggested = false
      this.#installError =
        error instanceof Error ? error.message : String(error)
      this.#notify()
      return
    }
    this.#installingSuggested = false
    await this.#loadChapter()
  }

  // The emphasized words belong to the banner: dismissing it leaves the
  // passage reading as it normally does.
  dismissBanner(): void {
    this.#bannerDismissed = true
    this.#emphasis = []
    this.#rows = this.#rowsOf(this.#verses)
    this.#notify()
  }

  // The user's own chapter move: unlike openPosition it walks the pane's
  // navigation history.
  async goTo(
    book: number,
    chapter: number,
    intent: ReaderNavIntent = {},
  ): Promise<void> {
    if (this.#spawnedTab({ position: { book, chapter } }, intent)) return
    await this.#navigate({ book, chapter }, () =>
      this.openPosition({ book, chapter }),
    )
  }

  // Book sections are numbered in reading order from the book's own first
  // chapter — Humility's Preface is 0 — and stepping never leaves the book.
  #sectionBounds(): { first: number; last: number } | null {
    const sections = this.#bookHere()?.sections
    if (sections === undefined || sections.length === 0) return null
    return {
      first: sections[0].chapter,
      last: sections[sections.length - 1].chapter,
    }
  }

  #hasNextChapter(): boolean {
    const { book, chapter } = this.#position
    const bounds = this.#sectionBounds()
    if (bounds !== null) return chapter < bounds.last
    return book < BOOK_COUNT || chapter < chapterCount(book)
  }

  #hasPreviousChapter(): boolean {
    const { book, chapter } = this.#position
    const bounds = this.#sectionBounds()
    if (bounds !== null) return chapter > bounds.first
    return book > 1 || chapter > 1
  }

  async nextChapter(): Promise<void> {
    if (!this.#hasNextChapter()) return
    const { book, chapter } = this.#position
    if (this.#sectionBounds() !== null || chapter < chapterCount(book))
      await this.goTo(book, chapter + 1)
    else await this.goTo(book + 1, 1)
  }

  async previousChapter(): Promise<void> {
    if (!this.#hasPreviousChapter()) return
    const { book, chapter } = this.#position
    if (this.#sectionBounds() !== null || chapter > 1)
      await this.goTo(book, chapter - 1)
    else await this.goTo(book - 1, chapterCount(book - 1))
  }

  async setTranslation(translationId: string): Promise<void> {
    this.#translationId = translationId
    this.#resetSelection()
    await this.#loadChapter()
  }

  async selectWord(verseId: number, strongsNumbers: string[]): Promise<void> {
    this.#wordStrongs = {
      verseId,
      numbers: strongsNumbers,
      translationId: this.#translationId,
    }
    this.#select(verseId, 'word')
    await this.#refreshDetails()
  }

  // Clicking the sole selected verse deselects it; a click on the anchor of
  // an extended selection collapses the range to that verse instead. The
  // details a selection loads belong to the Study Panel, so there is nothing
  // in the reader to expand or collapse.
  async selectVerse(verseId: number): Promise<void> {
    if (this.#selectedVerseId === verseId && this.#selectionEnd === null) {
      this.clearSelection()
      return
    }
    this.#wordStrongs = null
    this.#select(verseId, 'verse')
    await this.#refreshDetails()
  }

  // Details of another selection are dropped at once so no surface shows the
  // previous selection's material beside the newly selected one.
  #select(verseId: number, kind: SelectionKind): void {
    this.#selectedVerseId = verseId
    this.#selectionEnd = null
    this.#dropStaleDetails()
    this.#announceSelection(kind)
    this.#notify()
  }

  // Dismissal, not selection: nothing goes on the selection feed, so clearing
  // never reveals the panel.
  clearSelection(): void {
    this.#resetSelection()
    this.#notify()
  }

  #resetSelection(): void {
    this.#selectedVerseId = null
    this.#selectionEnd = null
    this.#wordStrongs = null
    this.#details = null
    this.#loadedDetailsKey = null
  }

  currentChapterReference(): Reference {
    return chapterReference(this.#position)
  }

  extendSelectionTo(verseId: number): void {
    if (this.#selectedVerseId === null) return
    this.#selectionEnd = verseId
    this.#dropStaleDetails()
    this.#notify()
    void this.#refreshDetails()
  }

  selectionReference(): Reference | null {
    if (this.#selectedVerseId === null) return null
    const anchor = this.#selectedVerseId
    const end = this.#selectionEnd ?? anchor
    return {
      book: this.#position.book,
      ranges: [
        { startId: Math.min(anchor, end), endId: Math.max(anchor, end) },
      ],
    }
  }

  chapterAnnotationReference(): Reference {
    return this.selectionReference() ?? this.currentChapterReference()
  }

  // The selection's canonical `{...}` reference, ready to paste into a note
  // and read back by the same parser (spec-books §5) — a no-op while nothing
  // is selected.
  async copyFormattedReference(): Promise<void> {
    const reference = this.selectionReference()
    if (reference === null) return
    await (this.deps.clipboard ?? NAVIGATOR_CLIPBOARD).writeText(
      `{${formatReference(reference)}}`,
    )
  }

  #collectionView(): CollectionView | null {
    if (this.#collection === null) return null
    return {
      members: this.#collection.members.map((member, index) => ({
        label: referenceLabel(member),
        reference: member,
        index,
      })),
      canAddSelection: this.selectionReference() !== null,
      canSave:
        this.#collection.members.length >= CROSS_REFERENCE_MINIMUM_MEMBERS,
      error: this.#collection.error,
      editing: this.#collection.editing !== null,
      confirmingDelete: this.#collection.confirmingDelete,
      description: this.#collection.description,
      typedMember: this.#collection.typed,
    }
  }

  startCollecting(): void {
    this.#collection = {
      members: [],
      error: null,
      confirmingDelete: false,
      editing: null,
      description: '',
      typed: '',
    }
    this.#notify()
  }

  // Opens the same strip pre-loaded with an existing cross-reference's members
  // and description, so editing one reuses the creation flow; saving then
  // writes back to this id instead of making a new entry. A strip already in
  // progress wins: editing would discard it.
  startEditingCrossReference(entry: CrossReference): void {
    if (this.#collection !== null) return
    this.#collection = {
      members: [...entry.members],
      error: null,
      confirmingDelete: false,
      editing: entry.id,
      description: entry.description ?? '',
      typed: '',
    }
    this.#notify()
  }

  describeCollection(description: string): void {
    if (this.#collection === null) return
    this.#collection = { ...this.#collection, description }
    this.#notify()
  }

  cancelCollecting(): void {
    this.#collection = null
    this.#notify()
  }

  addSelectionToCollection(): void {
    const selection = this.selectionReference()
    if (this.#collection === null || selection === null) return
    this.#gather(selection)
    this.#resetSelection()
    this.#notify()
  }

  typeMember(text: string): void {
    if (this.#collection === null) return
    this.#collection = { ...this.#collection, typed: text }
    this.#notify()
  }

  addTypedReferenceToCollection(): void {
    if (this.#collection === null) return
    const trimmed = this.#collection.typed.trim()
    if (trimmed === '') return
    const parsed = parseReference(trimmed, { translationIds: [] })
    if (parsed === null) {
      this.#collection = {
        ...this.#collection,
        error: `${trimmed} is not a reference.`,
      }
      this.#notify()
      return
    }
    this.#gather(parsed.reference)
    this.#collection = { ...this.#collection, typed: '' }
    this.#notify()
  }

  #gather(member: Reference): void {
    if (this.#collection === null) return
    this.#collection = {
      ...this.#collection,
      members: [...this.#collection.members, member],
      error: null,
    }
  }

  removeCollectionMember(index: number): void {
    if (this.#collection === null) return
    this.#collection = {
      ...this.#collection,
      members: this.#collection.members.filter(
        (_member, position) => position !== index,
      ),
    }
    this.#notify()
  }

  // Only an existing cross-reference can be deleted: a strip building a new
  // one has nothing in the store to remove.
  confirmDeleteCrossReference(): void {
    if (this.#collection === null || this.#collection.editing === null) return
    this.#collection = { ...this.#collection, confirmingDelete: true }
    this.#notify()
  }

  cancelDeleteCrossReference(): void {
    if (this.#collection === null) return
    this.#collection = { ...this.#collection, confirmingDelete: false }
    this.#notify()
  }

  async deleteCrossReference(): Promise<void> {
    const editing = this.#collection?.editing ?? null
    if (editing === null) return
    await this.deps.crossReferences.delete(editing)
    this.#collection = null
    await this.refreshOccurrences()
  }

  async saveCrossReference(): Promise<void> {
    const collection = this.#collection
    if (
      collection === null ||
      collection.members.length < CROSS_REFERENCE_MINIMUM_MEMBERS
    )
      return
    const trimmed = collection.description.trim()
    const nextDescription = trimmed === '' ? null : trimmed
    if (collection.editing !== null) {
      await this.deps.crossReferences.update(
        collection.editing,
        collection.members,
        nextDescription,
      )
    } else {
      await this.deps.crossReferences.create(
        collection.members,
        nextDescription,
      )
    }
    this.#collection = null
    // Details already on screen re-read the store so the cross-reference
    // surfaces beside its members without reopening them.
    await this.refreshOccurrences()
  }

  // Verse details carry only translations and Strong's, neither of which the
  // vault index feeds — the chapter-scoped material is all that re-reads it.
  async refreshOccurrences(): Promise<void> {
    await this.#loadChapterMaterial()
  }

  #markerCounts(verseId: number): { annotations: number; mentions: number } {
    return this.#markers.get(verseId) ?? { annotations: 0, mentions: 0 }
  }

  setDetailsWanted(wanted: boolean): void {
    if (this.#detailsWanted === wanted) return
    this.#detailsWanted = wanted
    if (wanted) void this.#refreshDetails()
  }

  // What the current selection's details would cover: the selected span and
  // the tapped word's Strong's numbers. Null while nothing is selected.
  #detailsKey(): string | null {
    const selection = this.selectionReference()
    if (selection === null) return null
    const numbers = this.#wordStrongs?.numbers.join(',') ?? ''
    return `${formatReference(selection)}|${numbers}`
  }

  #dropStaleDetails(): void {
    if (this.#detailsKey() === this.#loadedDetailsKey) return
    this.#details = null
    this.#loadedDetailsKey = null
  }

  // Loads the selection's details when a surface wants them and neither the
  // loaded details nor an in-flight load already covers the selection.
  async #refreshDetails(): Promise<void> {
    if (!this.#detailsWanted) return
    const key = this.#detailsKey()
    if (key === null) return
    if (key === this.#loadedDetailsKey || key === this.#loadingDetailsKey)
      return
    await this.#loadDetails(key)
  }

  // The selected paragraphs are already on screen, so a book's details carry
  // their citation alone rather than repeating the prose beside it.
  #bookDetails(reference: Reference): BookDetailsView | null {
    const citation = bookCitation(reference)
    if (citation === null) return null
    return { citation: citation.attribution }
  }

  async #loadDetails(key: string): Promise<void> {
    const reference = this.selectionReference()
    const anchor = this.#selectedVerseId
    if (reference === null || anchor === null) return
    this.#loadingDetailsKey = key
    try {
      // A book has exactly one layer, so its details carry the paragraph's
      // own citation instead of translation rows (spec-books §5).
      const layers = this.#bookHere() === null ? this.#available : []
      const book = this.#bookDetails(reference)
      const translations = await Promise.all(
        layers.map(
          async (translation): Promise<TranslationRowView> => {
            const passage = await this.deps.passages.passage(
              reference,
              translation.id,
            )
            return {
              id: translation.id,
              label: translation.label,
              name: translation.name,
              segments:
                passage.status === 'ok'
                  ? joinedSegments(passage.verses)
                  : null,
            }
          },
        ),
      )
      const strongs =
        this.#wordStrongs !== null
          ? await this.deps.strongs.entriesFor(this.#wordStrongs.numbers)
          : []
      // A load the selection has moved on from is dropped: only the span on
      // screen may replace what the surfaces are showing.
      if (this.#detailsKey() !== key) return
      this.#details = {
        verseId: anchor,
        title: referenceLabel(reference),
        book,
        translations,
        strongs,
        strongsAttribution:
          strongs.length > 0 ? this.deps.strongs.attribution : null,
        strongsTranslationId:
          strongs.length > 0 ? (this.#wordStrongs?.translationId ?? null) : null,
      }
      this.#loadedDetailsKey = key
      this.#notify()
    } finally {
      if (this.#loadingDetailsKey === key) this.#loadingDetailsKey = null
    }
  }

  // One chapter-level intersection query feeds the panel's annotation and
  // mention lists and the verse markers — no verse selection involved. The
  // token retires a load the reader has navigated away from.
  async #loadChapterMaterial(): Promise<void> {
    const token = ++this.#chapterMaterialToken
    const chapter = chapterReference(this.#position)
    const groups = this.deps.intersecting(chapter)
    this.#markers = verseMarkers(
      groups.map((group) => ({
        file: group.file,
        annotation: isAnnotation(group),
        references: group.occurrences.map(
          (occurrence) => occurrence.reference,
        ),
      })),
      chapter,
    )
    this.#rows = this.#rows.map((row) => ({
      ...row,
      ...this.#markerCounts(row.verseId),
    }))
    this.#notify()
    const mentions = chapterMentionViews(
      groups
        .filter((group) => !isAnnotation(group))
        .map((group) => ({
          file: group.file,
          references: group.occurrences.map(
            (occurrence) => occurrence.reference,
          ),
        })),
      chapter.ranges,
    )
    const items = await loadChapterAnnotations(
      groups,
      this.deps.annotationDetails,
    )
    if (token !== this.#chapterMaterialToken) return
    this.#chapterMentions = mentions
    this.#chapterAnnotationItems = items
    this.#chapterAnnotations = chapterAnnotationViews(
      items,
      chapter.ranges,
      this.#annotationOrdering,
    )
    this.#notify()
  }

  // The chapter list keeps every member, the chapter's own included, so the
  // reader can see which verses of it a cross-reference touches — and the
  // ordering leads with those, so the passage on screen anchors the row.
  #chapterCrossReferences(): CrossReferenceView[] {
    const reference = chapterReference(this.#position)
    return orderCrossReferences(
      this.deps.crossReferences
        .intersecting(reference)
        .map((entry) => crossReferenceView(entry, [])),
      [reference],
    )
  }

  async #loadChapter(): Promise<void> {
    const token = ++this.#loadToken
    this.#status = 'loading'
    this.#verses = []
    this.#rows = []
    this.#notify()
    // Annotations and mentions hang off the vault index alone, so they load
    // beside the passage below instead of holding it up — the verse markers
    // land synchronously either way. Awaited at the end only so callers
    // observe a fully loaded chapter.
    const material = this.#loadChapterMaterial()
    try {
      await this.#loadPassage(token)
    } finally {
      await material
    }
  }

  async #loadPassage(token: number): Promise<void> {
    // Only a position outside the canon can be a book, so scripture never
    // pays for the lookup — and never lands in book mode.
    const isBookPosition = this.#position.book > BOOK_COUNT
    this.#books = isBookPosition
      ? await (this.deps.books ?? NO_BOOKS).installed()
      : []
    if (token !== this.#loadToken) return
    if (isBookPosition) {
      await this.#loadBookPassage(token, this.#bookHere())
      return
    }
    const available = await this.deps.availableTranslations()
    if (token !== this.#loadToken) return
    this.#available = available
    this.#translationId ??= this.#available[0]?.id ?? null
    if (this.#translationId === null) {
      this.#status = 'no-translation'
      this.#notify()
      return
    }
    await this.#refreshStrongsAvailability()
    if (token !== this.#loadToken) return
    const passage = await this.deps.passages.passage(
      chapterReference(this.#position),
      this.#translationId,
    )
    if (token !== this.#loadToken) return
    if (passage.status !== 'ok') {
      this.#status = 'unavailable'
      this.#attribution = null
      this.#notify()
      return
    }
    this.#attribution = passage.attribution
    this.#verses = passage.verses
    this.#rows = this.#rowsOf(passage.verses)
    this.#status = 'ok'
    this.#notify()
  }

  // A book's atoms are paragraphs served by its own edition module, so no
  // translation is involved — an uninstalled book is a content gap like any
  // other (ADR 0002).
  async #loadBookPassage(
    token: number,
    book: ReaderBook | null,
  ): Promise<void> {
    this.#strongsAvailable = false
    this.#epigraphs = []
    if (book === null) {
      this.#status = 'unavailable'
      this.#attribution = null
      this.#notify()
      return
    }
    const [passage, epigraphs] = await Promise.all([
      this.deps.passages.passage(
        chapterReference(this.#position),
        book.editionId,
      ),
      (this.deps.books ?? NO_BOOKS).epigraphs(
        book.editionId,
        this.#position.chapter,
      ),
    ])
    if (token !== this.#loadToken) return
    if (passage.status !== 'ok') {
      this.#status = 'unavailable'
      this.#attribution = null
      this.#notify()
      return
    }
    this.#attribution = passage.attribution
    this.#epigraphs = epigraphs
    this.#verses = passage.verses
    this.#rows = this.#rowsOf(passage.verses)
    this.#status = 'ok'
    this.#notify()
  }

  #emphasizedSegments(verse: PassageVerse): VerseSegment[] {
    return this.#emphasized(verse.segments, verse.verseId, undefined)
  }

  // A span belongs to the atom's text or to one of its Headings, never to
  // both: each is emphasized only by the spans addressed to it.
  #emphasized(
    segments: readonly VerseSegment[],
    verseId: number,
    heading: number | undefined,
  ): VerseSegment[] {
    const spans = this.#emphasis.filter(
      (span) => span.verseId === verseId && span.heading === heading,
    )
    return spans.length === 0
      ? [...segments]
      : markSpanChannel(segments, spans, (segment) => {
          segment.emphasized = true
        })
  }

  #headingRows(verse: PassageVerse): HeadingRowView[] {
    return (verse.headings ?? []).map((heading, index) => ({
      level: heading.level,
      segments: this.#emphasized(
        [{ text: heading.text, redLetter: false }],
        verse.verseId,
        index,
      ),
    }))
  }

  #rowsOf(verses: PassageVerse[]): VerseRowView[] {
    return verses.map((verse) => ({
      verseId: verse.verseId,
      label: `${decodeVerseId(verse.verseId).verse}`,
      segments: this.#emphasizedSegments(verse),
      headings: this.#headingRows(verse),
      figures: verse.figures ?? [],
      keepsLines:
        verse.hasLineData === true && isNonBiblicalBook(this.#position.book),
      poetry: isPoetryVerse(verse.segments, this.#position.book),
      startsParagraph: verse.startsParagraph === true,
      highlighted:
        this.#entry !== null &&
        this.#entry.ranges.some((range) => rangeContains(range, verse.verseId)),
      ...this.#markerCounts(verse.verseId),
    }))
  }

  async refreshTranslations(): Promise<void> {
    this.#available = await this.deps.availableTranslations()
    await this.#refreshStrongsAvailability()
    this.#notify()
  }

  async #refreshStrongsAvailability(): Promise<void> {
    if (this.#bookHere() !== null) {
      this.#strongsAvailable = false
      return
    }
    const current = this.#available.find(
      (translation) => translation.id === this.#translationId,
    )
    this.#strongsAvailable =
      current?.strongsTagged === true &&
      (await this.deps.strongs.dictionariesInstalled())
  }
}
