import {
  chapterAnnotationViews,
  loadChapterAnnotations,
  type AnnotationDetails,
  type LoadedChapterAnnotation,
} from '../annotations'
import type {
  ChapterAnnotationView,
  ChapterMentionView,
  NavigationOptions,
  StudyMaterial,
  StudyMaterialSource,
  CrossReference,
} from '../contracts'
import {
  crossReferenceViews,
  orderCrossReferences,
  type CrossReferenceView,
} from '../cross-references'
import type { AnnotationOrdering } from '../data-access'
import { chapterMentionViews } from '../mentions'
import {
  bookCitation,
  decodeVerseId,
  formatReference,
  mergeRanges,
  referencesIntersect,
  type BookCitation,
  type Reference,
  type VerseRange,
} from '../reference'
import {
  exceedsDisplayVerseLimit,
  isVerseGap,
  type PassageSource,
  type PassageVerse,
  type VerseSegment,
} from '../rendering'
import type { StudySubTab } from '../study-material'
import {
  isMention,
  noteTitle,
  type CrossReferenceDeclaration,
  type ExtractedOccurrence,
  type Occurrence,
  type OccurrenceGroup,
} from '../vault-index'
import {
  freshTabState,
  hasAnnotationMemory,
  type StudyTabState,
} from './tab-memory'

// A cited verse as the panel prints it: its segments from the one segmenter,
// so a supplied word or an Editorial mark paints here as it does in the
// reader (spec-books §10).
export type ReferenceEntryVerse = {
  label: string | null
  segments: VerseSegment[]
}

// One line the panel prints for an entry: a cited verse, or the ellipsis that
// stands where the reference skipped verses (CONTEXT.md — Verse Gap). The
// panel lists whole verses, so a gap is the only thing that ever elides here.
export type ReferenceEntryLine =
  | { kind: 'verse'; verse: ReferenceEntryVerse }
  | { kind: 'ellipsis' }

export const entryVerses = (entry: {
  lines: readonly ReferenceEntryLine[]
}): ReferenceEntryVerse[] =>
  entry.lines.flatMap((line) => (line.kind === 'verse' ? [line.verse] : []))

export type ReferenceEntryStatus =
  | 'loading'
  | 'ok'
  | 'unavailable'
  | 'too-long'

export type ReferenceEntryView = {
  key: string
  label: string
  reference: Reference
  // The explicit translation token from the note, if any; the passage loads
  // with it, falling back to the default translation.
  translation: string | null
  translationLabel: string | null
  status: ReferenceEntryStatus
  lines: ReferenceEntryLine[]
  attribution: string | null
  // Present for an installed non-biblical book: its edition module fills the
  // translation slot outright and its full citation stands in for the
  // module's license attribution (spec-books §6).
  book: BookCitation | null
}

export type StudyPanelStatus =
  | 'no-note'
  | 'no-references'
  | 'no-translation'
  | 'ok'

export type StudyPanelViewState = {
  file: string | null
  // Names what the panel shows: the followed reader's title while one is
  // shown, otherwise the note's name; null when neither is present.
  title: string | null
  status: StudyPanelStatus
  entries: ReferenceEntryView[]
  crossReferences: CrossReferenceView[]
  // The vault notes intersecting the note's references, the note itself
  // excluded: dedicated annotations first, plain mentions beside them, each
  // shaped exactly as the reader-tab sections show them.
  annotations: ChapterAnnotationView[]
  mentions: ChapterMentionView[]
  // Non-null while a reader tab holds focus: the panel then mirrors that tab's
  // study material, and the note fields above describe the note it will fall
  // back to when a note is focused again.
  studyMaterial: StudyMaterial | null
  // The followed tab's own state: the sub-tab its material shows under,
  // which passage entries stay folded — every entry the tab has not
  // unfolded — which annotation rows stay folded, keyed by the annotation
  // note's path, and which translation blocks it collapsed.
  subTab: StudySubTab
  folded: ReadonlySet<string>
  foldedAnnotations: ReadonlySet<string>
  collapsedTranslations: ReadonlySet<string>
}

export type { AnnotationDetails } from '../annotations'

export type StudyPanelDeps = {
  passages: PassageSource
  extract: (content: string) => ExtractedOccurrence[]
  // The panel surfaces cross-references but never edits them in place: editing
  // happens in the reader's strip, which lives outside the panel.
  editCrossReference: (
    entry: CrossReference,
    options?: NavigationOptions,
  ) => void
  // The vault index's intersection query, the same shape the reader takes:
  // annotations, mentions and cross-reference rows all come out of it.
  intersecting: (reference: Reference) => OccurrenceGroup[]
  annotationDetails: (file: string) => Promise<AnnotationDetails | null>
}

export type StudyPanelConfig = {
  translationId: string | null
  annotationOrdering?: AnnotationOrdering
  // Whether annotation rows start open on a tab the panel has no memory of;
  // they start folded unless told otherwise.
  annotationsStartExpanded?: boolean
}

export type ActiveNote = { file: string; content: string }

// Verse numbers only make sense when there is more than one verse to tell
// apart; chapter-qualified once the entry crosses a chapter boundary.
const verseLabels = (verses: PassageVerse[]): (string | null)[] => {
  if (verses.length <= 1) return verses.map(() => null)
  const locations = verses.map((verse) => decodeVerseId(verse.verseId))
  const multiChapter = locations.some(
    (location) => location.chapter !== locations[0].chapter,
  )
  return locations.map((location) =>
    multiChapter ? `${location.chapter}:${location.verse}` : `${location.verse}`,
  )
}

// The entry's lines in reading order, with an ellipsis wherever the reference
// skipped verses; a verse the translation does not serve is a content gap and
// stands for nothing (spec §Verse Gap).
const entryLines = (
  verses: PassageVerse[],
  labels: (string | null)[],
  reference: Reference,
): ReferenceEntryLine[] => {
  const lines: ReferenceEntryLine[] = []
  let previousVerseId: number | null = null
  verses.forEach((verse, index) => {
    if (
      previousVerseId !== null &&
      isVerseGap(previousVerseId, verse.verseId, reference)
    ) {
      lines.push({ kind: 'ellipsis' })
    }
    lines.push({
      kind: 'verse',
      verse: { label: labels[index], segments: verse.segments },
    })
    previousVerseId = verse.verseId
  })
  return lines
}

type PanelReference = { reference: Reference; translation: string | null }

// Intersecting same-translation references collapse into one entry covering
// their union, at the position of the earliest of them; a later reference
// bridging two earlier entries folds all three together. References naming
// different translations stay separate — they show different text.
const combineIntersecting = (references: PanelReference[]): PanelReference[] => {
  const combined: PanelReference[] = []
  for (const candidate of references) {
    let merged = candidate
    let insertAt = combined.length
    for (let index = combined.length - 1; index >= 0; index -= 1) {
      const existing = combined[index]
      if (existing.translation !== merged.translation) continue
      if (!referencesIntersect(existing.reference, merged.reference)) continue
      merged = {
        translation: merged.translation,
        reference: {
          book: merged.reference.book,
          ranges: mergeRanges([
            ...existing.reference.ranges,
            ...merged.reference.ranges,
          ]),
        },
      }
      combined.splice(index, 1)
      insertAt = index
    }
    combined.splice(insertAt, 0, merged)
  }
  return combined
}

export class StudyPanelModel {
  #file: string | null = null
  #entries: ReferenceEntryView[] = []
  #crossReferences: CrossReferenceView[] = []
  #annotations: ChapterAnnotationView[] = []
  // The loaded annotations and the scope they were placed against, kept so a
  // changed ordering re-sorts them without re-reading any note.
  #annotationItems: LoadedChapterAnnotation[] = []
  #annotationScope: readonly VerseRange[] = []
  #mentions: ChapterMentionView[] = []
  #annotationOrdering: AnnotationOrdering
  #annotationsStartExpanded: boolean
  #translationId: string | null
  #loadToken = 0
  #intersectionToken = 0
  #studySource: StudyMaterialSource | null = null
  #unsubscribeStudySource: (() => void) | null = null
  #tabState: StudyTabState
  readonly #listeners = new Set<() => void>()

  constructor(
    private readonly deps: StudyPanelDeps,
    config: StudyPanelConfig,
  ) {
    this.#translationId = config.translationId
    this.#annotationOrdering = config.annotationOrdering ?? 'created-oldest-first'
    this.#annotationsStartExpanded = config.annotationsStartExpanded ?? false
    this.#tabState = freshTabState(this.#annotationsStartExpanded)
  }

  subscribe(listener: () => void): () => void {
    this.#listeners.add(listener)
    return () => this.#listeners.delete(listener)
  }

  get view(): StudyPanelViewState {
    return {
      file: this.#file,
      title: this.#title(),
      status: this.#status(),
      entries: this.#entries,
      crossReferences: this.#crossReferences,
      annotations: this.#annotations,
      mentions: this.#mentions,
      studyMaterial: this.#studySource?.studyMaterial ?? null,
      subTab: this.#tabState.subTab,
      folded: this.#folded(),
      foldedAnnotations: this.#foldedAnnotations(),
      collapsedTranslations: this.#tabState.collapsedTranslations,
    }
  }

  // The state of the tab now being followed, or null while none is: state the
  // panel writes lands in the tab's own memory, so refocusing it restores it.
  useTabState(state: StudyTabState | null): void {
    this.#tabState = state ?? freshTabState(this.#annotationsStartExpanded)
    this.#syncWanted()
    this.#notify()
  }

  selectSubTab(subTab: StudySubTab): void {
    if (this.#tabState.subTab === subTab) return
    this.#tabState.subTab = subTab
    this.#syncWanted()
    this.#notify()
  }

  // The followed reader loads translation texts only while the Selection
  // tab shows them — but a book has no such tab, so its paragraph details are
  // wanted for as long as the panel mirrors it (spec-books §5).
  #syncWanted(): void {
    const source = this.#studySource
    if (source === null) return
    const { bookMode } = source.studyMaterial
    source.setDetailsWanted(bookMode || this.#tabState.subTab === 'selection')
    // A book never has a Word Cloud, so only a scripture tab on the Study
    // tab wants one.
    source.setWordCloudWanted(!bookMode && this.#tabState.subTab === 'chapter')
  }

  toggleTranslationFold(id: string): void {
    const collapsed = new Set(this.#tabState.collapsedTranslations)
    if (!collapsed.delete(id)) collapsed.add(id)
    this.#setCollapsedTranslations(collapsed)
  }

  collapseAllTranslations(): void {
    this.#setCollapsedTranslations(
      new Set(
        (this.#studySource?.studyMaterial.details?.translations ?? []).map(
          (row) => row.id,
        ),
      ),
    )
  }

  expandAllTranslations(): void {
    this.#setCollapsedTranslations(new Set())
  }

  #setCollapsedTranslations(collapsed: ReadonlySet<string>): void {
    this.#tabState.collapsedTranslations = collapsed
    this.#notify()
  }

  toggleFold(key: string): void {
    const expanded = new Set(this.#tabState.expanded)
    if (!expanded.delete(key)) expanded.add(key)
    this.#setExpanded(expanded)
  }

  foldAll(): void {
    this.#setExpanded(new Set())
  }

  expandAll(): void {
    this.#setExpanded(new Set(this.#entries.map((entry) => entry.key)))
  }

  // A passage costs a scroll to read past, so entries open only where the tab
  // asked for them; everything it has not unfolded is folded.
  #folded(): ReadonlySet<string> {
    const expanded = this.#tabState.expanded
    return new Set(
      this.#entries
        .map((entry) => entry.key)
        .filter((key) => !expanded.has(key)),
    )
  }

  #setExpanded(expanded: ReadonlySet<string>): void {
    this.#tabState.expanded = expanded
    this.#notify()
  }

  toggleAnnotationFold(file: string): void {
    const toggled = new Set(this.#tabState.toggledAnnotations)
    if (!toggled.delete(file)) toggled.add(file)
    this.#setToggledAnnotations(toggled)
  }

  foldAllAnnotations(): void {
    this.#setToggledAnnotations(
      this.#tabState.annotationsStartExpanded
        ? this.#shownAnnotationFiles()
        : new Set(),
    )
  }

  expandAllAnnotations(): void {
    this.#setToggledAnnotations(
      this.#tabState.annotationsStartExpanded
        ? new Set()
        : this.#shownAnnotationFiles(),
    )
  }

  // A changed default reaches the tabs that have arranged no annotation row
  // of their own — including the one followed now — and every tab followed
  // from here on; a tab with memory keeps what it arranged.
  setAnnotationsStartExpanded(startExpanded: boolean): void {
    this.#annotationsStartExpanded = startExpanded
    if (!hasAnnotationMemory(this.#tabState))
      this.#tabState.annotationsStartExpanded = startExpanded
    this.#notify()
  }

  // Annotation rows start as the tab's memory says they start, and each row
  // the tab toggled stands the other way: keyed by the note's path, so a
  // re-sort or a reload of the same notes changes nothing.
  #foldedAnnotations(): ReadonlySet<string> {
    const { annotationsStartExpanded, toggledAnnotations } = this.#tabState
    return new Set(
      [...this.#shownAnnotationFiles()].filter(
        (file) => toggledAnnotations.has(file) === annotationsStartExpanded,
      ),
    )
  }

  // The annotations on screen: the mirrored reader's chapter annotations
  // while a reader is followed, otherwise the note's.
  #shownAnnotationFiles(): Set<string> {
    const shown =
      this.#studySource?.studyMaterial.chapterAnnotations ?? this.#annotations
    return new Set(shown.map((item) => item.file))
  }

  #setToggledAnnotations(toggled: ReadonlySet<string>): void {
    this.#tabState.toggledAnnotations = toggled
    this.#notify()
  }

  // The focused reader tab itself, for the actions the panel invokes on it.
  get studySource(): StudyMaterialSource | null {
    return this.#studySource
  }

  // Mirrors the given reader tab until another one is shown, or null to fall
  // back to the note view. The new tab's details wanted state waits for its
  // remembered state to arrive through useTabState — the caller always pairs
  // the two — so the old tab's sub-tab never triggers a load on the new one.
  showStudyMaterial(source: StudyMaterialSource | null): void {
    if (source === this.#studySource) return
    this.#studySource?.setDetailsWanted(false)
    this.#studySource?.setWordCloudWanted(false)
    this.#unsubscribeStudySource?.()
    this.#studySource = source
    // A tab that walks from scripture into a book changes where its details
    // belong, so what it wants is re-read with every change it reports.
    this.#unsubscribeStudySource =
      source === null
        ? null
        : source.subscribe(() => {
            this.#syncWanted()
            this.#notify()
          })
    this.#notify()
  }

  #title(): string | null {
    if (this.#studySource !== null) return this.#studySource.studyMaterial.title
    if (this.#file === null) return null
    return noteTitle(this.#file)
  }

  #status(): StudyPanelStatus {
    if (this.#file === null) return 'no-note'
    if (this.#entries.length === 0) return 'no-references'
    const someLoadable = this.#entries.some(
      (entry) => this.#slotFor(entry) !== null,
    )
    return someLoadable ? 'ok' : 'no-translation'
  }

  async setActiveNote(note: ActiveNote | null): Promise<void> {
    const token = ++this.#loadToken
    if (note === null) {
      this.#intersectionToken += 1
      this.#file = null
      this.#entries = []
      this.#crossReferences = []
      this.#annotations = []
      this.#annotationItems = []
      this.#annotationScope = []
      this.#mentions = []
      this.#notify()
      return
    }
    this.#file = note.file
    this.#entries = this.#pendingEntries(note.content)
    this.#notify()
    await Promise.all([
      this.#loadEntries(token),
      this.#loadIntersectingNotes(),
    ])
  }

  // The annotation, mention and cross-reference sections all come from the
  // vault index, whose change feed the caller wires to this (mirroring the
  // reader).
  async refreshIntersectingNotes(): Promise<void> {
    await this.#loadIntersectingNotes()
  }

  // Ordering is pure, so the loaded annotations re-sort in place — no
  // re-query, no re-read of the notes.
  setAnnotationOrdering(ordering: AnnotationOrdering): void {
    if (ordering === this.#annotationOrdering) return
    this.#annotationOrdering = ordering
    this.#annotations = chapterAnnotationViews(
      this.#annotationItems,
      this.#annotationScope,
      ordering,
    )
    this.#notify()
  }

  // Every note reference queried once, the hits merged per file so a note
  // intersecting several references appears once, positioned and labelled by
  // everything of it that intersects any of them.
  #intersectingGroups(references: Reference[]): OccurrenceGroup[] {
    const merged = new Map<
      string,
      {
        annotationReference: Reference | null
        crossReference: CrossReferenceDeclaration | null
        occurrences: Map<string, Occurrence>
      }
    >()
    for (const reference of references) {
      for (const group of this.deps.intersecting(reference)) {
        if (group.file === this.#file) continue
        const entry = merged.get(group.file) ?? {
          annotationReference: null,
          crossReference: null,
          occurrences: new Map<string, Occurrence>(),
        }
        entry.annotationReference ??= group.annotationReference
        entry.crossReference ??= group.crossReference
        for (const occurrence of group.occurrences)
          entry.occurrences.set(
            `${occurrence.source}|${occurrence.position}`,
            occurrence,
          )
        merged.set(group.file, entry)
      }
    }
    return [...merged.entries()].map(([file, entry]) => ({
      file,
      annotationReference: entry.annotationReference,
      crossReference: entry.crossReference,
      occurrences: [...entry.occurrences.values()],
    }))
  }

  async #loadIntersectingNotes(): Promise<void> {
    const token = ++this.#intersectionToken
    const references = this.#entries.map((entry) => entry.reference)
    if (references.length === 0) {
      this.#crossReferences = []
      this.#annotations = []
      this.#annotationItems = []
      this.#annotationScope = []
      this.#mentions = []
      this.#notify()
      return
    }
    // The ordering helpers place notes by plain range overlap, so the scope
    // is simply every range of every note reference, whatever book each is in.
    const scope = references.flatMap((reference) => reference.ranges)
    const groups = this.#intersectingGroups(references)
    // Every member is listed, the note's own reference included: without it
    // there is nothing to say what the others are references to. The rows
    // need no note read, so they land before the annotations do.
    this.#crossReferences = orderCrossReferences(
      crossReferenceViews(groups),
      references,
    )
    this.#notify()
    const mentions = chapterMentionViews(
      groups
        .filter(isMention)
        .map((group) => ({
          file: group.file,
          references: group.occurrences.map(
            (occurrence) => occurrence.reference,
          ),
        })),
      scope,
    )
    const items = await loadChapterAnnotations(
      groups,
      this.deps.annotationDetails,
    )
    if (token !== this.#intersectionToken) return
    this.#mentions = mentions
    this.#annotationItems = items
    this.#annotationScope = scope
    this.#annotations = chapterAnnotationViews(
      items,
      scope,
      this.#annotationOrdering,
    )
    this.#notify()
  }

  editCrossReference(path: string, options?: NavigationOptions): void {
    const entry = this.#crossReferences.find((candidate) => candidate.path === path)
    if (entry === undefined) return
    this.deps.editCrossReference(
      {
        path,
        members: entry.members.map((member) => member.reference),
        summary: entry.summary,
      },
      options,
    )
  }

  async setTranslation(translationId: string | null): Promise<void> {
    if (translationId === this.#translationId) return
    this.#translationId = translationId
    const token = ++this.#loadToken
    this.#entries = this.#entries.map((entry) => ({
      ...entry,
      translationLabel:
        entry.book === null ? this.#translationLabel(entry.translation) : null,
      status: 'loading',
      lines: [],
      attribution: null,
    }))
    this.#notify()
    await this.#loadEntries(token)
  }

  #pendingEntries(content: string): ReferenceEntryView[] {
    const references = combineIntersecting(
      this.deps.extract(content).map((occurrence) => ({
        reference: occurrence.reference,
        translation: occurrence.translation,
      })),
    )
    return references.map(({ reference, translation }) => {
      const book = bookCitation(reference)
      const label = book?.reference ?? formatReference(reference)
      return {
        key: `${translation ?? ''}|${label}`,
        label,
        reference,
        translation,
        translationLabel:
          book === null ? this.#translationLabel(translation) : null,
        status: exceedsDisplayVerseLimit(reference) ? 'too-long' : 'loading',
        lines: [],
        attribution: null,
        book,
      }
    })
  }

  #translationLabel(translation: string | null): string | null {
    return (translation ?? this.#translationId)?.toUpperCase() ?? null
  }

  // Which layer an entry's text comes from: a book's own edition module wins
  // outright, then the note's own translation token, then the default.
  #slotFor(entry: ReferenceEntryView): string | null {
    return entry.book?.moduleId ?? entry.translation ?? this.#translationId
  }

  async #loadEntries(token: number): Promise<void> {
    await Promise.all(
      this.#entries.map(async (entry) => {
        if (entry.status === 'too-long') return
        const translationId = this.#slotFor(entry)
        const passage =
          translationId === null
            ? ({ status: 'unavailable' } as const)
            : await this.deps.passages.passage(entry.reference, translationId)
        if (token !== this.#loadToken) return
        this.#applyPassage(entry.key, passage)
        this.#notify()
      }),
    )
  }

  #applyPassage(
    key: string,
    passage: Awaited<ReturnType<PassageSource['passage']>>,
  ): void {
    this.#entries = this.#entries.map((entry) => {
      if (entry.key !== key) return entry
      if (passage.status !== 'ok')
        return { ...entry, status: 'unavailable', lines: [], attribution: null }
      const labels = verseLabels(passage.verses)
      return {
        ...entry,
        status: 'ok',
        lines: entryLines(passage.verses, labels, entry.reference),
        attribution: entry.book?.attribution ?? passage.attribution,
      }
    })
  }

  #notify(): void {
    this.#listeners.forEach((listener) => listener())
  }
}
