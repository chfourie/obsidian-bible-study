// Curation aid, not a build dependency: turns the translation body of the
// Project Gutenberg #77935 plain text into a first draft of the curated
// 1 Enoch source (spec-books §2, §10, §11). The draft was hand-fixed against
// the 1912 Clarendon page images before it became
// resources/1 Enoch Charles 1912.md — see the CURATION.md beside it — so
// re-running this over the PG text reproduces the mechanical layer only.
//
// Usage:
//   node scripts/enoch-pipeline/convert-pg77935.mjs <pg77935.txt> <draft.md>

import { readFileSync, writeFileSync } from 'node:fs'

const PARTS = [
  [1, 36, 'The Book of the Watchers (I–XXXVI)'],
  [37, 71, 'The Parables (XXXVII–LXXI)'],
  [72, 82, 'The Book of the Courses of the Heavenly Luminaries (LXXII–LXXXII)'],
  [83, 90, 'The Dream-Visions (LXXXIII–XC)'],
  [91, 105, 'The Epistle of Enoch (XCI–CV)'],
  [106, 107, 'Fragment of the Book of Noah (CVI–CVII)'],
  [108, 108, 'An Appendix to the Book of Enoch (CVIII)'],
]

const ROMAN = { I: 1, V: 5, X: 10, L: 50, C: 100 }
const romanToNumber = (roman) => {
  let total = 0
  for (let i = 0; i < roman.length; i += 1) {
    const value = ROMAN[roman[i]]
    const next = ROMAN[roman[i + 1]] ?? 0
    total += value < next ? -value : value
  }
  return total
}

const [, , pgPath, outPath] = process.argv
const pg = readFileSync(pgPath, 'utf8').split(/\r?\n/)
const firstLine = pg.findIndex(
  (line, index) => /^ +THE BOOK OF ENOCH$/.test(line) && /^ +I-XXXVI\.$/.test(pg[index + 1]),
)
const lastLine = pg.findIndex((line) => /^PRINTED IN GREAT BRITAIN/.test(line))
const body = pg.slice(firstLine, lastLine)

const log = (line, message) => console.error(`line ${line}: ${message}`)

const blocks = []
let open = null
body.forEach((raw, index) => {
  const line = firstLine + index + 1
  if (raw.trim() === '') {
    open = null
    return
  }
  const indent = raw.length - raw.trimStart().length
  const text = raw.trim()
  if (open === null) {
    open = { line, lines: [] }
    blocks.push(open)
  }
  open.lines.push({ indent, text, line })
})

const HEADING =
  /^[IVXLC]+(?:-[IVXLC]+)?[.,]\s*(?:[IVXLC]+(?:-[IVXLC]+)?[.,]\s*|\d+(?:[-–]\d+)?[.,]?\s*|[-–]\s*)*[_=]|^[_=][A-Z]/
const COLUMN_LABEL = { E: 'E', 'G^g': 'Gᵍ', 'G^s': 'Gˢ' }
const CHAPTER_START = /^(\[?)([IVXLC]+)\.\s+(.*)$/
const PART_HEAD = /^[A-Z][A-Z .,()\-—’]*$/

const chapters = new Map()
let chapter = null
let verse = 0
let maxVerse = 0
let seen = new Set()
let pendingHeadings = []
let columnLabel = null
let switchTo = null

// Charles prints 91:12–17 after 93 and opens 38 with no chapter numeral: a
// heading's leading numeral names the chapter the next block belongs to.
const enterChapter = (number) => {
  if (chapter !== null) Object.assign(chapters.get(chapter), { verse, maxVerse, seen })
  if (!chapters.has(number)) chapters.set(number, { entries: [], verse: 1, maxVerse: 0, seen: new Set() })
  chapter = number
  ;({ verse, maxVerse, seen } = chapters.get(number))
}

const chapterEntries = () => {
  if (chapter === null) throw new Error('text before the first chapter')
  return chapters.get(chapter).entries
}

const pushEntry = (entry) => {
  const entries = chapterEntries()
  if (pendingHeadings.length > 0) {
    entry.headings = pendingHeadings
    pendingHeadings = []
  }
  entries.push(entry)
  return entry
}

// Inline verse markers in prose: `2. `, `[1. `, `48^b. `, `14_d._ `. A marker
// is accepted when it is the next verse of the chapter, or a lettered line
// of a verse already seen, or the first marker of a parallel-column block.
const MARKER = /(?<=^|\s)(\[?)(\d+)(?:\^([a-z])|_([a-z])\._)?\.\s+/g
const splitProse = (joined, line) => {
  const pieces = []
  let cursor = 0
  let current = { verse, letter: undefined }
  let first = true
  let carried = ''
  for (const match of joined.matchAll(MARKER)) {
    const [whole, bracket, digits, caret, italic] = match
    const number = Number(digits)
    const letter = caret ?? italic
    // Charles restores a verse a few places ahead of its number (106:17
    // before 15); a numeral far ahead (74:16's "80.") is text.
    const accepted =
      number === maxVerse + 1 ||
      number === verse + 1 ||
      (number <= maxVerse + 5 && !seen.has(number)) ||
      (letter !== undefined && number <= maxVerse + 1) ||
      (first && seen.has(number))
    if (!accepted) {
      log(line, `left "${whole.trim()}" in the text (expected verse ${maxVerse + 1})`)
      continue
    }
    if (number !== maxVerse + 1 && letter === undefined)
      log(line, `verse ${number} stands where ${maxVerse + 1} was expected — check the page order`)
    const before = `${carried}${joined.slice(cursor, match.index)}`.trim()
    if (before !== '') pieces.push({ ...current, text: before })
    else if (!first && letter === undefined) log(line, `verse ${current.verse} is empty`)
    cursor = match.index + whole.length
    current = { verse: number, letter }
    carried = bracket
    maxVerse = Math.max(maxVerse, number)
    seen.add(number)
    verse = number
    first = false
  }
  const tail = `${carried}${joined.slice(cursor)}`.trim()
  if (tail !== '') pieces.push({ ...current, text: tail })
  return pieces
}

const readProse = (lines) => {
  const joined = lines.map((l) => l.text).join(' ')
  const pieces = splitProse(joined, lines[0].line)
  pieces.forEach((piece, index) =>
    pushEntry({
      verse: piece.verse,
      letter: piece.letter,
      text: piece.text,
      stanza: index === 0,
      line: lines[0].line,
      column: columnLabel,
    }),
  )
}

const PG_WIDTH = 72
const VERSE_PREFIX = /^(\[?)(\d+)\.\s*(.*)$/
const LETTER_PREFIX = /^(\[?)(\d+)?\s?(?:_([a-z])\._|\^([a-z]))\s*(.*)$/

const readPoetry = (lines) => {
  const parsed = lines.map((l) => {
    const numbered = VERSE_PREFIX.exec(l.text)
    if (numbered !== null)
      return { ...l, verse: Number(numbered[2]), text: `${numbered[1]}${numbered[3]}`, prefixed: true }
    const lettered = LETTER_PREFIX.exec(l.text)
    if (lettered !== null)
      return {
        ...l,
        verse: lettered[2] === undefined ? undefined : Number(lettered[2]),
        letter: lettered[3] ?? lettered[4],
        text: `${lettered[1]}${lettered[5]}`,
        prefixed: true,
      }
    return { ...l, prefixed: false }
  })
  const prefixed = parsed.filter((l) => l.prefixed)
  const plain = parsed.filter((l) => !l.prefixed)
  const prefixIndent = prefixed[0]?.indent
  const plainIndent = plain.length === 0 ? undefined : Math.min(...plain.map((l) => l.indent))
  const deeper =
    prefixIndent !== undefined && plainIndent !== undefined && plainIndent > prefixIndent
  // Chapters I–V hang their poems (number outdented, metrical lines and the
  // wraps of the numbered line at one indent); from VI on a deeper line is a
  // page-wrap. Two deeper lines in a row are logged for a look by hand.
  const hanging = deeper && chapter <= 5
  if (deeper && !hanging && plain.filter((l) => l.indent > prefixIndent).length >= 2)
    log(lines[0].line, `several deeper lines read as wraps in verse ${verse} — check by hand`)
  const metricalIndent = hanging ? plainIndent : (prefixIndent ?? plainIndent)
  const previousEntry = chapterEntries()[chapterEntries().length - 1]
  let last =
    !parsed[0].prefixed && previousEntry?.letter !== undefined ? previousEntry : null
  let previousWidth = 0
  parsed.forEach((l, index) => {
    if (l.prefixed) {
      previousWidth = lines[index].indent + lines[index].text.length
      if (l.verse !== undefined) {
        if (l.letter === undefined && l.verse !== maxVerse + 1 && !(l.verse === 1 && maxVerse <= 1))
          log(l.line, `poetry verse ${l.verse} where ${maxVerse + 1} was expected`)
        maxVerse = Math.max(maxVerse, l.verse)
        seen.add(l.verse)
        verse = l.verse
      }
      last = pushEntry({
        verse: l.verse ?? verse,
        letter: l.letter,
        text: l.text,
        stanza: index === 0,
        line: l.line,
      })
      return
    }
    // Charles's letters label half-verses; the lines under one letter are
    // stored as that one lettered line (ADR 0011 admits no unlettered line
    // after a lettered one).
    if (last !== null && last.letter !== undefined) {
      log(l.line, `joined onto ${verse}${last.letter}: ${l.text}`)
      last.text = `${last.text} ${l.text}`
      previousWidth = l.indent + l.text.length
      return
    }
    if (last !== null && l.indent > metricalIndent) {
      const firstWord = l.text.split(' ')[0]
      const fitsOnPrevious = previousWidth + 1 + firstWord.length <= PG_WIDTH
      if (!hanging || !fitsOnPrevious) {
        last.text = `${last.text} ${l.text}`
        previousWidth = l.indent + l.text.length
        return
      }
    }
    previousWidth = l.indent + l.text.length
    last = pushEntry({ verse, text: l.text, stanza: index === 0, line: l.line })
  })
}

for (const block of blocks) {
  const opening = block.lines[0]
  if (block.lines.length === 1 && COLUMN_LABEL[opening.text] !== undefined) {
    columnLabel = COLUMN_LABEL[opening.text]
    continue
  }
  if (/—EDD\.\]$/.test(opening.text)) {
    log(opening.line, `SPCK editors' note dropped: ${opening.text}`)
    continue
  }
  if (block.lines.every((l) => PART_HEAD.test(l.text) && l.indent > 0)) {
    log(opening.line, `part head skipped: ${block.lines.map((l) => l.text).join(' / ')}`)
    continue
  }
  const joinedHead = block.lines.map((l) => l.text).join(' ')
  if (HEADING.test(joinedHead)) {
    const text = joinedHead.replace(/[_=]/g, '').replace(/\s+/g, ' ').trim()
    pendingHeadings.push(text)
    const named = /^([IVXLC]+)[.,-]/.exec(text)
    if (named !== null && romanToNumber(named[1]) !== chapter) switchTo = romanToNumber(named[1])
    continue
  }
  let lines = block.lines
  const start = CHAPTER_START.exec(opening.text)
  if (start !== null && /^[IVXLC]+$/.test(start[2])) {
    const number = romanToNumber(start[2])
    if (number !== chapter) {
      if (number !== (chapter ?? 0) + 1) log(opening.line, `chapter ${number} after ${chapter}`)
      enterChapter(number)
    }
    lines = [{ ...opening, text: `${start[1]}${start[3]}` }, ...block.lines.slice(1)]
  } else if (switchTo !== null) {
    log(opening.line, `chapter ${switchTo} entered from its heading`)
    enterChapter(switchTo)
  }
  switchTo = null
  if (columnLabel !== null) {
    readProse(lines)
    columnLabel = null
  } else if (opening.indent === 0) {
    readProse(lines)
  } else {
    readPoetry(lines)
  }
  if (maxVerse === 0) {
    maxVerse = 1
    seen.add(1)
  }
}

// Glyphs: the 1912 print's, each stay-glyph in its own wrapper (spec-books §10).
const GLYPHS = [
  ['⌜', '<marks>⌈</marks>'],
  ['⌝', '<marks>⌉</marks>'],
  ['〚', '<marks>⌈⌈</marks>'],
  ['〛', '<marks>⌉⌉</marks>'],
  ['‹', '<marks>〈</marks>'],
  ['›', '<marks>〉</marks>'],
  ['[', '<marks>[</marks>'],
  [']', '<marks>]</marks>'],
  ['†', '<marks>†</marks>'],
  ['...', '<marks>…</marks>'],
]
const SUPERSCRIPT = { 1: '¹', 2: '²', 3: '³', 4: '⁴', 5: '⁵', 6: '⁶', 7: '⁷', 8: '⁸', 9: '⁹', 0: '⁰' }

const markUp = (entry) => {
  let text = entry.text
  const opensParen = (text.match(/\(/g) ?? []).length
  const closesParen = (text.match(/\)/g) ?? []).length
  if (opensParen !== closesParen) log(entry.line, `unbalanced ( ) in verse ${entry.verse}: ${text}`)
  const equals = (text.match(/=/g) ?? []).length
  if (equals % 2 === 1) log(entry.line, `unbalanced = = in verse ${entry.verse}: ${text}`)
  text = text.replace(/_i\. e\._/g, 'i. e.')
  if (/_/.test(text)) log(entry.line, `italics left in verse ${entry.verse}: ${text}`)
  text = text.replace(/\^(\d)/g, (_, d) => SUPERSCRIPT[d])
  text = text.replace(/\(([^()]*)\)/g, '<supplied>$1</supplied>')
  text = text.replace(/=([^=]+)=/g, '<emended>$1</emended>')
  for (const [from, to] of GLYPHS) text = text.split(from).join(to)
  return text
}

const out = ['---', 'module: 1en-c1912', 'language: English', '---']
let part = null
for (const number of [...chapters.keys()].sort((a, b) => a - b)) {
  const { entries } = chapters.get(number)
  const range = PARTS.find(([from, to]) => number >= from && number <= to)
  if (range[2] !== part) {
    part = range[2]
    out.push('', `# ${part}`)
  }
  const ordered =
    number === 91 ? [...entries].sort((a, b) => a.verse - b.verse) : entries
  out.push('', `## ${number}.`)
  let previous = null
  for (const entry of ordered) {
    if (entry.headings !== undefined) {
      for (const heading of entry.headings) out.push('', `### ${heading}`)
      out.push('')
    } else if (entry.stanza || previous === null || entry.column !== previous.column) out.push('')
    const prefix = `${entry.verse}${entry.letter ?? ''}.`
    if (entry.column !== undefined && entry.column !== null && (previous?.column !== entry.column || previous?.verse !== entry.verse))
      out.push(`${prefix} ${entry.column}`)
    out.push(`${prefix} ${markUp(entry)}`)
    previous = entry
  }
}
writeFileSync(outPath, `${out.join('\n')}\n`)
