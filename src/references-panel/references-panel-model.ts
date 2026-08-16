import {
  decodeVerseId,
  formatReference,
  type Reference,
} from '../reference'
import type { PassageSource, PassageVerse } from '../rendering'
import { extractOccurrences } from '../vault-index'

export type ReferenceEntryVerse = { label: string | null; text: string }

export type ReferenceEntryStatus = 'loading' | 'ok' | 'unavailable'

export type ReferenceEntryView = {
  key: string
  label: string
  reference: Reference
  status: ReferenceEntryStatus
  verses: ReferenceEntryVerse[]
  attribution: string | null
}

export type ReferencesPanelStatus =
  | 'no-note'
  | 'no-references'
  | 'no-translation'
  | 'ok'

export type ReferencesPanelView = {
  file: string | null
  status: ReferencesPanelStatus
  entries: ReferenceEntryView[]
}

export type ReferencesPanelDeps = { passages: PassageSource }

export type ReferencesPanelConfig = { translationId: string | null }

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

export class ReferencesPanelModel {
  #file: string | null = null
  #entries: ReferenceEntryView[] = []
  #translationId: string | null
  #loadToken = 0
  readonly #listeners = new Set<() => void>()

  constructor(
    private readonly deps: ReferencesPanelDeps,
    config: ReferencesPanelConfig,
  ) {
    this.#translationId = config.translationId
  }

  subscribe(listener: () => void): () => void {
    this.#listeners.add(listener)
    return () => this.#listeners.delete(listener)
  }

  get view(): ReferencesPanelView {
    return {
      file: this.#file,
      status: this.#status(),
      entries: this.#entries,
    }
  }

  #status(): ReferencesPanelStatus {
    if (this.#file === null) return 'no-note'
    if (this.#entries.length === 0) return 'no-references'
    if (this.#translationId === null) return 'no-translation'
    return 'ok'
  }

  async setActiveNote(note: ActiveNote | null): Promise<void> {
    const token = ++this.#loadToken
    if (note === null) {
      this.#file = null
      this.#entries = []
      this.#notify()
      return
    }
    this.#file = note.file
    this.#entries = this.#pendingEntries(note.content)
    this.#notify()
    await this.#loadEntries(token)
  }

  async setTranslation(translationId: string | null): Promise<void> {
    if (translationId === this.#translationId) return
    this.#translationId = translationId
    const token = ++this.#loadToken
    this.#entries = this.#entries.map((entry) => ({
      ...entry,
      status: 'loading',
      verses: [],
      attribution: null,
    }))
    this.#notify()
    await this.#loadEntries(token)
  }

  #pendingEntries(content: string): ReferenceEntryView[] {
    const entries = new Map<string, ReferenceEntryView>()
    for (const occurrence of extractOccurrences(content)) {
      const key = formatReference(occurrence.reference)
      if (entries.has(key)) continue
      entries.set(key, {
        key,
        label: key,
        reference: occurrence.reference,
        status: 'loading',
        verses: [],
        attribution: null,
      })
    }
    return [...entries.values()]
  }

  async #loadEntries(token: number): Promise<void> {
    const translationId = this.#translationId
    if (translationId === null) {
      this.#entries = this.#entries.map((entry) => ({
        ...entry,
        status: 'unavailable',
      }))
      this.#notify()
      return
    }
    await Promise.all(
      this.#entries.map(async (entry) => {
        const passage = await this.deps.passages.passage(
          entry.reference,
          translationId,
        )
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
