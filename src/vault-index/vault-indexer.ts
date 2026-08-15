import type { NoteVault } from './note-vault'
import type { VaultReferenceIndex } from './vault-reference-index'

export type VaultIndexerOptions = {
  chunkSize?: number
  debounceMs?: number
  yieldBetweenChunks?: () => Promise<void>
}

const DEFAULT_CHUNK_SIZE = 50
const DEFAULT_DEBOUNCE_MS = 500

const yieldToEventLoop = (): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, 0))

export class VaultIndexer {
  readonly #chunkSize: number
  readonly #debounceMs: number
  readonly #yieldBetweenChunks: () => Promise<void>
  readonly #pendingReindexes = new Map<string, ReturnType<typeof setTimeout>>()

  constructor(
    private readonly vault: NoteVault,
    private readonly index: VaultReferenceIndex,
    options: VaultIndexerOptions = {},
  ) {
    this.#chunkSize = options.chunkSize ?? DEFAULT_CHUNK_SIZE
    this.#debounceMs = options.debounceMs ?? DEFAULT_DEBOUNCE_MS
    this.#yieldBetweenChunks = options.yieldBetweenChunks ?? yieldToEventLoop
  }

  start(): void {
    this.vault.onLayoutReady(() => void this.scanVault())
    this.vault.onNoteChanged((path) => this.#scheduleReindex(path))
    this.vault.onNoteRenamed((path, oldPath) => {
      const changePending = this.#pendingReindexes.has(oldPath)
      this.#cancelPendingReindex(oldPath)
      this.index.renameNote(oldPath, path)
      if (changePending) this.#scheduleReindex(path)
    })
    this.vault.onNoteDeleted((path) => {
      this.#cancelPendingReindex(path)
      this.index.removeNote(path)
    })
  }

  stop(): void {
    for (const pending of this.#pendingReindexes.values()) clearTimeout(pending)
    this.#pendingReindexes.clear()
  }

  #scheduleReindex(path: string): void {
    this.#cancelPendingReindex(path)
    this.#pendingReindexes.set(
      path,
      setTimeout(() => {
        this.#pendingReindexes.delete(path)
        void this.#indexNote(path)
      }, this.#debounceMs),
    )
  }

  #cancelPendingReindex(path: string): void {
    const pending = this.#pendingReindexes.get(path)
    if (pending === undefined) return
    clearTimeout(pending)
    this.#pendingReindexes.delete(path)
  }

  async scanVault(): Promise<void> {
    const paths = this.vault.markdownFilePaths()
    for (let start = 0; start < paths.length; start += this.#chunkSize) {
      if (start > 0) await this.#yieldBetweenChunks()
      for (const path of paths.slice(start, start + this.#chunkSize)) {
        await this.#indexNote(path)
      }
    }
  }

  async #indexNote(path: string): Promise<void> {
    this.index.indexNote(
      path,
      await this.vault.readNote(path),
      this.vault.frontmatterRef(path),
    )
  }
}
