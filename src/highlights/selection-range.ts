import type { PassageVerse } from './apply-stroke'
import type { HighlightRange } from './highlight-spans'

const WORD_CHARACTER = /[\p{L}\p{N}\p{M}]/u

// Scripts written without spaces between words give a drag no boundary to
// snap to, so those selections are stored exactly as made.
const UNSPACED_SCRIPT =
  /[\p{sc=Han}\p{sc=Hiragana}\p{sc=Katakana}\p{sc=Thai}\p{sc=Lao}\p{sc=Khmer}\p{sc=Myanmar}]/u

const splitsAWord = (text: string, index: number): boolean => {
  const before = text[index - 1]
  const after = text[index]
  if (before === undefined || after === undefined) return false
  if (UNSPACED_SCRIPT.test(before) || UNSPACED_SCRIPT.test(after)) return false
  return WORD_CHARACTER.test(before) && WORD_CHARACTER.test(after)
}

const snapBackward = (text: string, index: number): number => {
  let snapped = index
  while (splitsAWord(text, snapped)) snapped--
  return snapped
}

const snapForward = (text: string, index: number): number => {
  let snapped = index
  while (splitsAWord(text, snapped)) snapped++
  return snapped
}

const clamp = (value: number, limit: number): number =>
  Math.min(Math.max(value, 0), limit)

export const highlightSelectionRange = (
  selection: HighlightRange,
  verses: readonly PassageVerse[],
): HighlightRange | null => {
  const startIndex = verses.findIndex(
    (verse) => verse.verseId >= selection.startVerseId,
  )
  const lastAtOrBefore = [...verses]
    .reverse()
    .findIndex((verse) => verse.verseId <= selection.endVerseId)
  const endIndex =
    lastAtOrBefore === -1 ? -1 : verses.length - 1 - lastAtOrBefore
  if (startIndex === -1 || endIndex === -1 || startIndex > endIndex) return null

  const startVerse = verses[startIndex]
  const endVerse = verses[endIndex]
  const startChar =
    startVerse.verseId === selection.startVerseId
      ? clamp(selection.startChar, startVerse.text.length)
      : 0
  const endChar =
    endVerse.verseId === selection.endVerseId
      ? clamp(selection.endChar, endVerse.text.length)
      : endVerse.text.length
  if (startVerse.verseId === endVerse.verseId && endChar <= startChar)
    return null

  return {
    startVerseId: startVerse.verseId,
    startChar: snapBackward(startVerse.text, startChar),
    endVerseId: endVerse.verseId,
    endChar: snapForward(endVerse.text, endChar),
  }
}
