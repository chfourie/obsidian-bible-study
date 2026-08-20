// Turns the Project Gutenberg #57121 plain text into the section /
// paragraph structure that becomes the Humility module's atoms (ADR 0002).

export type Epigraph = {
  quote: string
  attribution: string
}

// Anchored by character offset into the paragraph's stored text, the same
// way the verse content channels address their spans.
export type Footnote = {
  start: number
  text: string
}

export type BookParagraph = {
  text: string
  footnotes?: Footnote[]
}

export type ParsedSection = {
  chapter: number
  name: string
  epigraphs?: Epigraph[]
  paragraphs: BookParagraph[]
}

const START_MARKER = /^\*\*\* START OF THE PROJECT GUTENBERG EBOOK.*$/m
const END_MARKER = /^\*\*\* END OF THE PROJECT GUTENBERG EBOOK.*$/m
const PRODUCER_CREDIT = /^Produced by .*$/gm

const PREFACE_HEAD = 'PREFACE.'
const CONTENTS_HEAD = 'Contents'
const NOTES_DIVIDER = 'Notes.'
const PRAYER_HEAD = 'A PRAYER FOR HUMILITY'
const RUNNING_HEAD = /^Humility: The Beauty of Holiness\.?$/
const CHAPTER_HEAD = /^([IVX]+)\.$/
const NOTE_HEAD = /^Note\s+([A-Z])\.?--/i
const EPIGRAPH_OPENER = "_'"
const EPIGRAPH = /_'([\s\S]*?)'_\s*(?:--)?\s*([^_]*?)(?=\s*_'|$)/g
const FOOTNOTE = /\s*\[Footnote\d*:\s*([\s\S]*?)\]/g

const CHAPTER_NUMERALS = [
  'I',
  'II',
  'III',
  'IV',
  'V',
  'VI',
  'VII',
  'VIII',
  'IX',
  'X',
  'XI',
  'XII',
]

const PREFACE_CHAPTER = 0
const FIRST_NOTE_CHAPTER = 13
const BLOCK_SEPARATOR = '\n\n'

// The blemishes in the Gutenberg transcription, corrected against the
// Internet Archive scan `humilitybeautyof00murr` (see
// docs/research/humility-source-text.md). Each must still match exactly
// once, so a re-transcribed source fails the build instead of silently
// shipping an unfixed — or double-fixed — text.
const TRANSCRIPTION_FIXES = [
  {
    blemish: 'with him the is of a contrite',
    correction: 'with him also that is of a contrite',
  },
  {
    blemish: 'to make it known the region of eternity',
    correction: 'to make it known in the region of eternity',
  },
  {
    blemish: '(John v 30)',
    correction: '(John v. 30)',
  },
]

export const stripGutenbergWrapper = (raw: string): string => {
  const start = START_MARKER.exec(raw)
  if (start === null) throw new Error('Source has no Gutenberg start marker')
  const body = raw.slice(start.index + start[0].length)
  const end = END_MARKER.exec(body)
  if (end === null) throw new Error('Source has no Gutenberg end marker')
  const stripped = body.slice(0, end.index).replace(PRODUCER_CREDIT, '')
  if (/gutenberg/i.test(stripped))
    throw new Error('Project Gutenberg name survives inside the book text')
  return stripped
}

export const applyTranscriptionFixes = (text: string): string =>
  TRANSCRIPTION_FIXES.reduce((fixed, { blemish, correction }) => {
    const parts = fixed.split(blemish)
    if (parts.length !== 2)
      throw new Error(
        `Transcription fix matched ${parts.length - 1} times, ` +
          `expected 1: "${blemish}"`,
      )
    return parts.join(correction)
  }, text)

const stripItalicMarkers = (text: string): string => text.replace(/_/g, '')

const unwrapBlocks = (text: string): string[] =>
  text
    .split(/\n\s*\n/)
    .map((block) =>
      block
        .split('\n')
        .map((line) => line.trim())
        .filter((line) => line !== '')
        .join(' '),
    )
    .filter((block) => block !== '')

const parseEpigraphs = (block: string): Epigraph[] =>
  [...block.matchAll(EPIGRAPH)].map(([, quote, attribution]) => ({
    quote: stripItalicMarkers(quote).trim(),
    attribution: stripItalicMarkers(attribution).trim(),
  }))

const parseParagraph = (block: string): BookParagraph => {
  const source = stripItalicMarkers(block)
  const footnotes: Footnote[] = []
  let text = ''
  let consumed = 0
  for (const match of source.matchAll(FOOTNOTE)) {
    text += source.slice(consumed, match.index)
    footnotes.push({ start: text.length, text: match[1].trim() })
    consumed = match.index + match[0].length
  }
  text = (text + source.slice(consumed)).trim()
  return footnotes.length === 0 ? { text } : { text, footnotes }
}

const chapterNumeralValue = (block: string): number | null => {
  const head = CHAPTER_HEAD.exec(block)
  const index = head === null ? -1 : CHAPTER_NUMERALS.indexOf(head[1])
  return index === -1 ? null : index + 1
}

const sectionName = (title: string): string => title.replace(/\.$/, '')

export const parseHumilityText = (raw: string): ParsedSection[] => {
  const blocks = applyTranscriptionFixes(
    unwrapBlocks(stripGutenbergWrapper(raw)).join(BLOCK_SEPARATOR),
  ).split(BLOCK_SEPARATOR)

  const sections: ParsedSection[] = []
  let current: ParsedSection | null = null
  let pendingChapter: number | null = null
  let expectEpigraph = false
  let skipping = true
  let notesSeen = 0

  const open = (chapter: number, name: string): ParsedSection => {
    const section: ParsedSection = { chapter, name, paragraphs: [] }
    sections.push(section)
    skipping = false
    expectEpigraph = false
    return section
  }

  for (const block of blocks) {
    if (RUNNING_HEAD.test(block) || block === NOTES_DIVIDER) continue
    if (block === CONTENTS_HEAD) {
      skipping = true
      continue
    }
    if (block === PREFACE_HEAD) {
      current = open(PREFACE_CHAPTER, 'Preface')
      continue
    }
    if (block === PRAYER_HEAD) {
      current = open(FIRST_NOTE_CHAPTER + notesSeen, 'A Prayer for Humility')
      continue
    }
    const numeral = chapterNumeralValue(block)
    if (numeral !== null) {
      pendingChapter = numeral
      continue
    }
    if (pendingChapter !== null) {
      current = open(pendingChapter, sectionName(block))
      pendingChapter = null
      expectEpigraph = true
      continue
    }
    const note = NOTE_HEAD.exec(block)
    if (note !== null) {
      const letter = note[1].toUpperCase()
      current = open(
        FIRST_NOTE_CHAPTER + letter.charCodeAt(0) - 'A'.charCodeAt(0),
        `Note ${letter}`,
      )
      notesSeen += 1
      current.paragraphs.push(parseParagraph(block.slice(note[0].length)))
      continue
    }
    if (skipping || current === null) continue
    if (expectEpigraph && block.startsWith(EPIGRAPH_OPENER)) {
      current.epigraphs = [
        ...(current.epigraphs ?? []),
        ...parseEpigraphs(block),
      ]
      continue
    }
    expectEpigraph = false
    current.paragraphs.push(parseParagraph(block))
  }

  return sections
}
