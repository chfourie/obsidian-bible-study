import { RED_LETTER_CUES } from './red-letter-cues-data'

// Translation-independent words-of-Christ cue per verse id, derived from the
// BSB red-letter spans at build time (scripts/build-bsb-module.mjs). Partial
// cues record whether the red portion touches the verse start and/or end.
export type RedLetterCue =
  | { kind: 'none' }
  | { kind: 'full' }
  | { kind: 'partial'; redAtStart: boolean; redAtEnd: boolean }

// F = full; partials by edge coverage: B = both, S = start only, E = end
// only, M = mid-verse (neither edge).
export type RedLetterCueCode = 'F' | 'B' | 'S' | 'E' | 'M'

const CUE_BY_CODE: Record<RedLetterCueCode, RedLetterCue> = {
  F: { kind: 'full' },
  B: { kind: 'partial', redAtStart: true, redAtEnd: true },
  S: { kind: 'partial', redAtStart: true, redAtEnd: false },
  E: { kind: 'partial', redAtStart: false, redAtEnd: true },
  M: { kind: 'partial', redAtStart: false, redAtEnd: false },
}

const NONE: RedLetterCue = { kind: 'none' }

// Encoding: entries sorted by verse id, each written as the base36 delta from
// the previous verse id followed by an uppercase cue code.
export const encodeRedLetterCues = (
  entries: readonly { verseId: number; code: RedLetterCueCode }[],
): string => {
  const sorted = [...entries].sort((a, b) => a.verseId - b.verseId)
  let previous = 0
  return sorted
    .map(({ verseId, code }) => {
      const delta = (verseId - previous).toString(36)
      previous = verseId
      return delta + code
    })
    .join('')
}

export const decodeRedLetterCues = (
  encoded: string,
): Map<number, RedLetterCue> => {
  const table = new Map<number, RedLetterCue>()
  let verseId = 0
  for (const [, delta, code] of encoded.matchAll(/([0-9a-z]+)([FBSEM])/g)) {
    verseId += parseInt(delta, 36)
    table.set(verseId, CUE_BY_CODE[code as RedLetterCueCode])
  }
  return table
}

let table: Map<number, RedLetterCue> | undefined

export const redLetterCueOf = (verseId: number): RedLetterCue => {
  table ??= decodeRedLetterCues(RED_LETTER_CUES)
  return table.get(verseId) ?? NONE
}
