export type StrongsEntry = {
  strongs: string
  lemma: string
  transliteration: string
  gloss: string
  definition: string
}

const ENTRY_NUMBER = /^[HG]\d{4}[A-Za-z]?$/

const COLUMN = {
  eStrong: 0,
  lemma: 3,
  transliteration: 4,
  gloss: 6,
  definition: 7,
} as const

export const parseLexicon = (text: string): Map<string, StrongsEntry> => {
  const entries = new Map<string, StrongsEntry>()
  for (const line of text.replace(/^\uFEFF/, '').split(/\r?\n/)) {
    const row = line.split('\t')
    const strongs = row[COLUMN.eStrong]?.trim() ?? ''
    if (!ENTRY_NUMBER.test(strongs)) continue
    if (row.length <= COLUMN.definition || entries.has(strongs)) continue
    entries.set(strongs, {
      strongs,
      lemma: row[COLUMN.lemma].trim().normalize('NFC'),
      transliteration: row[COLUMN.transliteration].trim().normalize('NFC'),
      gloss: row[COLUMN.gloss].trim(),
      definition: row[COLUMN.definition].trim(),
    })
  }
  return entries
}
