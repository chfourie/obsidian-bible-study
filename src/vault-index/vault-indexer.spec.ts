import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { makeVerseId, type Reference } from '../reference'
import type { NoteVault } from './note-vault'
import { VaultIndexer } from './vault-indexer'
import { VaultReferenceIndex } from './vault-reference-index'

const johnRef = (chapter: number, verse: number): Reference => ({
  book: 43,
  ranges: [
    {
      startId: makeVerseId(43, chapter, verse),
      endId: makeVerseId(43, chapter, verse),
    },
  ],
})

type FakeNote = { content: string; frontmatterRef: string | null }

class FakeNoteVault implements NoteVault {
  readonly #notes = new Map<string, FakeNote>()
  readonly #layoutReadyListeners: Array<() => void> = []
  readonly #changedListeners: Array<(path: string) => void> = []
  readonly #renamedListeners: Array<(path: string, oldPath: string) => void> = []
  readonly #deletedListeners: Array<(path: string) => void> = []

  setNote(path: string, content: string, frontmatterRef: string | null = null) {
    this.#notes.set(path, { content, frontmatterRef })
  }

  deleteNote(path: string) {
    this.#notes.delete(path)
  }

  markdownFilePaths(): string[] {
    return [...this.#notes.keys()]
  }

  async readNote(path: string): Promise<string> {
    const note = this.#notes.get(path)
    if (!note) throw new Error(`no note at ${path}`)
    return note.content
  }

  frontmatterRef(path: string): string | null {
    return this.#notes.get(path)?.frontmatterRef ?? null
  }

  onLayoutReady(listener: () => void): void {
    this.#layoutReadyListeners.push(listener)
  }

  onNoteChanged(listener: (path: string) => void): void {
    this.#changedListeners.push(listener)
  }

  onNoteRenamed(listener: (path: string, oldPath: string) => void): void {
    this.#renamedListeners.push(listener)
  }

  onNoteDeleted(listener: (path: string) => void): void {
    this.#deletedListeners.push(listener)
  }

  fireLayoutReady() {
    this.#layoutReadyListeners.forEach((listener) => listener())
  }

  fireChanged(path: string) {
    this.#changedListeners.forEach((listener) => listener(path))
  }

  fireRenamed(path: string, oldPath: string) {
    this.#renamedListeners.forEach((listener) => listener(path, oldPath))
  }

  fireDeleted(path: string) {
    this.#deletedListeners.forEach((listener) => listener(path))
  }
}

const setup = (options: { chunkSize?: number; debounceMs?: number } = {}) => {
  const vault = new FakeNoteVault()
  const index = new VaultReferenceIndex()
  const indexer = new VaultIndexer(vault, index, {
    yieldBetweenChunks: () => Promise.resolve(),
    ...options,
  })
  return { vault, index, indexer }
}

beforeEach(() => {
  vi.useFakeTimers()
})

afterEach(() => {
  vi.useRealTimers()
})

describe('VaultIndexer full scan', () => {
  it('indexes every markdown file, bodies and annotations alike', async () => {
    const { vault, index, indexer } = setup()
    vault.setNote('mention.md', 'see {John 15:4}')
    vault.setNote('Annotations/John 15.4.md', '---\nref: John 15:4\n---\n', 'John 15:4')
    vault.setNote('plain.md', 'no references here')

    await indexer.scanVault()

    expect(
      index.intersectingOccurrences(johnRef(15, 4)).map((group) => group.file),
    ).toEqual(['Annotations/John 15.4.md', 'mention.md'])
  })
})
