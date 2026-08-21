// The hand-kept corrections every book pipeline needs for the citations its
// scanner cannot carry on its own (spec-books §8). Both override kinds are
// checked against the text they were written for: one that no longer matches
// fails the build rather than quietly doing nothing, so a re-cut source
// cannot rot the annotations.

import type { RefSpan } from '../../src/modules/verse-content'
import { parseReference } from '../../src/reference/parse-reference'

// Supplies the ranges for a citation the scanner missed or could not resolve.
export type RefFix = {
  at: string
  text: string
  reference: string
}

// Silences a false positive the scanner produced.
export type RefSuppression = {
  at: string
  text: string
}

export type RefOverrides = {
  fix?: readonly RefFix[]
  suppress?: readonly RefSuppression[]
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const asList = (value: unknown, kind: string): unknown[] => {
  if (value === undefined) return []
  if (!Array.isArray(value)) throw new Error(`The ${kind} overrides are not a list`)
  return value
}

export const parseRefOverrides = (json: string): Required<RefOverrides> => {
  const parsed: unknown = JSON.parse(json)
  if (!isRecord(parsed)) throw new Error('The ref overrides file is not an object')
  const fix = asList(parsed.fix, 'fix').map((entry) => {
    if (
      !isRecord(entry) ||
      typeof entry.at !== 'string' ||
      typeof entry.text !== 'string' ||
      typeof entry.reference !== 'string'
    )
      throw new Error(
        `A fix override needs "at", "text" and "reference": ${JSON.stringify(entry)}`,
      )
    return { at: entry.at, text: entry.text, reference: entry.reference }
  })
  const suppress = asList(parsed.suppress, 'suppress').map((entry) => {
    if (
      !isRecord(entry) ||
      typeof entry.at !== 'string' ||
      typeof entry.text !== 'string'
    )
      throw new Error(
        `A suppress override needs "at" and "text": ${JSON.stringify(entry)}`,
      )
    return { at: entry.at, text: entry.text }
  })
  return { fix, suppress }
}

// Where an override's text sits in the atom, insisting on exactly one place
// for it: none means the override has gone stale, several mean it no longer
// says which citation it meant.
const soleOffset = (atom: string, text: string, at: string): number => {
  const first = atom.indexOf(text)
  if (first === -1)
    throw new Error(`Ref override at ${at} no longer matches: "${text}"`)
  if (atom.indexOf(text, first + 1) !== -1)
    throw new Error(`Ref override at ${at} matches more than once: "${text}"`)
  return first
}

export type AppliedRefs = { refs: RefSpan[]; accounted: RefSpan[] }

const scriptureRanges = (reference: string): RefSpan['ranges'] => {
  const parsed = parseReference(reference)
  if (parsed === null)
    throw new Error(`Fix override cites an unreadable reference: ${reference}`)
  return parsed.reference.ranges
}

export class OverrideLedger {
  readonly #unused: Set<RefFix | RefSuppression>

  constructor(private readonly overrides: Required<RefOverrides>) {
    this.#unused = new Set([...overrides.fix, ...overrides.suppress])
  }

  // The refs the atom keeps, plus everything the build has accounted for
  // there — a suppressed citation is deliberately not a link, so it must not
  // read as one the scanner failed on.
  apply(at: string, atom: string, parsed: RefSpan[]): AppliedRefs {
    let spans = parsed
    const suppressed: RefSpan[] = []
    for (const entry of this.overrides.suppress) {
      if (entry.at !== at) continue
      this.#unused.delete(entry)
      const start = soleOffset(atom, entry.text, at)
      const end = start + entry.text.length
      const dropped = spans.filter(
        (span) => span.start === start && span.end === end,
      )
      if (dropped.length === 0)
        throw new Error(
          `Suppress override at ${at} covers no parsed ref span: "${entry.text}"`,
        )
      suppressed.push(...dropped)
      spans = spans.filter((span) => !dropped.includes(span))
    }
    for (const entry of this.overrides.fix) {
      if (entry.at !== at) continue
      this.#unused.delete(entry)
      const start = soleOffset(atom, entry.text, at)
      const span = {
        start,
        end: start + entry.text.length,
        ranges: scriptureRanges(entry.reference),
      }
      // A fix is the last word on the citation it names, so it displaces
      // whatever the scanner made of the same stretch of text.
      spans = [
        ...spans.filter(
          (parsedSpan) =>
            parsedSpan.end <= span.start || parsedSpan.start >= span.end,
        ),
        span,
      ].sort((a, b) => a.start - b.start)
    }
    return { refs: spans, accounted: [...spans, ...suppressed] }
  }

  assertAllUsed(): void {
    const stale = [...this.#unused]
    if (stale.length === 0) return
    throw new Error(
      `Ref overrides match no atom: ${stale
        .map((entry) => `${entry.at} "${entry.text}"`)
        .join(', ')}`,
    )
  }
}
