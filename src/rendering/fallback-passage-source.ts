import type { ScriptureStudySettings } from '../data-access'
import { isNonBiblicalBook, type Reference } from '../reference'
import type { Passage, PassageSource } from './module-passage-source'

export const resolveFallbackTranslationId = (
  settings: Pick<
    ScriptureStudySettings,
    'installedModuleIds' | 'fallbackTranslationId'
  >,
): string | null => {
  const { installedModuleIds, fallbackTranslationId } = settings
  if (
    fallbackTranslationId !== null &&
    installedModuleIds.includes(fallbackTranslationId)
  ) {
    return fallbackTranslationId
  }
  return installedModuleIds[0] ?? null
}

export class FallbackPassageSource implements PassageSource {
  constructor(
    private readonly source: PassageSource,
    private readonly fallbackTranslationId: () => string | null,
  ) {}

  async passage(reference: Reference, translationId: string): Promise<Passage> {
    const requested = await this.source.passage(reference, translationId)
    if (requested.status === 'ok') return requested
    // No translation can stand in for a book: an absent book module is a
    // content gap, not a missing translation (spec-books §6).
    if (isNonBiblicalBook(reference.book)) return requested
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
