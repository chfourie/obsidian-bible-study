import { formatReference, type Reference } from '../reference'
import type { Passage, PassageSource } from './module-passage-source'

export class PassageRepository implements PassageSource {
  readonly #cache = new Map<string, Promise<Passage>>()

  constructor(private readonly source: PassageSource) {}

  passage(reference: Reference, translationId: string): Promise<Passage> {
    const key = `${translationId}|${formatReference(reference)}`
    const cached = this.#cache.get(key)
    if (cached) return cached
    const pending = this.#fetch(reference, translationId).then((passage) => {
      if (passage.status !== 'ok') this.#cache.delete(key)
      return passage
    })
    this.#cache.set(key, pending)
    return pending
  }

  clear(): void {
    this.#cache.clear()
  }

  async #fetch(reference: Reference, translationId: string): Promise<Passage> {
    try {
      return await this.source.passage(reference, translationId)
    } catch {
      return { status: 'unavailable' }
    }
  }
}
