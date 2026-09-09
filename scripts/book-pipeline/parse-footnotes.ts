// The `[Footnote…]` markers a curator writes beside the reading they explain
// (spec-books §2, §6, ADR 0012). The marker is the syntax
// `scripts/humility-pipeline` already reads, generalized to both atom kinds:
// the note is lifted out of the stored string and rides beside it as an
// anchor offset plus its body, so the reading a reader highlights, searches
// and cites is the reading the edition prints.

import type { Footnote } from '../../src/modules/verse-content'
import { type StrippedText, stripAtomMarks } from './parse-editorial-marks'

export type NotedText = StrippedText & { footnotes?: Footnote[] }

const FOOTNOTE = /\s*\[Footnote\d*:\s*([\s\S]*?)\]/g
const LEFTOVER = /\[Footnote[^\]]*\]?/

type LiftedText = {
  text: string
  footnotes?: Footnote[]
  offsetOf: (at: number) => number
}

export const liftFootnotes = (source: string): LiftedText => {
  const footnotes: Footnote[] = []
  const removals: { at: number; length: number }[] = []
  let text = ''
  let consumed = 0
  for (const match of source.matchAll(FOOTNOTE)) {
    const body = match[1].trim()
    if (body.includes('<'))
      throw new Error(`a Footnote carries no Editorial mark: "${body}"`)
    text += source.slice(consumed, match.index)
    footnotes.push({ start: text.length, text: body })
    removals.push({ at: match.index, length: match[0].length })
    consumed = match.index + match[0].length
  }
  text += source.slice(consumed)
  const leftover = LEFTOVER.exec(text)
  if (leftover !== null)
    throw new Error(
      'a `[Footnote` marker the build cannot read — a note reads ' +
        `\`[Footnote: text]\`, not "${leftover[0]}"`,
    )
  const offsetOf = (at: number): number =>
    at -
    removals
      .filter((removal) => removal.at < at)
      .reduce((removed, removal) => removed + removal.length, 0)
  return {
    text,
    ...(footnotes.length === 0 ? {} : { footnotes }),
    offsetOf,
  }
}

// An atom as the build stores it: the notes lifted, then the Editorial-mark
// wrappers stripped, so every offset either lift writes — a footnote anchor,
// a mark span, and a line start the caller carries through `offsetOf` —
// indexes the final stored string (spec-books §6).
export const liftAtomNotes = (locator: string, source: string): NotedText => {
  const lifted = ((): LiftedText => {
    try {
      return liftFootnotes(source)
    } catch (error) {
      throw new Error(`atom ${locator}: ${(error as Error).message}`)
    }
  })()
  const stripped = stripAtomMarks(locator, lifted.text)
  return {
    ...stripped,
    ...(lifted.footnotes === undefined
      ? {}
      : {
          footnotes: lifted.footnotes.map((footnote) => ({
            ...footnote,
            start: stripped.offsetOf(footnote.start),
          })),
        }),
    offsetOf: (at: number): number => stripped.offsetOf(lifted.offsetOf(at)),
  }
}

// Furniture and an epigraph carry no note (spec-books §6): a Footnote is a
// channel on an atom, so a marker written anywhere else is a curator's slip.
export const assertNoFootnoteMarker = (kind: string, text: string): void => {
  if (text.includes('[Footnote'))
    throw new Error(`${kind} "${text}": only an atom carries a Footnote`)
}
