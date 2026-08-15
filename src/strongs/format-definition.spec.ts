import { describe, expect, it } from 'vitest'
import { formatDefinition } from './format-definition'

describe('formatDefinition', () => {
  it('turns br tags of any casing into line breaks', () => {
    expect(
      formatDefinition('1) father<br>2) of God<BR>3) ancestor<BR />4) head'),
    ).toBe('1) father\n2) of God\n3) ancestor\n4) head')
  })

  it('keeps the inner text of formatting and reference markup', () => {
    expect(
      formatDefinition(
        "<b>Ἀαρών</b> (Heb. אַהֲרוֹן), indecl., <b>Aaron</b>: <ref='Luk.1.5'>Luk.1:5</ref>.† <BR /> (AS)",
      ),
    ).toBe('Ἀαρών (Heb. אַהֲרוֹן), indecl., Aaron: Luk.1:5.†\n(AS)')
  })

  it('collapses runs of blank lines and surrounding whitespace', () => {
    expect(formatDefinition('first<br> <br>second  <br>')).toBe('first\nsecond')
  })
})
