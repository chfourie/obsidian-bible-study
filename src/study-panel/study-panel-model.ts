import { orderChapterAnnotations } from '../annotations'
import type {
  ChapterAnnotationView,
  ChapterMentionView,
  NavigationOptions,
  StudyMaterial,
  StudyMaterialSource,
} from '../contracts'
import {
  crossReferenceView,
  orderCrossReferences,
  type CrossReference,
  type CrossReferenceView,
} from '../cross-references'
import type { AnnotationOrdering } from '../data-access'
import { chapterMentionViews } from '../mentions'
import {
  decodeVerseId,
  formatReference,
  mergeRanges,
  referencesIntersect,
  type Reference,
} from '../reference'
import type { PassageSource, PassageVerse } from '../rendering'
import type {
  ExtractedOccurrence,
  Occurrence,
  OccurrenceGroup,
} from '../vault-index'
import { freshTabState, type StudyTabState } from './tab-memory'

export type ReferenceEntryVerse = { label: string | null; text: string }

export type ReferenceEntryStatus = 'loading' | 'ok' | 'unavailable'

export type ReferenceEntryView = {
  key: string
  label: string
  reference: Reference
  // The explicit translation token from the note, if any; the passage loads
  // with it, falling back to the default translation.
  translation: string | null
  translationLabel: string | null
  status: ReferenceEntryStatus
  verses: ReferenceEntryVerse[]
  attribution: string | null
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
  // The followed tab's own state: which passage entries stay folded — every
  // entry the tab has not unfolded.
  folded: ReadonlySet<string>
}

export type StudyPanelCrossReferences = {
  intersecting: (reference: Reference) => CrossReference[]
}

export type AnnotationDetails = { body: string; created: number }

export type StudyPanelDeps = {
  passages: PassageSource
  extract: (content: string) => ExtractedOccurrence[]
  crossReferences: StudyPanelCrossReferences
  // The panel surfaces cross-references but never edits them in place: editing
  // happens in the reader's strip, which lives outside the panel.
  editCrossReference: (
    entry: CrossReference,
    options?: NavigationOptions,
  ) => void
  // The vault index's intersection query, the same shape the reader takes.
  intersecting: (reference: Reference) => OccurrenceGroup[]
  annotationDetails: (file: string) => Promise<AnnotationDetails | null>
}

export type StudyPanelConfig = {
  translationId: string | null
  annotationOrdering?: AnnotationOrdering
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

const noteName = (file: string): string => {
  const base = file.split('/').pop() ?? file
  return base.replace(/\.[^.]+$/, '')
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
  #mentions: ChapterMentionView[] = []
  #annotationOrdering: AnnotationOrdering
  #translationId: string | null
  #loadToken = 0
  #intersectionToken = 0
  #studySource: StudyMaterialSource | null = null
  #unsubscribeStudySource: (() => void) | null = null
  #tabState: StudyTabState = freshTabState()
  readonly #listeners = new Set<() => void>()

  constructor(
    private readonly deps: StudyPanelDeps,
    config: StudyPanelConfig,
  ) {
    this.#translationId = config.translationId
    this.#annotationOrdering = config.annotationOrdering ?? 'created-oldest-first'
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
      folded: this.#folded(),
    }
  }

  // The state of the tab now being followed, or null while none is: state the
  // panel writes lands in the tab's own memory, so refocusing it restores it.
  useTabState(state: StudyTabState | null): void {
    this.#tabState = state ?? freshTabState()
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

  // The focused reader tab itself, for the actions the panel invokes on it.
  get studySource(): StudyMaterialSource | null {
    return this.#studySource
  }

  // Mirrors the given reader tab until another one is shown, or null to fall
  // back to the note view.
  showStudyMaterial(source: StudyMaterialSource | null): void {
    if (source === this.#studySource) return
    this.#unsubscribeStudySource?.()
    this.#studySource = source
    this.#unsubscribeStudySource =
      source === null ? null : source.subscribe(() => this.#notify())
    this.#notify()
  }

  #title(): string | null {
    if (this.#studySource !== null) return this.#studySource.studyMaterial.title
    if (this.#file === null) return null
    return noteName(this.#file)
  }

  #status(): StudyPanelStatus {
    if (this.#file === null) return 'no-note'
    if (this.#entries.length === 0) return 'no-references'
    const someLoadable = this.#entries.some(
      (entry) => (entry.translation ?? this.#translationId) !== null,
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
      this.#mentions = []
      this.#notify()
      return
    }
    this.#file = note.file
    this.#entries = this.#pendingEntries(note.content)
    this.#crossReferences = this.#computeCrossReferences()
    this.#notify()
    await Promise.all([
      this.#loadEntries(token),
      this.#loadIntersectingNotes(),
    ])
  }

  // Cross-references are not notes: occurrence indexing does not apply, so
  // the caller wires store changes to this explicitly (mirroring the reader).
  refreshCrossReferences(): void {
    this.#crossReferences = this.#computeCrossReferences()
    this.#notify()
  }

  // The annotation and mention sections come from the vault index, whose
  // change feed the caller wires to this (mirroring the reader).
  async refreshIntersectingNotes(): Promise<void> {
    await this.#loadIntersectingNotes()
  }

  setAnnotationOrdering(ordering: AnnotationOrdering): void {
    if (ordering === this.#annotationOrdering) return
    this.#annotationOrdering = ordering
    void this.#loadIntersectingNotes()
  }

  // Every note reference queried once, the hits merged per file so a note
  // intersecting several references appears once, positioned and labelled by
  // everything of it that intersects any of them.
  #intersectingGroups(references: Reference[]): OccurrenceGroup[] {
    const merged = new Map<
      string,
      { annotation: boolean; occurrences: Map<string, Occurrence> }
    >()
    for (const reference of references) {
      for (const group of this.deps.intersecting(reference)) {
        if (group.file === this.#file) continue
        const entry = merged.get(group.file) ?? {
          annotation: false,
          occurrences: new Map<string, Occurrence>(),
        }
        entry.annotation ||= group.annotation
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
      annotation: entry.annotation,
      occurrences: [...entry.occurrences.values()],
    }))
  }

  async #loadIntersectingNotes(): Promise<void> {
    const token = ++this.#intersectionToken
    const references = this.#entries.map((entry) => entry.reference)
    if (references.length === 0) {
      this.#annotations = []
      this.#mentions = []
      this.#notify()
      return
    }
    // The ordering helpers scope by plain range overlap, so one scope carries
    // all the note's references even across books: verse ids encode the book,
    // and ranges from different books never overlap.
    const scope: Reference = {
      book: references[0].book,
      ranges: mergeRanges(references.flatMap((reference) => reference.ranges)),
    }
    const groups = this.#intersectingGroups(references)
    const mentions = chapterMentionViews(
      groups
        .filter((group) => !group.annotation)
        .map((group) => ({
          file: group.file,
          references: group.occurrences.map(
            (occurrence) => occurrence.reference,
          ),
        })),
      scope,
    )
    const items = await Promise.all(
      groups
        .filter((group) => group.annotation)
        .map(async (group) => {
          const reference = group.occurrences.find(
            (occurrence) => occurrence.source === 'annotation-frontmatter',
          )?.reference
          if (reference === undefined) return null
          const details = await this.deps.annotationDetails(group.file)
          if (details === null) return null
          return {
            file: group.file,
            created: details.created,
            reference,
            body: details.body,
          }
        }),
    )
    if (token !== this.#intersectionToken) return
    this.#mentions = mentions
    this.#annotations = orderChapterAnnotations(
      items.filter((item) => item !== null),
      scope,
      this.#annotationOrdering,
    ).map(({ file, reference, body }) => ({
      file,
      label: formatReference(reference),
      body,
    }))
    this.#notify()
  }

  #computeCrossReferences(): CrossReferenceView[] {
    const references = this.#entries.map((entry) => entry.reference)
    const seen = new Map<string, CrossReferenceView>()
    for (const reference of references) {
      for (const entry of this.deps.crossReferences.intersecting(reference)) {
        // Every member is listed, the note's own reference included: without
        // it there is nothing to say what the others are references to.
        if (!seen.has(entry.id)) seen.set(entry.id, crossReferenceView(entry, []))
      }
    }
    return orderCrossReferences([...seen.values()], references)
  }

  editCrossReference(id: string, options?: NavigationOptions): void {
    const entry = this.#crossReferences.find((candidate) => candidate.id === id)
    if (entry === undefined) return
    this.deps.editCrossReference(
      {
        id,
        members: entry.allMembers,
        description: entry.description,
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
      translationLabel: this.#translationLabel(entry.translation),
      status: 'loading',
      verses: [],
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
      const label = formatReference(reference)
      return {
        key: `${translation ?? ''}|${label}`,
        label,
        reference,
        translation,
        translationLabel: this.#translationLabel(translation),
        status: 'loading',
        verses: [],
        attribution: null,
      }
    })
  }

  #translationLabel(translation: string | null): string | null {
    return (translation ?? this.#translationId)?.toUpperCase() ?? null
  }

  async #loadEntries(token: number): Promise<void> {
    await Promise.all(
      this.#entries.map(async (entry) => {
        const translationId = entry.translation ?? this.#translationId
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
        return { ...entry, status: 'unavailable', verses: [], attribution: null }
      const labels = verseLabels(passage.verses)
      return {
        ...entry,
        status: 'ok',
        verses: passage.verses.map((verse, index) => ({
          label: labels[index],
          text: verse.segments.map((segment) => segment.text).join(''),
        })),
        attribution: passage.attribution,
      }
    })
  }

  #notify(): void {
    this.#listeners.forEach((listener) => listener())
  }
}
