import type { ModuleManifest } from '../modules'
import {
  BOOK_COUNT,
  bookName,
  chapterCount,
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
  attribution: string | null
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
  #attribution: string | null = null
  #bannerDismissed = false
  #loadToken = 0
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
      attribution: this.#attribution,
      banner:
        this.#entry === null || this.#bannerDismissed
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
    this.#bannerDismissed = false
    this.#resetSelection()
    await this.#loadChapter()
  }

  async openPosition(position: ReaderPosition): Promise<void> {
    this.#position = { ...position }
    this.#entry = null
    this.#resetSelection()
    await this.#loadChapter()
  }

  dismissBanner(): void {
    this.#bannerDismissed = true
    this.#notify()
  }

  async goTo(book: number, chapter: number): Promise<void> {
    this.#position = { book, chapter }
    this.#entry = null
    this.#resetSelection()
    await this.#loadChapter()
  }

  async nextChapter(): Promise<void> {
    const { book, chapter } = this.#position
    if (chapter < chapterCount(book)) await this.goTo(book, chapter + 1)
    else if (book < BOOK_COUNT) await this.goTo(book + 1, 1)
  }

  async previousChapter(): Promise<void> {
    const { book, chapter } = this.#position
    if (chapter > 1) await this.goTo(book, chapter - 1)
    else if (book > 1) await this.goTo(book - 1, chapterCount(book - 1))
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
    const token = ++this.#loadToken
    this.#status = 'loading'
    this.#rows = []
    this.#notify()
    const installed = await this.deps.installedTranslations()
    if (token !== this.#loadToken) return
    this.#installed = installed
    this.#translationId ??= this.#installed[0]?.id ?? null
    if (this.#translationId === null) {
      this.#status = 'no-translation'
      this.#notify()
      return
    }
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
    this.#notify()
  }
}
