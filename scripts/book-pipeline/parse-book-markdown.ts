// Turns a curated Markdown source into the section / paragraph structure a
// book module is built from (ADR 0002). The conventions the curator follows
// are documented in README.md beside this file; everything the parser knows
// about a book lives in the source, so a new book needs no new parser.

import type { RefSpan } from '../../src/modules/verse-content'

// A title printed inside a section, attached to the paragraph it precedes
// and consuming no id of its own (CONTEXT.md — Heading).
export type HeadingLevel = 'part' | 'section' | 'sub-section'

export type Heading = {
  text: string
  level: HeadingLevel
}

export type BookParagraph = {
  text: string
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

const atomTextOf = (block: string): string => {
  const lines = block.split('\n').map((line) => line.trim())
  return LINE_KEEPING.test(lines[0]) ? lines.join('\n') : lines.join(' ')
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

  const atomsOf = (): BookParagraph[] => {
    if (current === null)
      throw new Error('The source has content before the first section head')
    return current.paragraphs
  }

  for (const block of blocksOf(body)) {
    const heading = HEADING.exec(block)
    if (heading !== null) {
      const depth = heading[1].length
      if (depth === 2) {
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
    const paragraph: BookParagraph = { text: atomTextOf(block) }
    atomsOf().push(pending.length === 0 ? paragraph : { ...paragraph, headings: pending })
    pending = []
  }

  return {
    moduleId,
    language: fields.get('language') ?? DEFAULT_LANGUAGE,
    sections,
  }
}
