import { bookAtomKind, type BookAtomKind } from '../reference'
import {
  perDeviceDefault,
  type ReaderDevice,
  type ScriptureStudySettings,
} from './scripture-study-settings.type'

// The Book's atom-numbers option: whether the margin gutter keeps its atom
// numbers on or surfaces them on hover. On/Hover only — no Off, and
// scripture's verse numbers are never toggled at all (spec-books §5).
export type AtomNumbers = 'on' | 'hover'

// A verse-atom Book reads scripture-like, a paragraph Book stays quiet, so
// the wording and the factory value both follow the Book's atom kind.
export const ATOM_NUMBERS_FACTORY: Record<BookAtomKind, AtomNumbers> = {
  verse: 'on',
  paragraph: 'hover',
}

export const ATOM_NUMBERS_LABEL: Record<BookAtomKind, string> = {
  verse: 'Verse numbers',
  paragraph: 'Para numbers',
}

export type AtomNumbersBook = { moduleId: string; atom?: BookAtomKind }

// A Book the settings never wrote reads its kind's factory value, so a Book
// installed after the migration never inherits another Book's choice.
export const atomNumbersOf = (
  settings: Pick<ScriptureStudySettings, 'bookAtomNumbers'>,
  book: AtomNumbersBook,
  device: ReaderDevice,
): AtomNumbers =>
  settings.bookAtomNumbers[book.moduleId]?.[device] ??
  ATOM_NUMBERS_FACTORY[bookAtomKind(book)]

// Writing one device slot leaves the other on the value it already had —
// the Book's factory where nothing was ever written.
export const withAtomNumbers = (
  settings: ScriptureStudySettings,
  book: AtomNumbersBook,
  device: ReaderDevice,
  value: AtomNumbers,
): ScriptureStudySettings => ({
  ...settings,
  bookAtomNumbers: {
    ...settings.bookAtomNumbers,
    [book.moduleId]: {
      ...(settings.bookAtomNumbers[book.moduleId] ??
        perDeviceDefault(ATOM_NUMBERS_FACTORY[bookAtomKind(book)])),
      [device]: value,
    },
  },
})
