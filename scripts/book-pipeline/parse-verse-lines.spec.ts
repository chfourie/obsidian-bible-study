import { describe, expect, it } from 'vitest'
import {
  assertReadingWalk,
  readVerseBlock,
  verseSectionAtoms,
} from './parse-verse-lines'

const linesOf = (...blocks: string[][]) => {
  let line = 1
  return blocks.flatMap((block) => {
    const read = readVerseBlock(block.join('\n'), line)
    line += block.length + 1
    return read
  })
}

const atomsOf = (...blocks: string[][]) =>
  verseSectionAtoms(1, linesOf(...blocks))

describe('readVerseBlock', () => {
  it('joins an unprefixed wrap onto the verse-line before it with a space', () => {
    expect(
      readVerseBlock('1. The words of the blessing\nof Enoch.\n2. And he said', 7),
    ).toEqual([
      { atom: 1, text: 'The words of the blessing of Enoch.', paragraph: true, line: 7 },
      { atom: 2, text: 'And he said', line: 9 },
    ])
  })

  it('strips the letter of a lettered prefix onto the line', () => {
    expect(readVerseBlock('6a. In those days\n6b. And by you', 1)).toEqual([
      { atom: 6, letter: 'a', text: 'In those days', paragraph: true, line: 1 },
      { atom: 6, letter: 'b', text: 'And by you', line: 2 },
    ])
  })

  it('reads `1.` as verse 1, never as a numbered list', () => {
    expect(readVerseBlock('1. Observe ye every thing', 1)[0]).toMatchObject({
      atom: 1,
      text: 'Observe ye every thing',
    })
  })

  it('fails, citing the line, on a block that opens with no prefix', () => {
    expect(() => readVerseBlock('stray prose\n2. And he said', 12)).toThrow(
      /line 12: .*no verse prefix/i,
    )
  })

  it.each(['6A. Upper', '6aa. Double', '6a Missing dot'])(
    'fails, citing the line, on the malformed prefix `%s`',
    (line) => {
      expect(() => readVerseBlock(`1. Fine\n${line}`, 30)).toThrow(/line 31/)
    },
  )

  it('fails, citing the line, on a prefix with no text after it', () => {
    expect(() => readVerseBlock('1. Fine\n2.', 30)).toThrow(/line 31: .*no text/i)
    expect(() => readVerseBlock('1. Fine\n2.   ', 30)).toThrow(/line 31: .*no text/i)
  })

  it.each(['- an item', '* an item', '• an item', '| a | b', '| --- | ---'])(
    'fails, citing the line, on the list or table row `%s`',
    (line) => {
      expect(() => readVerseBlock(`1. Fine\n${line}`, 5)).toThrow(
        /line 6: .*list or table/i,
      )
    },
  )
})

describe('verseSectionAtoms', () => {
  it('stores a prose verse as its joined text with no lines', () => {
    const { atoms } = atomsOf(['1. The words of the\nblessing of Enoch.'])
    expect(atoms).toEqual([{ text: 'The words of the blessing of Enoch.' }])
  })

  it('stores a lettered poem one line per prefix, the letter on the line', () => {
    const { atoms } = atomsOf(['1a. In those days', '1b. And by you'])
    expect(atoms[0].text).toBe('In those days And by you')
    expect(atoms[0].lines).toEqual([
      { start: 0, paragraph: true, letter: 'a' },
      { start: 'In those days '.length, letter: 'b' },
    ])
  })

  it('stores an unlettered poem one line per repeated prefix, no letters', () => {
    const { atoms } = atomsOf([
      '1. But ye—ye have not been steadfast,',
      '1. But ye have turned away',
      '1. Oh, ye hard-hearted.',
    ])
    expect(atoms[0].lines).toEqual([
      { start: 0, paragraph: true },
      { start: 'But ye—ye have not been steadfast, '.length },
      { start: 'But ye—ye have not been steadfast, But ye have turned away '.length },
    ])
    expect(atoms[0].lines?.every((line) => line.letter === undefined)).toBe(true)
  })

  it('keeps a mixed verse’s prose lead-in as line 0 before its lettered lines', () => {
    const { atoms } = atomsOf([
      '1. Concerning the elect I said:',
      '1a. The Holy Great One will come forth,',
      '1b. And the eternal God will tread upon the earth.',
    ])
    expect(atoms[0].lines?.map((line) => line.letter)).toEqual([undefined, 'a', 'b'])
    expect(atoms[0].lines?.[0].start).toBe(0)
  })

  it('sets paragraph on the verse-line after a blank line, inside and between atoms', () => {
    const { atoms } = atomsOf(
      ['1. But with the righteous He will make peace,', '1. And will protect the elect,'],
      ['1. And they shall all belong to God,', '1. And they shall be prospered.'],
      ['2. And behold! He cometh'],
      ['2. And to convict all flesh'],
    )
    expect(atoms[0].lines?.map((line) => line.paragraph)).toEqual([
      true,
      undefined,
      true,
      undefined,
    ])
    expect(atoms[1].lines?.map((line) => line.paragraph)).toEqual([true, true])
  })

  it('leaves a prose verse after a blank line without a line channel', () => {
    const { atoms } = atomsOf(['1. First prose.'], ['2. Second prose.'])
    expect(atoms[1]).toEqual({ text: 'Second prose.' })
  })

  it('emits no reading when the page order is the identity walk', () => {
    const { reading } = atomsOf(
      ['1. Prose verse.'],
      ['2a. First line', '2b. Second line'],
      ['3. Unlettered', '3. poem'],
    )
    expect(reading).toBeUndefined()
  })

  it('stores `7c.` inside verse 6 in letter order and emits the page walk as reading', () => {
    const { atoms, reading } = atomsOf(
      ['1. Prose verse.', '2. Prose verse.', '3. Prose verse.'],
      ['4. Prose verse.', '5. Prose verse.'],
      ['6a. In those days', '6b. And by you', '6c. And all', '7c. And for you'],
      ['6d. And all the', '6e. And there', '7a. But for the elect', '7b. And they'],
    )
    expect(atoms).toHaveLength(7)
    expect(atoms[5].text).toBe('In those days And by you And all And all the And there')
    expect(atoms[5].lines?.map((line) => line.letter)).toEqual(['a', 'b', 'c', 'd', 'e'])
    expect(atoms[5].lines?.map((line) => line.paragraph)).toEqual([
      true,
      undefined,
      undefined,
      true,
      undefined,
    ])
    expect(atoms[6].text).toBe('But for the elect And they And for you')
    expect(atoms[6].lines?.map((line) => line.letter)).toEqual(['a', 'b', 'c'])
    expect(reading).toEqual([
      { atom: 1 },
      { atom: 2 },
      { atom: 3 },
      { atom: 4 },
      { atom: 5 },
      { atom: 6, line: 0 },
      { atom: 6, line: 1 },
      { atom: 6, line: 2 },
      { atom: 7, line: 2 },
      { atom: 6, line: 3 },
      { atom: 6, line: 4 },
      { atom: 7, line: 0 },
      { atom: 7, line: 1 },
    ])
  })

  it('never invents a missing letter: `6a`, `6c` with no `6b` stays two lines', () => {
    const { atoms } = atomsOf(['1a. First', '1c. Third'])
    expect(atoms[0].lines?.map((line) => line.letter)).toEqual(['a', 'c'])
  })

  it('fails, citing the line, on a duplicate letter within an atom', () => {
    expect(() => atomsOf(['1a. First', '1a. Again'])).toThrow(
      /line 2: .*letter "a".*verse 1/i,
    )
  })

  it('fails, citing the line, on an unlettered line after a lettered one', () => {
    expect(() => atomsOf(['1a. First', '1. Unlettered'])).toThrow(
      /line 2: .*unlettered.*after.*lettered/i,
    )
  })

  it('fails, citing the line, on a hole in the section’s verses', () => {
    expect(() => atomsOf(['1. First', '2. Second'], ['4. Fourth'])).toThrow(
      /line 4: .*verse 3/i,
    )
  })

  it('fails, citing the line, when the section does not start at verse 1', () => {
    expect(() => atomsOf(['2. Second'])).toThrow(/line 1: .*verse 1/i)
  })
})

describe('verseSectionAtoms filler verses between a jump', () => {
  it('allows a later verse’s line inside an earlier verse even across a hole it later fills', () => {
    const { reading } = atomsOf(['1a. One', '2a. Two', '1b. One again', '2b. Two again'])
    expect(reading).toEqual([
      { atom: 1, line: 0 },
      { atom: 2, line: 0 },
      { atom: 1, line: 1 },
      { atom: 2, line: 1 },
    ])
  })
})

describe('assertReadingWalk', () => {
  const atoms = [{ lines: [{ start: 0 }, { start: 5 }] }, {}]
  const walk = (reading: { atom: number; line?: number }[]) => () =>
    assertReadingWalk(5, reading, atoms)

  it('accepts a full walk over every atom and line', () => {
    expect(walk([{ atom: 1, line: 0 }, { atom: 2 }, { atom: 1, line: 1 }])).not.toThrow()
  })

  it('fails, citing the section, when an atom never appears', () => {
    expect(walk([{ atom: 1, line: 0 }, { atom: 1, line: 1 }])).toThrow(
      /section 5: .*atom 2/i,
    )
  })

  it('fails, citing the section, on a whole-atom step for an atom with lines', () => {
    expect(walk([{ atom: 1 }, { atom: 2 }])).toThrow(/section 5: .*atom 1/i)
  })

  it('fails, citing the section, when a line of an atom is walked twice', () => {
    expect(
      walk([{ atom: 1, line: 0 }, { atom: 1, line: 0 }, { atom: 1, line: 1 }, { atom: 2 }]),
    ).toThrow(/section 5: .*atom 1.*line 0/i)
  })

  it('fails, citing the section, when a line of an atom is never walked', () => {
    expect(walk([{ atom: 1, line: 0 }, { atom: 2 }])).toThrow(
      /section 5: .*atom 1.*line 1/i,
    )
  })

  it('fails, citing the section, on a line out of range', () => {
    expect(
      walk([{ atom: 1, line: 0 }, { atom: 1, line: 1 }, { atom: 1, line: 2 }, { atom: 2 }]),
    ).toThrow(/section 5: .*atom 1.*line 2/i)
  })

  it('fails, citing the section, on a line step into a prose atom', () => {
    expect(walk([{ atom: 1, line: 0 }, { atom: 1, line: 1 }, { atom: 2, line: 0 }])).toThrow(
      /section 5: .*atom 2/i,
    )
  })

  it('fails, citing the section, when a prose atom is walked twice', () => {
    expect(
      walk([{ atom: 1, line: 0 }, { atom: 1, line: 1 }, { atom: 2 }, { atom: 2 }]),
    ).toThrow(/section 5: .*atom 2/i)
  })

  it('fails, citing the section, on an atom the section does not have', () => {
    expect(walk([{ atom: 1, line: 0 }, { atom: 1, line: 1 }, { atom: 2 }, { atom: 3 }])).toThrow(
      /section 5: .*atom 3/i,
    )
  })
})
