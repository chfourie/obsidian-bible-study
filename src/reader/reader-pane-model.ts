import {
  BOOK_COUNT,
  bookName,
  chapterCount,
  decodeVerseId,
  formatReference,
  makeVerseId,
  parseReference,
  rangeContains,
  verseCount,
  type Reference,
} from '../reference'
import {
  CROSS_REFERENCE_MINIMUM_MEMBERS,
  crossReferenceView,
  orderCrossReferences,
  type CrossReference,
  type CrossReferenceEditing,
  type CrossReferenceView,
} from '../cross-references'
import type {
  AnnotationBlockView,
  CollectionView,
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
} from '../data-access'
import { isPoetryVerse } from '../rendering'
import type { PassageSource, VerseSegment } from '../rendering'

export { FONT_SCALE_MAX, FONT_SCALE_MIN, FONT_SCALE_STEP }
import type { OccurrenceGroup } from '../vault-index'

export type ReaderToggles = {
  nav: 'tree' | 'breadcrumb'
  layout: 'verse-per-line' | 'continuous'
  strongs: 'off' | 'on'
  redLetter: 'off' | 'on'
}

export type ReaderStrongsDeps = {
  dictionariesInstalled: () => Promise<boolean>
  entriesFor: (numbers: string[]) => Promise<StrongsEntryView[]>
  attribution: string
}

export type ReaderPosition = { book: number; chapter: number }

// How a chapter move reaches the screen. The pane's shell routes user
// navigation through Obsidian's per-pane history and calls `open` back when
// the new position arrives; a model without a shell opens straight away.
export type ReaderNavigation = (
  position: ReaderPosition,
  open: () => Promise<void>,
) => Promise<void>

const OPEN_DIRECTLY: ReaderNavigation = (_position, open) => open()

export type AnnotationOrdering = 'created-oldest-first' | 'path-a-z'

export type AnnotationDetails = {
  body: string
  created: number
}

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
  firstRun?: ReaderFirstRunDeps
}

export type ReaderPaneConfig = {
  toggles: ReaderToggles
  translationId: string | null
  annotationOrdering?: AnnotationOrdering
  fontScalePercent?: number
}

const clampFontScale = (percent: number): number =>
  Math.min(FONT_SCALE_MAX, Math.max(FONT_SCALE_MIN, percent))

export type VerseRowView = {
  verseId: number
  label: string
  segments: VerseSegment[]
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

const singleVerseReference = (book: number, verseId: number): Reference => ({
  book,
  ranges: [{ startId: verseId, endId: verseId }],
})

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

export type ReaderPaneView = {
  status: 'loading' | 'ok' | 'unavailable' | 'no-translation'
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
  #rows: VerseRowView[] = []
  #status: ReaderPaneView['status'] = 'loading'
  #available: ReaderTranslation[] = []
  #toggles: ReaderToggles
  #selectedVerseId: number | null = null
  #selectionEnd: number | null = null
  // The loaded details of the selected verse, or null while nothing is
  // selected or its load is still in flight.
  #details: VerseDetailsView | null = null
  #attribution: string | null = null
  #bannerDismissed = false
  #strongsAvailable = false
  #installingSuggested = false
  #installError: string | null = null
  #wordStrongs: { verseId: number; numbers: string[] } | null = null
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
  readonly #selectionListeners = new Set<() => void>()

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
  onSelection(listener: () => void): () => void {
    this.#selectionListeners.add(listener)
    return () => this.#selectionListeners.delete(listener)
  }

  #announceSelection(): void {
    this.#selectionListeners.forEach((listener) => listener())
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

  setAnnotationOrdering(ordering: AnnotationOrdering): void {
    if (ordering === this.#annotationOrdering) return
    this.#annotationOrdering = ordering
    void this.refreshOccurrences()
  }

  get view(): ReaderPaneView {
    return {
      status: this.#status,
      title: `${bookName(this.#position.book)} ${this.#position.chapter}`,
      position: this.#position,
      rows: this.#rows,
      translations: this.#available.map((translation) => ({
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
          : `Opened at ${formatReference(this.#entry)}`,
    }
  }

  // What this tab offers for study beside its text — the one source the
  // Study Panel renders from.
  get studyMaterial(): StudyMaterial {
    return {
      selectedVerseId: this.#selectedVerseId,
      selectionEndId: this.#selectionEnd,
      details: this.#details,
      chapterCrossReferences: this.#chapterCrossReferences(),
      collection: this.#collectionView(),
    }
  }

  useNavigation(navigate: ReaderNavigation): void {
    this.#navigate = navigate
  }

  // Whether this pane has opened a chapter yet: a pane still showing its
  // construction-time default has no position worth stepping back to.
  get opened(): boolean {
    return this.#loadToken > 0
  }

  async openAt(
    reference: Reference,
    translationId: string | null,
  ): Promise<void> {
    const { book, chapter } = decodeVerseId(reference.ranges[0].startId)
    await this.#navigate({ book, chapter }, async () => {
      this.#moveTo({ book, chapter })
      if (translationId !== null) this.#translationId = translationId
      this.#entry = reference
      this.#bannerDismissed = false
      this.#resetSelection()
      await this.#loadChapter()
    })
  }

  // Opens without touching the pane's history — the shell applies restored
  // and replayed positions through here.
  async openPosition(position: ReaderPosition): Promise<void> {
    this.#moveTo(position)
    this.#entry = null
    this.#resetSelection()
    await this.#loadChapter()
  }

  // A book browsed in the tree outlives chapter moves inside the reader's own
  // book, but the tree follows the reader the moment its book changes.
  #moveTo(position: ReaderPosition): void {
    if (position.book !== this.#position.book) this.#browsedBook = null
    this.#position = { ...position }
  }

  browseBook(book: number): void {
    this.#browsedBook = this.#browsedBook === book ? null : book
    this.#notify()
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

  dismissBanner(): void {
    this.#bannerDismissed = true
    this.#notify()
  }

  // The user's own chapter move: unlike openPosition it walks the pane's
  // navigation history.
  async goTo(book: number, chapter: number): Promise<void> {
    await this.#navigate({ book, chapter }, () =>
      this.openPosition({ book, chapter }),
    )
  }

  #hasNextChapter(): boolean {
    const { book, chapter } = this.#position
    return book < BOOK_COUNT || chapter < chapterCount(book)
  }

  #hasPreviousChapter(): boolean {
    const { book, chapter } = this.#position
    return book > 1 || chapter > 1
  }

  async nextChapter(): Promise<void> {
    if (!this.#hasNextChapter()) return
    const { book, chapter } = this.#position
    if (chapter < chapterCount(book)) await this.goTo(book, chapter + 1)
    else await this.goTo(book + 1, 1)
  }

  async previousChapter(): Promise<void> {
    if (!this.#hasPreviousChapter()) return
    const { book, chapter } = this.#position
    if (chapter > 1) await this.goTo(book, chapter - 1)
    else await this.goTo(book - 1, chapterCount(book - 1))
  }

  async setTranslation(translationId: string): Promise<void> {
    this.#translationId = translationId
    this.#resetSelection()
    await this.#loadChapter()
  }

  async selectWord(verseId: number, strongsNumbers: string[]): Promise<void> {
    this.#wordStrongs = { verseId, numbers: strongsNumbers }
    this.#select(verseId)
    await this.#loadDetails(verseId)
  }

  // A verse click always selects — the details it loads belong to the Study
  // Panel, so there is nothing in the reader to expand or collapse.
  async selectVerse(verseId: number): Promise<void> {
    const loaded = this.#details
    this.#wordStrongs = null
    this.#select(verseId)
    // Re-selecting a verse whose details are already loaded without Strong's
    // entries would reload the same content; tapping a word first leaves
    // entries to clear.
    if (loaded?.verseId === verseId && loaded.strongs.length === 0) return
    await this.#loadDetails(verseId)
  }

  // Details of another verse are dropped at once so no surface shows the
  // previous verse's material beside the newly selected one.
  #select(verseId: number): void {
    this.#selectedVerseId = verseId
    this.#selectionEnd = null
    if (this.#details?.verseId !== verseId) this.#details = null
    this.#announceSelection()
    this.#notify()
  }

  #resetSelection(): void {
    this.#selectedVerseId = null
    this.#selectionEnd = null
    this.#wordStrongs = null
    this.#details = null
  }

  currentChapterReference(): Reference {
    return chapterReference(this.#position)
  }

  extendSelectionTo(verseId: number): void {
    if (this.#selectedVerseId === null) return
    this.#selectionEnd = verseId
    this.#notify()
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

  annotationReference(verseId: number): Reference {
    const selection = this.selectionReference()
    if (
      selection !== null &&
      selection.ranges.some((range) => rangeContains(range, verseId))
    ) {
      return selection
    }
    return singleVerseReference(this.#position.book, verseId)
  }

  #collectionView(): CollectionView | null {
    if (this.#collection === null) return null
    return {
      members: this.#collection.members.map((member, index) => ({
        label: formatReference(member),
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

  async refreshOccurrences(): Promise<void> {
    this.#rows = this.#rows.map((row) => ({
      ...row,
      ...this.#occurrenceCounts(row.verseId),
    }))
    this.#notify()
    const loadedVerseId = this.#details?.verseId
    if (loadedVerseId !== undefined) await this.#loadDetails(loadedVerseId)
  }

  #occurrenceCounts(verseId: number): { annotations: number; mentions: number } {
    const groups = this.deps.intersecting(
      singleVerseReference(this.#position.book, verseId),
    )
    return {
      annotations: groups.filter((occurrence) => occurrence.annotation).length,
      mentions: groups.filter((occurrence) => !occurrence.annotation).length,
    }
  }

  async #loadDetails(verseId: number): Promise<void> {
    const reference = singleVerseReference(this.#position.book, verseId)
    const translations = await Promise.all(
      this.#available.map(async (translation): Promise<TranslationRowView> => {
        const passage = await this.deps.passages.passage(
          reference,
          translation.id,
        )
        return {
          id: translation.id,
          label: translation.label,
          name: translation.name,
          segments:
            passage.status === 'ok' ? passage.verses[0].segments : null,
        }
      }),
    )
    const groups = this.deps.intersecting(reference)
    const annotations = await this.#annotationBlocks(
      groups.filter((occurrence) => occurrence.annotation),
    )
    const strongs =
      this.#wordStrongs !== null && this.#wordStrongs.verseId === verseId
        ? await this.deps.strongs.entriesFor(this.#wordStrongs.numbers)
        : []
    // A load the selection has moved on from is dropped: only the verse on
    // screen may replace what the surfaces are showing.
    if (this.#selectedVerseId !== verseId) return
    this.#details = {
      verseId,
      title: formatReference(reference),
      translations,
      annotations,
      mentions: groups
        .filter((occurrence) => !occurrence.annotation)
        .map((occurrence) => ({ file: occurrence.file })),
      crossReferences: this.#crossReferenceViews(reference, [reference]),
      strongs,
      strongsAttribution:
        strongs.length > 0 ? this.deps.strongs.attribution : null,
    }
    this.#notify()
  }

  // The chapter list keeps every member, the chapter's own included, so the
  // reader can see which verses of it a cross-reference touches — and the
  // ordering leads with those, so the passage on screen anchors the row.
  #chapterCrossReferences(): CrossReferenceView[] {
    return this.#crossReferenceViews(chapterReference(this.#position), [])
  }

  #crossReferenceViews(
    reference: Reference,
    viewed: Reference[],
  ): CrossReferenceView[] {
    return orderCrossReferences(
      this.deps.crossReferences
        .intersecting(reference)
        .map((entry) => crossReferenceView(entry, viewed)),
      [reference],
    )
  }

  async #annotationBlocks(
    groups: OccurrenceGroup[],
  ): Promise<AnnotationBlockView[]> {
    const blocks = await Promise.all(
      groups.map(async (occurrence) => {
        const details = await this.deps.annotationDetails(occurrence.file)
        if (details === null) return null
        return {
          file: occurrence.file,
          body: details.body,
          created: details.created,
        }
      }),
    )
    return blocks
      .filter((block) => block !== null)
      .sort((a, b) =>
        this.#annotationOrdering === 'created-oldest-first'
          ? a.created - b.created
          : a.file.localeCompare(b.file),
      )
      .map(({ file, body }) => ({ file, body }))
  }

  async #loadChapter(): Promise<void> {
    const token = ++this.#loadToken
    this.#status = 'loading'
    this.#rows = []
    this.#notify()
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
    this.#rows = passage.verses.map((verse) => ({
      verseId: verse.verseId,
      label: `${decodeVerseId(verse.verseId).verse}`,
      segments: verse.segments,
      poetry: isPoetryVerse(verse.segments, this.#position.book),
      startsParagraph: verse.startsParagraph === true,
      highlighted:
        this.#entry !== null &&
        this.#entry.ranges.some((range) => rangeContains(range, verse.verseId)),
      ...this.#occurrenceCounts(verse.verseId),
    }))
    this.#status = 'ok'
    this.#notify()
  }

  async refreshTranslations(): Promise<void> {
    this.#available = await this.deps.availableTranslations()
    await this.#refreshStrongsAvailability()
    this.#notify()
  }

  async #refreshStrongsAvailability(): Promise<void> {
    const current = this.#available.find(
      (translation) => translation.id === this.#translationId,
    )
    this.#strongsAvailable =
      current?.strongsTagged === true &&
      (await this.deps.strongs.dictionariesInstalled())
  }
}
