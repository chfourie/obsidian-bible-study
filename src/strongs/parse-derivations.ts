// Strong's 1890 etymology, read from the two public-domain sources that carry
// it: openscriptures/HebrewLexicon's HebrewStrong.xml (CC BY 4.0) and the XML
// edition of Strong's Greek dictionary in openscriptures/strongs. Both name
// the numbers a word derives from; both are rewritten here into one plain
// sentence whose citations read as extended Strong's numbers, so the panel
// needs to know nothing about either markup.

const ENTITIES: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
}

const decodeEntities = (text: string): string =>
  text
    .replace(/&#(\d+);/g, (_, code: string) => String.fromCodePoint(Number(code)))
    .replace(/&#x([0-9a-fA-F]+);/g, (_, code: string) =>
      String.fromCodePoint(Number.parseInt(code, 16)),
    )
    .replace(/&([a-z]+);/g, (match, name: string) => ENTITIES[name] ?? match)

const extendedNumber = (language: 'H' | 'G', reference: string): string => {
  const parsed = /^(\d+)([A-Za-z]?)$/.exec(reference.trim())
  if (parsed === null) return ''
  const digits = parsed[1].replace(/^0+(?=\d)/, '')
  return `${language}${digits.padStart(4, '0')}${parsed[2].toUpperCase()}`
}

const tidy = (text: string): string =>
  decodeEntities(text.replace(/<[^>]*>/g, '')).replace(/\s+/g, ' ').trim()

// HebrewStrong.xml keys its entries by an id that carries its own language
// prefix, and a handful of them are Greek.
const HEBREW_XML_ENTRY = /<entry\b[^>]*\bid="([HG])(\d+[A-Za-z]?)"[^>]*>([\s\S]*?)<\/entry>/g
const HEBREW_SOURCE = /<source>([\s\S]*?)<\/source>/
const HEBREW_CITATION = /<w\b[^>]*\bsrc="([^"]*)"[^>]*>[\s\S]*?<\/w>/g

// HebrewStrong.xml cites with <w src="H1">, sometimes naming several numbers
// in one attribute.
export const parseHebrewDerivations = (xml: string): Map<string, string> => {
  const derivations = new Map<string, string>()
  for (const [, language, reference, body] of xml.matchAll(HEBREW_XML_ENTRY)) {
    const source = HEBREW_SOURCE.exec(body)
    if (source === null) continue
    const cited = source[1].replace(HEBREW_CITATION, (_, references: string) =>
      references
        .trim()
        .split(/\s+/)
        .map((entry) => extendedNumber(entry.charAt(0) === 'G' ? 'G' : 'H', entry.slice(1)))
        .join(' '),
    )
    const derivation = tidy(cited)
    const number = extendedNumber(language === 'G' ? 'G' : 'H', reference)
    if (derivation !== '' && number !== '') derivations.set(number, derivation)
  }
  return derivations
}

const GREEK_ENTRY = /<entry\b[^>]*\bstrongs="(\d+)"[^>]*>([\s\S]*?)<\/entry>/g
const GREEK_DERIVATION = /<strongs_derivation>([\s\S]*?)<\/strongs_derivation>/
const GREEK_CITATION =
  /<strongsref\b[^>]*\blanguage="(HEBREW|GREEK)"[^>]*\bstrongs="(\d+)"[^>]*\/>/g

// strongsgreek.xml cites with a self-closing <strongsref/> that carries the
// language, so a Greek derivation may point at a Hebrew number.
export const parseGreekDerivations = (xml: string): Map<string, string> => {
  const derivations = new Map<string, string>()
  for (const [, reference, body] of xml.matchAll(GREEK_ENTRY)) {
    const source = GREEK_DERIVATION.exec(body)
    if (source === null) continue
    const cited = source[1].replace(
      GREEK_CITATION,
      (_, language: string, number: string) =>
        extendedNumber(language === 'HEBREW' ? 'H' : 'G', number),
    )
    const derivation = tidy(cited)
    const number = extendedNumber('G', reference)
    if (derivation !== '' && number !== '') derivations.set(number, derivation)
  }
  return derivations
}
