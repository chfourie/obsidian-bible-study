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
}

export type ReaderPaneView = {
  status: 'loading' | 'ok'
  title: string
  position: ReaderPosition
  rows: VerseRowView[]
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

  constructor(
    private readonly deps: ReaderPaneDeps,
    config: ReaderPaneConfig,
  ) {
    this.#translationId = config.translationId
  }

  get view(): ReaderPaneView {
    return {
      status: this.#status,
      title: `${bookName(this.#position.book)} ${this.#position.chapter}`,
      position: this.#position,
      rows: this.#rows,
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
    await this.#loadChapter()
  }

  async #loadChapter(): Promise<void> {
    this.#status = 'loading'
    const passage = await this.deps.passages.passage(
      chapterReference(this.#position),
      this.#translationId ?? '',
    )
    if (passage.status !== 'ok') return
    this.#rows = passage.verses.map((verse) => ({
      verseId: verse.verseId,
      label: `${decodeVerseId(verse.verseId).verse}`,
      segments: verse.segments,
      highlighted:
        this.#entry !== null &&
        this.#entry.ranges.some((range) => rangeContains(range, verse.verseId)),
    }))
    this.#status = 'ok'
  }
}
