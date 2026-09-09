import {
  deregisterBook,
  deregisterBookVersification,
  registerBook,
  registerBookVersification,
  type BookSectionLabel,
} from '../../src/reference'

// The first verse-atom Book (spec-books §1), trimmed to the three chapters
// the specs address. Charles titled none of these, so each section is named
// by its printed chapter number and none is `named`. Chapter 1 is deeper
// than the print's nine verses so the §4 locator table's `1:9-11` has a grid
// to land on.
export const ENOCH_BOOK = 103

type Section = BookSectionLabel & { paragraphs: number }

export const ENOCH_SECTIONS: readonly Section[] = [
  { chapter: 1, name: '1', paragraphs: 11 },
  { chapter: 2, name: '2', paragraphs: 5 },
  { chapter: 3, name: '3', paragraphs: 3 },
]

export const installEnochBook = (): void => {
  registerBookVersification({ book: ENOCH_BOOK, sections: ENOCH_SECTIONS })
  registerBook({
    id: ENOCH_BOOK,
    name: '1 Enoch',
    abbrev: '1En',
    aliases: ['First Enoch', 'Book of Enoch', 'Ethiopic Enoch'],
    moduleId: '1en-c1912',
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
