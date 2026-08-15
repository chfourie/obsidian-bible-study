import type { BookContent, ModuleManifest } from '../modules'
import { enumerateVerseIds, type Reference } from '../reference'

export type VerseSegment = {
  text: string
  redLetter: boolean
}

export type PassageVerse = {
  verseId: number
  segments: VerseSegment[]
}

export type Passage =
  | { status: 'ok'; verses: PassageVerse[]; attribution: string | null }
  | { status: 'unavailable' }

export interface PassageSource {
  passage(reference: Reference, translationId: string): Promise<Passage>
}

export type PassageStore = {
  manifest(moduleId: string): Promise<ModuleManifest | null>
  bookContent(moduleId: string, book: number): Promise<BookContent | null>
}

const attributionFor = (manifest: ModuleManifest): string | null => {
  const license = manifest.license.trim()
  if (license === '' || /^public domain$/i.test(license)) return null
  return license
}

export class ModulePassageSource implements PassageSource {
  constructor(private readonly store: PassageStore) {}

  async passage(
    reference: Reference,
    translationId: string,
  ): Promise<Passage> {
    const manifest = await this.store.manifest(translationId)
    if (manifest === null) return { status: 'unavailable' }
    const content =
      (await this.store.bookContent(translationId, reference.book)) ?? {}
    const verses: PassageVerse[] = []
    for (const range of reference.ranges) {
      for (const verseId of enumerateVerseIds(range)) {
        const text = content[verseId]
        if (text === undefined) continue
        verses.push({ verseId, segments: [{ text, redLetter: false }] })
      }
    }
    if (verses.length === 0) return { status: 'unavailable' }
    return { status: 'ok', verses, attribution: attributionFor(manifest) }
  }
}
