import type { ModuleManifest } from '../modules'
import {
  bookName,
  decodeVerseId,
  formatReference,
  makeVerseId,
  rangeContains,
  verseCount,
  type Reference,
} from '../reference'
import type { PassageSource, VerseSegment } from '../rendering'
import type { OccurrenceGroup } from '../vault-index'

export type ReaderToggles = {
  details: 'inline' | 'side-panel'
  nav: 'tree' | 'breadcrumb'
  layout: 'verse-per-line' | 'continuous'
}

export type ReaderPosition = { book: number; chapter: number }

export type ReaderPaneDeps = {
  passages: PassageSource
  installedTranslations: () => Promise<ModuleManifest[]>
  intersecting: (reference: Reference) => OccurrenceGroup[]
}

export type ReaderPaneConfig = {
  toggles: ReaderToggles
  translationId: string | null
}

export type VerseRowView = {
  verseId: number
  label: string
  segments: VerseSegment[]
  highlighted: boolean
  expanded: boolean
  annotations: number
  mentions: number
}

export type TranslationRowView = {
  id: string
  label: string
  text: string | null
}

export type NoteCardView = {
  file: string
  annotation: boolean
}

export type VerseDetailsView = {
  verseId: number
  title: string
  translations: TranslationRowView[]
  notes: NoteCardView[]
}

const singleVerseReference = (book: number, verseId: number): Reference => ({
  book,
  ranges: [{ startId: verseId, endId: verseId }],
})

export type TranslationPill = {
  id: string
  label: string
  active: boolean
}

export type ReaderPaneView = {
  status: 'loading' | 'ok' | 'unavailable' | 'no-translation'
  title: string
  position: ReaderPosition
  rows: VerseRowView[]
  translations: TranslationPill[]
  toggles: ReaderToggles
  selectedVerseId: number | null
  details: Record<number, VerseDetailsView>
  banner: string | null
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

export class ReaderPaneModel {
  #position: ReaderPosition = { book: 1, chapter: 1 }
  #translationId: string | null
  #entry: Reference | null = null
  #rows: VerseRowView[] = []
  #status: ReaderPaneView['status'] = 'loading'
  #installed: ModuleManifest[] = []
  #toggles: ReaderToggles
  #selectedVerseId: number | null = null
  #expanded = new Set<number>()
  #details: Record<number, VerseDetailsView> = {}
  readonly #listeners = new Set<() => void>()

  constructor(
    private readonly deps: ReaderPaneDeps,
    config: ReaderPaneConfig,
  ) {
    this.#translationId = config.translationId
    this.#toggles = { ...config.toggles }
  }

  subscribe(listener: () => void): () => void {
    this.#listeners.add(listener)
    return () => this.#listeners.delete(listener)
  }

  #notify(): void {
    this.#listeners.forEach((listener) => listener())
  }

  setToggle<Key extends keyof ReaderToggles>(
    toggle: Key,
    value: ReaderToggles[Key],
  ): void {
    this.#toggles = { ...this.#toggles, [toggle]: value }
    this.#notify()
  }

  get view(): ReaderPaneView {
    return {
      status: this.#status,
      title: `${bookName(this.#position.book)} ${this.#position.chapter}`,
      position: this.#position,
      rows: this.#rows,
      translations: this.#installed.map((manifest) => ({
        id: manifest.id,
        label: manifest.id.toUpperCase(),
        active: manifest.id === this.#translationId,
      })),
      toggles: this.#toggles,
      selectedVerseId: this.#selectedVerseId,
      details: this.#details,
      banner:
        this.#entry === null
          ? null
          : `Opened at ${formatReference(this.#entry)}`,
    }
  }

  async openAt(
    reference: Reference,
    translationId: string | null,
  ): Promise<void> {
    const { book, chapter } = decodeVerseId(reference.ranges[0].startId)
    this.#position = { book, chapter }
    if (translationId !== null) this.#translationId = translationId
    this.#entry = reference
    this.#resetSelection()
    await this.#loadChapter()
  }

  async setTranslation(translationId: string): Promise<void> {
    this.#translationId = translationId
    this.#resetSelection()
    await this.#loadChapter()
  }

  async selectVerse(verseId: number): Promise<void> {
    this.#selectedVerseId = verseId
    if (this.#toggles.details === 'inline') {
      if (this.#expanded.has(verseId)) {
        this.#expanded.delete(verseId)
        this.#refreshRowExpansion()
        return
      }
      this.#expanded.add(verseId)
      this.#refreshRowExpansion()
    } else {
      this.#notify()
    }
    if (this.#details[verseId] === undefined) await this.#loadDetails(verseId)
  }

  #resetSelection(): void {
    this.#selectedVerseId = null
    this.#expanded.clear()
    this.#details = {}
  }

  #refreshRowExpansion(): void {
    this.#rows = this.#rows.map((row) => ({
      ...row,
      expanded: this.#expanded.has(row.verseId),
    }))
    this.#notify()
  }

  async #loadDetails(verseId: number): Promise<void> {
    const reference = singleVerseReference(this.#position.book, verseId)
    const translations = await Promise.all(
      this.#installed.map(async (installed): Promise<TranslationRowView> => {
        const passage = await this.deps.passages.passage(
          reference,
          installed.id,
        )
        return {
          id: installed.id,
          label: installed.id.toUpperCase(),
          text:
            passage.status === 'ok'
              ? passage.verses[0].segments
                  .map((segment) => segment.text)
                  .join('')
              : null,
        }
      }),
    )
    this.#details = {
      ...this.#details,
      [verseId]: {
        verseId,
        title: formatReference(reference),
        translations,
        notes: this.deps.intersecting(reference).map((occurrence) => ({
          file: occurrence.file,
          annotation: occurrence.annotation,
        })),
      },
    }
    this.#notify()
  }

  async #loadChapter(): Promise<void> {
    this.#status = 'loading'
    this.#rows = []
    this.#installed = await this.deps.installedTranslations()
    this.#translationId ??= this.#installed[0]?.id ?? null
    if (this.#translationId === null) {
      this.#status = 'no-translation'
      return
    }
    const passage = await this.deps.passages.passage(
      chapterReference(this.#position),
      this.#translationId,
    )
    if (passage.status !== 'ok') {
      this.#status = 'unavailable'
      return
    }
    this.#rows = passage.verses.map((verse) => {
      const groups = this.deps.intersecting(
        singleVerseReference(this.#position.book, verse.verseId),
      )
      return {
        verseId: verse.verseId,
        label: `${decodeVerseId(verse.verseId).verse}`,
        segments: verse.segments,
        highlighted:
          this.#entry !== null &&
          this.#entry.ranges.some((range) =>
            rangeContains(range, verse.verseId),
          ),
        expanded: this.#expanded.has(verse.verseId),
        annotations: groups.filter((occurrence) => occurrence.annotation)
          .length,
        mentions: groups.filter((occurrence) => !occurrence.annotation).length,
      }
    })
    this.#status = 'ok'
  }
}
