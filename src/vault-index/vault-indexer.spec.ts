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

const flushMicrotasks = async (ticks = 20) => {
  for (let tick = 0; tick < ticks; tick++) await Promise.resolve()
}

describe('VaultIndexer full scan', () => {
  it('scans the vault when the layout becomes ready', async () => {
    const { vault, index, indexer } = setup()
    vault.setNote('mention.md', '{John 15:4}')
    indexer.start()

    expect(index.intersectingOccurrences(johnRef(15, 4))).toEqual([])
    vault.fireLayoutReady()
    await flushMicrotasks()

    expect(index.intersectingOccurrences(johnRef(15, 4))).toHaveLength(1)
  })

  it('yields between chunks so the UI stays responsive', async () => {
    const vault = new FakeNoteVault()
    const index = new VaultReferenceIndex()
    let yields = 0
    const indexer = new VaultIndexer(vault, index, {
      chunkSize: 2,
      yieldBetweenChunks: () => {
        yields++
        return Promise.resolve()
      },
    })
    for (let i = 0; i < 5; i++) vault.setNote(`note-${i}.md`, '{John 15:4}')

    await indexer.scanVault()

    expect(yields).toBe(2)
    expect(index.intersectingOccurrences(johnRef(15, 4))).toHaveLength(5)
  })

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

describe('VaultIndexer incremental updates', () => {
  it('re-indexes a changed note only after the debounce window', async () => {
    const { vault, index, indexer } = setup({ debounceMs: 300 })
    vault.setNote('note.md', '{John 15:4}')
    await indexer.scanVault()
    indexer.start()

    vault.setNote('note.md', '{John 3:16}')
    vault.fireChanged('note.md')
    await vi.advanceTimersByTimeAsync(299)

    expect(index.intersectingOccurrences(johnRef(15, 4))).toHaveLength(1)
    expect(index.intersectingOccurrences(johnRef(3, 16))).toEqual([])

    await vi.advanceTimersByTimeAsync(1)

    expect(index.intersectingOccurrences(johnRef(15, 4))).toEqual([])
    expect(index.intersectingOccurrences(johnRef(3, 16))).toHaveLength(1)
  })

  it('collapses rapid changes into one re-index at the end of the window', async () => {
    const { vault, index, indexer } = setup({ debounceMs: 300 })
    indexer.start()

    vault.setNote('note.md', '{John 15:4}')
    vault.fireChanged('note.md')
    await vi.advanceTimersByTimeAsync(200)
    vault.setNote('note.md', '{John 3:16}')
    vault.fireChanged('note.md')
    await vi.advanceTimersByTimeAsync(200)

    expect(index.intersectingOccurrences(johnRef(3, 16))).toEqual([])

    await vi.advanceTimersByTimeAsync(100)

    expect(index.intersectingOccurrences(johnRef(15, 4))).toEqual([])
    expect(index.intersectingOccurrences(johnRef(3, 16))).toHaveLength(1)
  })

  it('indexes a newly created note through the change event', async () => {
    const { vault, index, indexer } = setup({ debounceMs: 300 })
    indexer.start()

    vault.setNote('fresh.md', '{John 15:4}')
    vault.fireChanged('fresh.md')
    await vi.advanceTimersByTimeAsync(300)

    expect(
      index.intersectingOccurrences(johnRef(15, 4)).map((group) => group.file),
    ).toEqual(['fresh.md'])
  })
})
