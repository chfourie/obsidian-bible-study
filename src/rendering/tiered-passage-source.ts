import type { Reference } from '../reference'
import type { Passage, PassageSource } from './module-passage-source'

export class TieredPassageSource implements PassageSource {
  constructor(
    private readonly offline: PassageSource,
    private readonly online: PassageSource,
  ) {}

  async passage(reference: Reference, translationId: string): Promise<Passage> {
    const offline = await this.offline.passage(reference, translationId)
    if (offline.status === 'ok') return offline
    return this.online.passage(reference, translationId)
  }
}
