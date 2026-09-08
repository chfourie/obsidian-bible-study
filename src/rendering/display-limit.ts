import { countReferenceVerses, type Reference } from '../reference'

export const DISPLAY_VERSE_LIMIT = 180

export const TOO_LONG_TO_DISPLAY = 'Reference too long to display'

export const exceedsDisplayVerseLimit = (reference: Reference): boolean =>
  countReferenceVerses(reference) > DISPLAY_VERSE_LIMIT
