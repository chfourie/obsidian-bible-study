import type { BookContent, ModuleManifest, VerseContent } from '../modules'
import { isTaggedVerse } from '../modules'
import { enumerateVerseIds, type Reference } from '../reference'

export type VerseSegment = {
  text: string
  redLetter: boolean
  strongs?: string[]
}

export type PassageVerse = {
  verseId: number
  segments: VerseSegment[]
}

export type FallbackSubstitution = {
  requested: string
  served: string
}

export type Passage =
  | {
      status: 'ok'
      verses: PassageVerse[]
      attribution: string | null
      fallback?: FallbackSubstitution
    }
  | { status: 'unavailable' }

export interface PassageSource {
  passage(reference: Reference, translationId: string): Promise<Passage>
}

export type PassageStore = {
  manifest(moduleId: string): Promise<ModuleManifest | null>
  bookContent(moduleId: string, book: number): Promise<BookContent | null>
}

const verseSegments = (verse: VerseContent): VerseSegment[] => {
  if (!isTaggedVerse(verse)) return [{ text: verse, redLetter: false }]
  const segments: VerseSegment[] = []
  let cursor = 0
  const orderedTags = [...verse.tags].sort((a, b) => a.start - b.start)
  for (const tag of orderedTags) {
    if (tag.start > cursor)
      segments.push({ text: verse.text.slice(cursor, tag.start), redLetter: false })
    segments.push({
      text: verse.text.slice(tag.start, tag.end),
      redLetter: false,
      strongs: tag.strongs,
    })
    cursor = tag.end
  }
  if (cursor < verse.text.length)
    segments.push({ text: verse.text.slice(cursor), redLetter: false })
  return segments
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
        const verse = content[verseId]
        if (verse === undefined) continue
        verses.push({ verseId, segments: verseSegments(verse) })
      }
    }
    if (verses.length === 0) return { status: 'unavailable' }
    return { status: 'ok', verses, attribution: attributionFor(manifest) }
  }
}
