import type { NavigationOptions } from '../contracts'
import {
  crossReferenceView,
  orderCrossReferences,
  type CrossReference,
  type CrossReferenceView,
} from '../cross-references'
import {
  decodeVerseId,
  formatReference,
  mergeRanges,
  referencesIntersect,
  type Reference,
} from '../reference'
import type { PassageSource, PassageVerse } from '../rendering'
import type { ExtractedOccurrence } from '../vault-index'

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
  status: StudyPanelStatus
  entries: ReferenceEntryView[]
  crossReferences: CrossReferenceView[]
}

export type StudyPanelCrossReferences = {
  intersecting: (reference: Reference) => CrossReference[]
}

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
}

export type StudyPanelConfig = { translationId: string | null }

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
  #translationId: string | null
  #loadToken = 0
  readonly #listeners = new Set<() => void>()

  constructor(
    private readonly deps: StudyPanelDeps,
    config: StudyPanelConfig,
  ) {
    this.#translationId = config.translationId
  }

  subscribe(listener: () => void): () => void {
    this.#listeners.add(listener)
    return () => this.#listeners.delete(listener)
  }

  get view(): StudyPanelViewState {
    return {
      file: this.#file,
      status: this.#status(),
      entries: this.#entries,
      crossReferences: this.#crossReferences,
    }
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
      this.#file = null
      this.#entries = []
      this.#crossReferences = []
      this.#notify()
      return
    }
    this.#file = note.file
    this.#entries = this.#pendingEntries(note.content)
    this.#crossReferences = this.#computeCrossReferences()
    this.#notify()
    await this.#loadEntries(token)
  }

  // Cross-references are not notes: occurrence indexing does not apply, so
  // the caller wires store changes to this explicitly (mirroring the reader).
  refreshCrossReferences(): void {
    this.#crossReferences = this.#computeCrossReferences()
    this.#notify()
  }

  #computeCrossReferences(): CrossReferenceView[] {
    const references = this.#entries.map((entry) => entry.reference)
    const seen = new Map<string, CrossReferenceView>()
    for (const reference of references) {
      for (const entry of this.deps.crossReferences.intersecting(reference)) {
        if (!seen.has(entry.id))
          seen.set(entry.id, crossReferenceView(entry, references))
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
