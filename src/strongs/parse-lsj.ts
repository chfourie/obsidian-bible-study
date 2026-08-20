// TFLSJ shares the column layout of the brief lexicons — the last column
// carrying the full Liddell-Scott-Jones entry instead of the brief definition.
// Only that entry is stored: everything else about the number the Strong's
// Dictionaries already carry.
const ENTRY_NUMBER = /^G\d{4,5}[A-Za-z]?$/

const COLUMN = { family: 0, dStrong: 1, meaning: 7 } as const

// The dStrong column leads with the extended number and trails the relation
// that motivated it ('G0001G = a Part of').
const extendedNumberOf = (cell: string, family: string): string => {
  const candidate = cell.split('=')[0].trim()
  return ENTRY_NUMBER.test(candidate) ? candidate : family
}

// Entries at extended-number granularity, with each family number answering
// with its first sub-entry — the granularity a tagged translation asks at.
export const parseLsjLexicon = (text: string): Map<string, string> => {
  const entries = new Map<string, string>()
  for (const line of text.replace(/^\uFEFF/, '').split(/\r?\n/)) {
    const row = line.split('\t')
    const family = row[COLUMN.family]?.trim() ?? ''
    if (!ENTRY_NUMBER.test(family)) continue
    if (row.length <= COLUMN.meaning) continue
    const meaning = row[COLUMN.meaning].trim()
    if (meaning === '') continue
    const extendedNumber = extendedNumberOf(row[COLUMN.dStrong] ?? '', family)
    if (entries.has(extendedNumber)) continue
    entries.set(extendedNumber, meaning)
    if (!entries.has(family)) entries.set(family, meaning)
  }
  return entries
}
