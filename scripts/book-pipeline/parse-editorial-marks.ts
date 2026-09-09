// The Editorial-mark wrappers a curator writes in atom text and epigraphs
// (spec-books §10, ADR 0008): `<supplied>`, `<marks>`, `<emended>`. Marks are
// never inferred from the printed glyphs — the wrapper says which channel a
// stretch belongs to, and the wrapper itself is never stored: the stored
// string is the reading, and every span indexes that string.

import type { FormatSpan, VerseLine } from '../../src/modules/verse-content'

const WRAPPER_ELEMENTS = ['supplied', 'marks', 'emended'] as const
type WrapperElement = (typeof WRAPPER_ELEMENTS)[number]

export type EditorialMarkChannels = {
  [Element in WrapperElement]?: FormatSpan[]
}

export type StrippedText = EditorialMarkChannels & {
  text: string
  // Where an offset into the wrapped text lands in the stored string, so a
  // channel computed before the strip — line starts, table cells — follows
  // the text it addresses.
  offsetOf: (wrapped: number) => number
}

const WRAPPER_TAG = /^<(\/?)(supplied|marks|emended)>/
const ANY_TAG = /^<\/?[A-Za-z][^>]*>/

const elementList = WRAPPER_ELEMENTS.map((element) => `<${element}>`).join(', ')

type Open = { element: WrapperElement; start: number }

export const stripEditorialMarks = (wrapped: string): StrippedText => {
  let text = ''
  const open: Open[] = []
  const channels: Record<WrapperElement, FormatSpan[]> = {
    supplied: [],
    marks: [],
    emended: [],
  }
  const removals: { at: number; length: number }[] = []
  let index = 0
  while (index < wrapped.length) {
    const character = wrapped[index]
    if (character !== '<') {
      text += character
      index += 1
      continue
    }
    const rest = wrapped.slice(index)
    const tag = WRAPPER_TAG.exec(rest)
    if (tag === null) {
      const unknown = ANY_TAG.exec(rest)
      if (unknown !== null)
        throw new Error(`${unknown[0]} is not one of ${elementList}`)
      throw new Error('a raw `<` stands in the text — wrap it or write it out')
    }
    const [markup, closing, name] = tag
    const element = name as WrapperElement
    if (closing === '') {
      open.push({ element, start: text.length })
    } else {
      const innermost = open.pop()
      if (innermost === undefined)
        throw new Error(`</${element}> closes nothing`)
      if (innermost.element !== element)
        throw new Error(
          `</${element}> closes <${innermost.element}> — wrappers nest, never overlap`,
        )
      const span = { start: innermost.start, end: text.length }
      if (text.slice(span.start, span.end).trim() === '')
        throw new Error(`empty <${element}></${element}>`)
      channels[element].push(span)
    }
    removals.push({ at: index, length: markup.length })
    index += markup.length
  }
  const unclosed = open[0]
  if (unclosed !== undefined)
    throw new Error(`<${unclosed.element}> is never closed`)
  const offsetOf = (at: number): number =>
    at -
    removals
      .filter((removal) => removal.at < at)
      .reduce((removed, removal) => removed + removal.length, 0)
  return {
    text,
    ...Object.fromEntries(
      WRAPPER_ELEMENTS.filter((element) => channels[element].length > 0).map(
        (element) => [
          element,
          [...channels[element]].sort((a, b) => a.start - b.start),
        ],
      ),
    ),
    offsetOf,
  }
}

// The strip as an atom goes through it: the build fails citing the atom —
// `1:4` for a verse, `1.3` or `1.e1` for a paragraph Book's atom or epigraph.
export const stripAtomMarks = (
  locator: string,
  wrapped: string,
): StrippedText => {
  try {
    return stripEditorialMarks(wrapped)
  } catch (error) {
    throw new Error(`atom ${locator}: ${(error as Error).message}`)
  }
}

export const atomChannels = <Stripped extends StrippedText>({
  offsetOf: _offsetOf,
  ...channels
}: Stripped): Omit<Stripped, 'offsetOf'> => channels

// A line channel computed over the wrapped text follows its text through
// the strip: every start and cell boundary lands where its character did.
export const linesAfterStrip = (
  lines: readonly VerseLine[],
  offsetOf: StrippedText['offsetOf'],
): VerseLine[] =>
  lines.map((line) => ({
    ...line,
    start: offsetOf(line.start),
    ...(line.cells === undefined
      ? {}
      : {
          cells: line.cells.map((cell) => ({
            start: offsetOf(cell.start),
            end: offsetOf(cell.end),
          })),
        }),
  }))

// Furniture — a Heading, a figure caption, a section head — never carries an
// Editorial mark (spec-books §10), so a `<` there is a curator's slip.
export const assertNoEditorialMarks = (kind: string, text: string): void => {
  if (text.includes('<'))
    throw new Error(
      `${kind} "${text}": furniture never carries an Editorial mark`,
    )
}
