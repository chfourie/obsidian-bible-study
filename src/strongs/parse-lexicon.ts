import { strongsFamily } from '../modules'

export type StrongsEntry = {
  // The Strong's Family this entry disambiguates — the number tagged
  // translations carry.
  family: string
  // The extended number this entry actually is: STEPBible's dStrong, which
  // adds a disambiguating letter where one base number covers several words.
  extendedNumber: string
  lemma: string
  transliteration: string
  // STEPBible's morphology code for the entry, e.g. 'H:N-M'.
  morphology: string
  gloss: string
  definition: string
}

// The lexicon as the dictionaries store it: entries at extended-number
// granularity, and the families that gather their siblings.
export type ParsedLexicon = {
  entries: Map<string, StrongsEntry>
  families: Map<string, string[]>
}

const ENTRY_NUMBER = /^[HG]\d{4}[A-Za-z]?$/

const COLUMN = {
  family: 0,
  dStrong: 1,
  lemma: 3,
  transliteration: 4,
  morphology: 5,
  gloss: 6,
  definition: 7,
} as const

// The family column occasionally carries the letter itself ('H0834a'), so
// the Strong's Family is always taken without it.
// The dStrong column leads with the extended number and trails the relation
// that motivated it ('H0001H = a Part of').
const extendedNumberOf = (cell: string, family: string): string => {
  const candidate = cell.split('=')[0].trim()
  return ENTRY_NUMBER.test(candidate) ? candidate : family
}

export const parseLexicon = (text: string): ParsedLexicon => {
  const entries = new Map<string, StrongsEntry>()
  const families = new Map<string, string[]>()
  for (const line of text.replace(/^\uFEFF/, '').split(/\r?\n/)) {
    const row = line.split('\t')
    const familyCell = row[COLUMN.family]?.trim() ?? ''
    if (!ENTRY_NUMBER.test(familyCell)) continue
    if (row.length <= COLUMN.definition) continue
    const extendedNumber = extendedNumberOf(row[COLUMN.dStrong] ?? '', familyCell)
    const family = strongsFamily(familyCell)
    if (entries.has(extendedNumber)) continue
    entries.set(extendedNumber, {
      family,
      extendedNumber,
      lemma: row[COLUMN.lemma].trim().normalize('NFC'),
      transliteration: row[COLUMN.transliteration].trim().normalize('NFC'),
      morphology: row[COLUMN.morphology].trim(),
      gloss: row[COLUMN.gloss].trim(),
      definition: row[COLUMN.definition].trim(),
    })
    families.set(family, [...(families.get(family) ?? []), extendedNumber])
  }
  return { entries, families }
}
