// Turns a curated Markdown source into the section / atom structure a book
// module is built from (ADR 0002). The conventions the curator follows are
// documented in README.md beside this file. What varies between Books is the
// registry's atom kind, which picks the body parser (spec-books §2) — a new
// book needs no new parser, only a curated source and a registry entry.

import {
  type BookAtomKind,
  DEFAULT_BOOK_ATOM_KIND,
  type ReadingStep,
} from '../../src/modules/module-manifest'
import type {
  FigurePlace,
  Footnote,
  FormatSpan,
  Heading,
  HeadingLevel,
  RefSpan,
  VerseLine,
} from '../../src/modules/verse-content'
import {
  assertNoEditorialMarks,
  atomChannels,
  type EditorialMarkChannels,
  linesAfterStrip,
  stripAtomMarks,
} from './parse-editorial-marks'
import { assertNoFootnoteMarker, liftAtomNotes } from './parse-footnotes'
import {
  readVerseBlock,
  type VerseSourceLine,
  verseSectionAtoms,
} from './parse-verse-lines'

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

// The three Editorial-mark channels ride on an atom and on an epigraph's
// quote alike (spec-books §10); an unmarked atom carries none of them.
export type BookParagraph = EditorialMarkChannels & {
  text: string
  // The editor's notes on this atom, lifted out of its text (spec-books §6).
  footnotes?: Footnote[]
  figures?: FigureSource[]
  // Set only on an atom that keeps its own line breaks — a list or a table.
  // The channel addresses the stored text exactly as scripture's does, so a
  // reader that already prints poetry lines prints these rows unchanged.
  lines?: VerseLine[]
  headings?: Heading[]
  refs?: RefSpan[]
}

export type Epigraph = EditorialMarkChannels & {
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
  // A verse-atom section whose page order is not the identity walk
  // (spec-books §11, ADR 0013).
  reading?: ReadingStep[]
}

export type ParsedBookSource = {
  moduleId: string
  language: string
  sections: ParsedBookSection[]
}

// The Book's atom kind selects the body parser (spec-books §2): blank-line
// paragraphs for a paragraph Book, `N.` / `Na.` verse-lines for a verse-atom
// Book. The kind is the registry's, never front matter (ADR 0011).
export type ParseBookOptions = {
  atom?: BookAtomKind
}

const FRONT_MATTER = /^---\n([\s\S]*?)\n---\n/
const HEADING = /^(#{1,6})\s+(.*)$/
// A section head carries the printed chapter number and the section name;
// `{named}` marks a section the printed work gives no number to. A verse-atom
// section the print left untitled is `## 5.` alone (spec-books §1).
const SECTION_HEAD = /^(\d+)\.(?:\s+(.+?))?(\s*\{named\})?$/
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

// Furniture carries neither an Editorial mark nor a Footnote (spec-books
// §6, §10): a Heading, a section head and a figure's caption or alt text are
// plain printed text.
const assertPlainFurniture = (kind: string, text: string): void => {
  assertNoEditorialMarks(kind, text)
  assertNoFootnoteMarker(`${kind} "${text}"`, text)
}

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

// Obsidian's own comment syntax, so the source reads the same in the vault
// (README §Curator comments).
const CURATOR_COMMENT = /^\s*%%/
// The curator's conscious waiver of a marked atom the print gives no note
// for (spec-books §2, README §Footnotes): the locator, then the reason.
const WAIVER = /^\s*%%\s*waived\s+(\S+)\s*(.*)$/

// A waiver keeps the source line it stands on, so the build can cite it as
// it cites every other failure.
export type CurationWaiver = { locator: string; line: number }

export const curationWaivers = (markdown: string): CurationWaiver[] => {
  const waivers: CurationWaiver[] = []
  markdown.split('\n').forEach((raw, index) => {
    const waiver = WAIVER.exec(raw)
    if (waiver === null) return
    const [, locator, reason] = waiver
    const line = index + 1
    if (reason.trim() === '')
      throw new Error(`line ${line}: the waiver of ${locator} gives no reason`)
    waivers.push({ locator, line })
  })
  return waivers
}

// A block with the source line it starts on, so a verse-atom build failure
// can cite the line the curator has to look at.
type Block = { text: string; line: number }

const blocksOf = (body: string, firstLine: number): Block[] => {
  const blocks: Block[] = []
  let open: { lines: string[]; line: number } | null = null
  const close = (): void => {
    if (open !== null) blocks.push({ text: open.lines.join('\n').trim(), line: open.line })
    open = null
  }
  body.split('\n').forEach((raw, index) => {
    if (CURATOR_COMMENT.test(raw)) return
    if (raw.trim() === '') return close()
    open ??= { lines: [], line: firstLine + index }
    open.lines.push(raw)
  })
  close()
  return blocks
}

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
// The Editorial-mark wrappers are stripped from the joined atom, so a wrapper
// may run over a line break; a list's line starts and a table's cells follow
// their text through the strip.
const atomOf = (
  locator: string,
  block: string,
): EditorialMarkChannels & {
  text: string
  footnotes?: Footnote[]
  lines?: VerseLine[]
} => {
  const lines = block.split('\n').map((line) => line.trim())
  if (!LINE_KEEPING.test(lines[0]))
    return atomChannels(liftAtomNotes(locator, lines.join(' ')))
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
  const stripped = liftAtomNotes(locator, rows.join('\n'))
  return {
    ...atomChannels(stripped),
    lines: linesAfterStrip(kept, stripped.offsetOf),
  }
}

// An epigraph's marks sit on its quote; the attribution line carries Ref
// Spans instead, so a `<` there has nothing to say.
const epigraphOf = (locator: string, block: string): Epigraph => {
  const lines = block
    .split('\n')
    .map((line) => QUOTE_LINE.exec(line.trim())?.[1].trim() ?? '')
    .filter((line) => line !== '')
  const last = lines[lines.length - 1] ?? ''
  const attributed = ATTRIBUTION_LINE.exec(last)
  const attribution = attributed?.[1] ?? ''
  const quoted = attributed === null ? lines : lines.slice(0, -1)
  if (attribution.includes('<'))
    throw new Error(`atom ${locator}: a raw \`<\` stands in the attribution`)
  assertNoFootnoteMarker(`epigraph ${locator}`, lines.join(' '))
  const { text: quote, ...channels } = atomChannels(
    stripAtomMarks(locator, quoted.join(' ')),
  )
  return { quote, attribution, ...channels }
}

// A paragraph Book's section head names the section; a verse-atom section
// the print left untitled takes its printed chapter number as its name and
// is not `named` (spec-books §1).
const openSection = (head: string, atom: BookAtomKind): ParsedBookSection => {
  const match = SECTION_HEAD.exec(head)
  const name = match?.[2]?.trim()
  if (match === null || (name === undefined && atom !== 'verse'))
    throw new Error(
      `A section head must read "<number>. <name>", not "${head}"`,
    )
  if (name !== undefined) assertPlainFurniture('section head', name)
  const section: ParsedBookSection = {
    chapter: Number(match[1]),
    name: name ?? match[1],
    paragraphs: [],
  }
  return match[3] === undefined ? section : { ...section, named: true }
}

// The module a source is curated for, read before the body is parsed so the
// registry can say which parser the body takes.
export const sourceModuleId = (markdown: string): string => {
  const moduleId = readFrontMatter(markdown).fields.get('module')
  if (moduleId === undefined)
    throw new Error('The source front matter names no `module`')
  return moduleId
}

export const parseBookMarkdown = (
  markdown: string,
  options: ParseBookOptions = {},
): ParsedBookSource => {
  const atom = options.atom ?? DEFAULT_BOOK_ATOM_KIND
  const moduleId = sourceModuleId(markdown)
  const { fields, body } = readFrontMatter(markdown)
  const bodyLine = markdown.slice(0, markdown.length - body.length).split('\n').length

  const sections: ParsedBookSection[] = []
  let current: ParsedBookSection | null = null
  let pending: Heading[] = []
  let pendingFigures: FigureSource[] = []
  // A verse-atom section's lines in page order, settled into atoms when the
  // section closes: a blank line is never an atom delimiter, so an atom's
  // lines may span blocks and a later verse's line may stand inside an
  // earlier verse's poem.
  let verseLines: VerseSourceLine[] = []
  const furniture = new Map<number, Pick<BookParagraph, 'headings' | 'figures'>>()

  const settleVerses = (): void => {
    if (current === null || atom !== 'verse') return
    const { atoms, reading } = verseSectionAtoms(current.chapter, verseLines)
    current.paragraphs = atoms.map((verse, index) => ({
      ...verse,
      ...(furniture.get(index + 1) ?? {}),
    }))
    if (reading !== undefined) current.reading = reading
    verseLines = []
    furniture.clear()
  }

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

  const readVerses = (block: Block): void => {
    const lines = readVerseBlock(block.text, block.line)
    const first = lines[0].atom
    if (pending.length > 0 || pendingFigures.length > 0)
      furniture.set(first, {
        ...(furniture.get(first) ?? {}),
        ...(pending.length === 0 ? {} : { headings: pending }),
        ...(pendingFigures.length === 0 ? {} : { figures: pendingFigures }),
      })
    verseLines.push(...lines)
  }

  for (const { text: block, line } of blocksOf(body, bodyLine)) {
    const figure = FIGURE.exec(block)
    if (figure !== null) {
      assertPlainFurniture('figure alt', figure[1])
      if (figure[3] !== undefined) assertPlainFurniture('figure caption', figure[3])
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
        settleVerses()
        settleFigures()
        current = openSection(heading[2].trim(), atom)
        sections.push(current)
        continue
      }
      assertPlainFurniture('heading', heading[2].trim())
      pending = [...pending, { text: heading[2].trim(), level: HEADING_LEVELS[depth] }]
      continue
    }
    if (block.startsWith('>')) {
      if (current === null)
        throw new Error('The source has content before the first section head')
      current.epigraphs = [
        ...(current.epigraphs ?? []),
        epigraphOf(
          `${current.chapter}.e${(current.epigraphs?.length ?? 0) + 1}`,
          block,
        ),
      ]
      continue
    }
    if (atom === 'verse') {
      atomsOf()
      readVerses({ text: block, line })
    } else {
      const atoms = atomsOf()
      const paragraph: BookParagraph = atomOf(
        `${current?.chapter}.${atoms.length + 1}`,
        block,
      )
      if (pendingFigures.length > 0) paragraph.figures = pendingFigures
      atoms.push(pending.length === 0 ? paragraph : { ...paragraph, headings: pending })
    }
    pending = []
    pendingFigures = []
  }
  settleVerses()
  settleFigures()

  return {
    moduleId,
    language: fields.get('language') ?? DEFAULT_LANGUAGE,
    sections,
  }
}
