import type { NoteVault } from './note-vault'
import type { VaultReferenceIndex } from './vault-reference-index'

export type VaultIndexerOptions = {
  chunkSize?: number
  debounceMs?: number
  yieldBetweenChunks?: () => Promise<void>
}

const DEFAULT_CHUNK_SIZE = 50

const yieldToEventLoop = (): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, 0))

export class VaultIndexer {
  readonly #chunkSize: number
  readonly #yieldBetweenChunks: () => Promise<void>

  constructor(
    private readonly vault: NoteVault,
    private readonly index: VaultReferenceIndex,
    options: VaultIndexerOptions = {},
  ) {
    this.#chunkSize = options.chunkSize ?? DEFAULT_CHUNK_SIZE
    this.#yieldBetweenChunks = options.yieldBetweenChunks ?? yieldToEventLoop
  }

  start(): void {
    this.vault.onLayoutReady(() => void this.scanVault())
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
