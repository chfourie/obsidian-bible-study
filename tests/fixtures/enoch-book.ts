import type {
  BookContent,
  ModuleManifest,
  ReadingStep,
  StructuredVerse,
  VerseLine,
} from '../../src/modules'
import {
  deregisterBook,
  deregisterBookVersification,
  makeVerseId,
  registerBook,
  registerBookVersification,
  type BookSectionLabel,
} from '../../src/reference'

// The first verse-atom Book (spec-books §1), trimmed to the chapters the
// specs address. Charles titled none of these, so each section is named by
// its printed chapter number and none is `named`. Chapter 1 is deeper than
// the print's nine verses so the §4 locator table's `1:9-11` has a grid to
// land on; chapter 5 mirrors the print's 5:6–7 interleave (§11).
export const ENOCH_BOOK = 103
export const ENOCH_MODULE_ID = '1en-c1912'

type Section = BookSectionLabel & { paragraphs: number; reading?: ReadingStep[] }

type SourceLine = { text: string; letter?: string; paragraph?: boolean }

// Lines the way the pipeline stores them: space-joined into one string,
// each start an offset into it, the letter on the line and never in the text.
const linedAtom = (lines: SourceLine[]): StructuredVerse => {
  const verseLines: VerseLine[] = []
  let start = 0
  for (const line of lines) {
    const verseLine: VerseLine = { start }
    if (line.letter !== undefined) verseLine.letter = line.letter
    if (line.paragraph === true) verseLine.paragraph = true
    verseLines.push(verseLine)
    start += line.text.length + 1
  }
  return { text: lines.map((line) => line.text).join(' '), lines: verseLines }
}

const lettered = (
  letters: string,
  texts: string[],
  stanzaAt: number[],
): StructuredVerse =>
  linedAtom(
    texts.map((text, index) => ({
      text,
      letter: letters[index],
      paragraph: stanzaAt.includes(index),
    })),
  )

// Chapter 5 as Charles set it: verses 1–5 and 8 prose, 6 lettered a–j with
// no h and a stanza blank before 6d, 7 lettered a–c with no blank of its own
// (7c sits inside 6's poem and 7a follows 6j directly), 9 four lines with a
// stanza blank before its third.
export const ENOCH_CHAPTER_5: Record<number, StructuredVerse> = {
  1: { text: 'Observe how the trees bear fruit.' },
  2: { text: 'And all His works go on from year to year.' },
  3: { text: 'And behold how the sea and the rivers accomplish their tasks.' },
  // The two notes Charles's page carries on this verse, lifted out of the
  // stored string at build (spec-books §6): the Study Panel is the only
  // surface that ever shows them.
  4: {
    text: 'But ye have not been steadfast.',
    footnotes: [
      { start: 30, text: 'So Dillmann; the Ethiopic is corrupt here.' },
      { start: 31, text: 'Charles restores the line from the Greek.' },
    ],
  },
  5: { text: 'Therefore shall ye execrate your days.' },
  6: lettered(
    'abcdefgij',
    [
      'In those days ye shall make your names an execration,',
      'And by you shall all who curse, curse.',
      'And all the sinners shall imprecate by you,',
      'And all the righteous shall rejoice,',
      'And there shall be forgiveness of sins,',
      'And every mercy and peace and forbearance:',
      'There shall be salvation unto them, a goodly light.',
      'And for all of you sinners there shall be no salvation,',
      'But on you all shall abide a curse.',
    ],
    [0, 3],
  ),
  7: lettered(
    'abc',
    [
      'But for the elect there shall be light and grace and peace,',
      'And they shall inherit the earth.',
      'And for you, the godless, there shall be a curse.',
    ],
    [],
  ),
  8: { text: 'And then there shall be bestowed upon the elect wisdom.' },
  9: linedAtom([
    { text: 'And they shall not again transgress,', paragraph: true },
    { text: 'Nor shall they sin all the days of their life,' },
    { text: 'And their lives shall be increased in peace,', paragraph: true },
    { text: 'And the years of their joy shall be multiplied.' },
  ]),
}

// The page walk of chapter 5: 7c printed inside verse 6's poem (ADR 0010).
export const ENOCH_CHAPTER_5_READING: ReadingStep[] = [
  { atom: 1 },
  { atom: 2 },
  { atom: 3 },
  { atom: 4 },
  { atom: 5 },
  { atom: 6, line: 0 },
  { atom: 6, line: 1 },
  { atom: 6, line: 2 },
  { atom: 7, line: 2 },
  ...[3, 4, 5, 6, 7, 8].map((line) => ({ atom: 6, line })),
  { atom: 7, line: 0 },
  { atom: 7, line: 1 },
  { atom: 8 },
  ...[0, 1, 2, 3].map((line) => ({ atom: 9, line })),
]

export const ENOCH_SECTIONS: readonly Section[] = [
  { chapter: 1, name: '1', paragraphs: 11 },
  { chapter: 2, name: '2', paragraphs: 5 },
  { chapter: 3, name: '3', paragraphs: 3 },
  { chapter: 4, name: '4', paragraphs: 1 },
  { chapter: 5, name: '5', paragraphs: 9, reading: ENOCH_CHAPTER_5_READING },
]

export const ENOCH_MANIFEST: ModuleManifest = {
  id: ENOCH_MODULE_ID,
  name: '1 Enoch',
  language: 'English',
  license: 'Public domain',
  source: '',
  sourceChecksum: '',
  formatVersion: 8,
  kind: 'book',
  capabilities: { strongsTagged: false },
  book: {
    number: ENOCH_BOOK,
    editionCode: '1EN-C1912',
    author: 'Enoch',
    year: 1912,
    abbreviation: '1En',
    atom: 'verse',
    sections: ENOCH_SECTIONS.map((section) => ({ ...section })),
  },
}

// Chapter 4's one prose verse and chapter 5 in full; the other chapters keep
// their grids only, for the specs that never fetch their text.
export const ENOCH_CONTENT: BookContent = {
  [makeVerseId(ENOCH_BOOK, 4, 1)]: {
    text: 'And ye shall find no peace.',
  },
  ...Object.fromEntries(
    Object.entries(ENOCH_CHAPTER_5).map(([verse, atom]) => [
      makeVerseId(ENOCH_BOOK, 5, Number(verse)),
      atom,
    ]),
  ),
}

export const enochPassageStore = () => ({
  manifest: async (moduleId: string) =>
    moduleId === ENOCH_MODULE_ID ? ENOCH_MANIFEST : null,
  bookContent: async (moduleId: string, book: number) =>
    moduleId === ENOCH_MODULE_ID && book === ENOCH_BOOK ? ENOCH_CONTENT : null,
})

export const installEnochBook = (): void => {
  registerBookVersification({ book: ENOCH_BOOK, sections: ENOCH_SECTIONS })
  registerBook({
    id: ENOCH_BOOK,
    name: '1 Enoch',
    abbrev: '1En',
    aliases: ['First Enoch', 'Book of Enoch', 'Ethiopic Enoch'],
    moduleId: ENOCH_MODULE_ID,
    editionCode: '1EN-C1912',
    author: 'Enoch',
    year: 1912,
    atom: 'verse',
    sections: ENOCH_SECTIONS,
  })
}

export const uninstallEnochBook = (): void => {
  deregisterBookVersification(ENOCH_BOOK)
  deregisterBook(ENOCH_BOOK)
}
