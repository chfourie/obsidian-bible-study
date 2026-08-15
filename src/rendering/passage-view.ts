import { decodeVerseId } from '../reference'
import type { Passage, PassageVerse, VerseSegment } from './module-passage-source'
import type { ReferenceRenderModel } from './reference-render-model'

export type VerseBlock = {
  label: string | null
  segments: VerseSegment[]
}

export type PassageView = {
  verses: VerseBlock[]
  attribution: string | null
}

const spansMultipleChapters = (verses: PassageVerse[]): boolean => {
  const chapters = verses.map((verse) => decodeVerseId(verse.verseId).chapter)
  return chapters.some((chapter) => chapter !== chapters[0])
}

const verseLabels = (verses: PassageVerse[]): string[] => {
  const multiChapter = spansMultipleChapters(verses)
  let previousChapter: number | null = null
  return verses.map((passageVerse) => {
    const { chapter, verse } = decodeVerseId(passageVerse.verseId)
    const label =
      multiChapter && chapter !== previousChapter
        ? `${chapter}:${verse}`
        : `${verse}`
    previousChapter = chapter
    return label
  })
}

export const buildPassageView = (
  model: ReferenceRenderModel,
  passage: Extract<Passage, { status: 'ok' }>,
): PassageView => {
  const numbered =
    model.display === 'callout' || passage.verses.length > 1
  const labels = verseLabels(passage.verses)
  return {
    verses: passage.verses.map((verse, index) => ({
      label: numbered ? labels[index] : null,
      segments: verse.segments,
    })),
    attribution: model.display === 'callout' ? passage.attribution : null,
  }
}

export const loadingText = (model: ReferenceRenderModel): string =>
  `Loading ${model.referenceText}…`

export const unavailableText = (model: ReferenceRenderModel): string =>
  model.translationId === null
    ? `${model.referenceText} unavailable — no translation installed`
    : `${model.referenceText} (${model.translationId.toUpperCase()}) unavailable offline`
