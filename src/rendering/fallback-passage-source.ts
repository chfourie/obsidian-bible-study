import type { Reference } from '../reference'
import type { Passage, PassageSource } from './module-passage-source'

export class FallbackPassageSource implements PassageSource {
  constructor(
    private readonly source: PassageSource,
    private readonly fallbackTranslationId: () => string | null,
  ) {}

  async passage(reference: Reference, translationId: string): Promise<Passage> {
    const requested = await this.source.passage(reference, translationId)
    if (requested.status === 'ok') return requested
    const fallbackId = this.fallbackTranslationId()
    if (fallbackId === null || fallbackId === translationId) return requested
    const fallback = await this.source.passage(reference, fallbackId)
    if (fallback.status !== 'ok') return requested
    return {
      ...fallback,
      fallback: { requested: translationId, served: fallbackId },
    }
  }
}
