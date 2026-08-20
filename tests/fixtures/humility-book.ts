import {
  deregisterBook,
  deregisterBookVersification,
  registerBook,
  registerBookVersification,
  type BookSectionLabel,
} from '../../src/reference'

// The first non-biblical book (spec-books §1), trimmed to the sections the
// specs address: the unnumbered Preface, two numbered chapters, and a
// closing Prayer whose name replaces its chapter locator.
export const HUMILITY_BOOK = 101

type Section = BookSectionLabel & { paragraphs: number }

export const HUMILITY_SECTIONS: readonly Section[] = [
  { chapter: 0, name: 'Preface', named: true, paragraphs: 4 },
  { chapter: 1, name: 'The Glory of the Creature', paragraphs: 9 },
  { chapter: 2, name: 'The Secret of Redemption', paragraphs: 6 },
  { chapter: 3, name: 'A Prayer for Humility', named: true, paragraphs: 3 },
]

export const installHumilityBook = (): void => {
  registerBookVersification({
    book: HUMILITY_BOOK,
    sections: HUMILITY_SECTIONS,
  })
  registerBook({
    id: HUMILITY_BOOK,
    name: 'Humility',
    abbrev: 'Hum',
    aliases: [],
    moduleId: 'hum-m1895',
    editionCode: 'HUM-M1895',
    author: 'Andrew Murray',
    year: 1895,
    sections: HUMILITY_SECTIONS,
  })
}

export const uninstallHumilityBook = (): void => {
  deregisterBookVersification(HUMILITY_BOOK)
  deregisterBook(HUMILITY_BOOK)
}
