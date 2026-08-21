// Turns a curated Markdown source into the section / paragraph structure a
// book module is built from (ADR 0002). The conventions the curator follows
// are documented in README.md beside this file; everything the parser knows
// about a book lives in the source, so a new book needs no new parser.

import type {
  FigurePlace,
  FormatSpan,
  Heading,
  HeadingLevel,
  RefSpan,
  VerseLine,
} from '../../src/modules/verse-content'

export type { Heading, HeadingLevel }

// A Figure as the source has it: the image's path, relative to the source
// file, rather than the image itself. The build reads the file and inlines it
// (CONTEXT.md — Figure).
export type FigureSource = {
  path: string
  alt: string
  caption?: string
  place: FigurePlace
}

export type BookParagraph = {
  text: string
  figures?: FigureSource[]
  // Set only on an atom that keeps its own line breaks — a list or a table.
  // The channel addresses the stored text exactly as scripture's does, so a
  // reader that already prints poetry lines prints these rows unchanged.
  lines?: VerseLine[]
  headings?: Heading[]
  refs?: RefSpan[]
}

export type Epigraph = {
  quote: string
  attribution: string
  refs?: RefSpan[]
}

export type ParsedBookSection = {
  chapter: number
  name: string
  named?: true
  epigraphs?: Epigraph[]
  paragraphs: BookParagraph[]
}

export type ParsedBookSource = {
  moduleId: string
  language: string
  sections: ParsedBookSection[]
}

const FRONT_MATTER = /^---\n([\s\S]*?)\n---\n/
const HEADING = /^(#{1,6})\s+(.*)$/
// A section head carries the printed chapter number and the section name;
// `{named}` marks a section the printed work gives no number to.
const SECTION_HEAD = /^(\d+)\.\s+(.+?)(\s*\{named\})?$/
// The first line of a block that keeps its line breaks: a list item or a row
// of a table the curator has already flattened.
const LINE_KEEPING = /^(?:[-*•]|\||\d+[.)])\s*/
// A figure is a Markdown image standing alone as a block, its optional title
// read as the printed caption: `![alt](in-images/x.png "Fig 2 Tree of Life")`.
const FIGURE = /^!\[([^\]]*)\]\(([^)\s]+)(?:\s+"([^"]*)")?\)$/
const QUOTE_LINE = /^>\s?(.*)$/
const ATTRIBUTION_LINE = /^(?:—|–|--)\s*(.*)$/

// Markdown depth below the section head maps straight onto heading levels,
// so the curator expresses hierarchy the way Markdown already does.
const HEADING_LEVELS: Record<number, HeadingLevel> = {
  1: 'part',
  3: 'section',
  4: 'sub-section',
  5: 'sub-section',
  6: 'sub-section',
}

const DEFAULT_LANGUAGE = 'English'

const readFrontMatter = (
  markdown: string,
): { fields: Map<string, string>; body: string } => {
  const match = FRONT_MATTER.exec(markdown)
  if (match === null)
    throw new Error('The source has no `---` front matter naming its module')
  const fields = new Map<string, string>()
  for (const line of match[1].split('\n')) {
    const separator = line.indexOf(':')
    if (separator === -1) continue
    fields.set(line.slice(0, separator).trim(), line.slice(separator + 1).trim())
  }
  return { fields, body: markdown.slice(match[0].length) }
}

const blocksOf = (body: string): string[] =>
  body
    .split(/\n\s*\n/)
    .map((block) => block.trim())
    .filter((block) => block !== '')

// A table row reads as cells, not as pipes: the leading pipe is the curator's
// row marker and carries no text, and the ones between cells become a single
// spaced separator. What is stored is what a citation of the row reads as;
// the cells ride beside it as spans, so the reader prints the grid without
// looking for a delimiter in the text.
const TABLE_ROW = /^\|/
const CELL_SEPARATOR = /\s*\|\s*/
const CELL_JOIN = ' | '
// Markdown's own header rule: the row under a table's header row is pipes
// and dashes alone. It marks the row above it and is stored as no row of its
// own — a table the printed work gives no headings simply carries none.
const HEADER_RULE = /^\|[\s|:-]*-[\s|:-]*$/

type Row = { text: string; cells?: FormatSpan[] }

const rowOf = (line: string, start: number): Row => {
  if (!TABLE_ROW.test(line)) return { text: line }
  const cells: FormatSpan[] = []
  let text = ''
  for (const cell of line
    .replace(TABLE_ROW, '')
    .split(CELL_SEPARATOR)
    .map((cell) => cell.trim())) {
    if (cell === '') {
      cells.push({ start: start + text.length, end: start + text.length })
      continue
    }
    if (text !== '') text += CELL_JOIN
    const at = start + text.length
    text += cell
    cells.push({ start: at, end: start + text.length })
  }
  return { text, cells }
}

// A block whose first line opens a list or a table keeps its line breaks: the
// lines stay in the stored text, and a line channel beside them says where
// each one starts, exactly as a translation's poetry lines do.
const atomOf = (block: string): { text: string; lines?: VerseLine[] } => {
  const lines = block.split('\n').map((line) => line.trim())
  if (!LINE_KEEPING.test(lines[0])) return { text: lines.join(' ') }
  const rows: string[] = []
  const kept: VerseLine[] = []
  let start = 0
  let headerRow = -1
  for (const line of lines) {
    if (HEADER_RULE.test(line)) {
      headerRow = rows.length - 1
      continue
    }
    const row = rowOf(line, start)
    rows.push(row.text)
    kept.push({ start, ...(row.cells === undefined ? {} : { cells: row.cells }) })
    start += row.text.length + 1
  }
  if (headerRow >= 0) kept[headerRow].header = true
  return { text: rows.join('\n'), lines: kept }
}

const epigraphOf = (block: string): Epigraph => {
  const lines = block
    .split('\n')
    .map((line) => QUOTE_LINE.exec(line.trim())?.[1].trim() ?? '')
    .filter((line) => line !== '')
  const last = lines[lines.length - 1] ?? ''
  const attribution = ATTRIBUTION_LINE.exec(last)
  return attribution === null
    ? { quote: lines.join(' '), attribution: '' }
    : { quote: lines.slice(0, -1).join(' '), attribution: attribution[1] }
}

const openSection = (head: string): ParsedBookSection => {
  const match = SECTION_HEAD.exec(head)
  if (match === null)
    throw new Error(
      `A section head must read "<number>. <name>", not "${head}"`,
    )
  const section: ParsedBookSection = {
    chapter: Number(match[1]),
    name: match[2].trim(),
    paragraphs: [],
  }
  return match[3] === undefined ? section : { ...section, named: true }
}

export const parseBookMarkdown = (markdown: string): ParsedBookSource => {
  const { fields, body } = readFrontMatter(markdown)
  const moduleId = fields.get('module')
  if (moduleId === undefined)
    throw new Error('The source front matter names no `module`')

  const sections: ParsedBookSection[] = []
  let current: ParsedBookSection | null = null
  let pending: Heading[] = []
  let pendingFigures: FigureSource[] = []

  // A figure stands with the paragraph that follows it; one that closes a
  // section has none, so it stands below the paragraph it followed instead.
  const settleFigures = (): void => {
    if (pendingFigures.length === 0) return
    const paragraphs = current?.paragraphs ?? []
    const last = paragraphs[paragraphs.length - 1]
    if (last === undefined)
      throw new Error(
        `A figure has no paragraph to stand with: ${pendingFigures[0].path}`,
      )
    last.figures = [
      ...(last.figures ?? []),
      ...pendingFigures.map((figure) => ({
        ...figure,
        place: 'below' as const,
      })),
    ]
    pendingFigures = []
  }

  const atomsOf = (): BookParagraph[] => {
    if (current === null)
      throw new Error('The source has content before the first section head')
    return current.paragraphs
  }

  for (const block of blocksOf(body)) {
    const figure = FIGURE.exec(block)
    if (figure !== null) {
      pendingFigures = [
        ...pendingFigures,
        {
          path: figure[2],
          alt: figure[1],
          ...(figure[3] === undefined ? {} : { caption: figure[3] }),
          place: 'above',
        },
      ]
      continue
    }
    const heading = HEADING.exec(block)
    if (heading !== null) {
      const depth = heading[1].length
      if (depth === 2) {
        settleFigures()
        current = openSection(heading[2].trim())
        sections.push(current)
        continue
      }
      pending = [...pending, { text: heading[2].trim(), level: HEADING_LEVELS[depth] }]
      continue
    }
    if (block.startsWith('>')) {
      if (current === null)
        throw new Error('The source has content before the first section head')
      current.epigraphs = [...(current.epigraphs ?? []), epigraphOf(block)]
      continue
    }
    const paragraph: BookParagraph = atomOf(block)
    if (pendingFigures.length > 0) paragraph.figures = pendingFigures
    atomsOf().push(pending.length === 0 ? paragraph : { ...paragraph, headings: pending })
    pending = []
    pendingFigures = []
  }
  settleFigures()

  return {
    moduleId,
    language: fields.get('language') ?? DEFAULT_LANGUAGE,
    sections,
  }
}
