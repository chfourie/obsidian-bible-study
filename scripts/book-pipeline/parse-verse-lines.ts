// The verse-line parser a verse-atom Book's source goes through (spec-books
// §11, ADR 0011, ADR 0013). A body line is a verse-line — `N.` or `Na.` in
// the edition's page order — or a wrap onto the verse-line before it. The
// atom is the printed verse: its lines are stored in letter order whatever
// their place on the page, and the page walk survives as the section's
// `reading` only where it is not that identity.

import type { ReadingStep } from '../../src/modules/module-manifest'
import type { VerseLine } from '../../src/modules/verse-content'

// One metrical line (or a prose verse) as the source has it, with the source
// line it stands on so a build failure can cite it.
export type VerseSourceLine = {
  atom: number
  letter?: string
  text: string
  paragraph?: true
  line: number
}

export type VerseAtom = {
  text: string
  lines?: VerseLine[]
}

const VERSE_LINE = /^(\d+)([a-z])?\.\s+(\S.*)$/
const PREFIX_SHAPED = /^\d+[A-Za-z]*\.?(\s|$)/
const LIST_OR_TABLE = /^(?:[-*•]|\|)(\s|$)/

const fail = (line: number, message: string): never => {
  throw new Error(`line ${line}: ${message}`)
}

// Reads one blank-line-delimited block: the first verse-line opens a stanza
// or paragraph, so it carries `paragraph`; an unprefixed line is a page-wrap
// and joins the verse-line before it.
export const readVerseBlock = (
  block: string,
  firstLine: number,
): VerseSourceLine[] => {
  const read: VerseSourceLine[] = []
  block.split('\n').forEach((raw, index) => {
    const line = firstLine + index
    const text = raw.trim()
    if (LIST_OR_TABLE.test(text))
      fail(line, `a list or table cannot stand in a verse-atom section: "${text}"`)
    const verse = VERSE_LINE.exec(text)
    if (verse !== null) {
      const [, atom, letter, body] = verse
      read.push({
        atom: Number(atom),
        ...(letter === undefined ? {} : { letter }),
        text: body.trim(),
        ...(read.length === 0 ? { paragraph: true as const } : {}),
        line,
      })
      return
    }
    if (PREFIX_SHAPED.test(text)) {
      const shape = /^\d+[a-z]?\.\s*$/.test(text)
        ? 'carries no text'
        : 'is malformed — a verse-line reads `N.` or `Na.`'
      fail(line, `the verse prefix of "${text}" ${shape}`)
    }
    const previous = read[read.length - 1]
    if (previous === undefined)
      fail(line, `"${text}" has no verse prefix and no verse-line to wrap onto`)
    previous.text = `${previous.text} ${text}`
  })
  return read
}

type AtomLines = { atom: number; lines: VerseSourceLine[] }

const groupByAtom = (lines: VerseSourceLine[]): AtomLines[] => {
  const groups = new Map<number, AtomLines>()
  for (const line of lines) {
    const group = groups.get(line.atom) ?? { atom: line.atom, lines: [] }
    const seen = group.lines
    if (line.letter !== undefined) {
      if (seen.some((other) => other.letter === line.letter))
        fail(
          line.line,
          `letter "${line.letter}" is repeated within verse ${line.atom}`,
        )
    } else if (seen.some((other) => other.letter !== undefined)) {
      fail(
        line.line,
        `an unlettered line stands after the lettered lines of verse ${line.atom}`,
      )
    }
    group.lines.push(line)
    groups.set(line.atom, group)
  }
  return [...groups.values()].sort((a, b) => a.atom - b.atom)
}

const assertNoHoles = (
  groups: AtomLines[],
  lines: VerseSourceLine[],
): void => {
  groups.forEach((group, index) => {
    const expected = index + 1
    if (group.atom === expected) return
    const after = lines.find((line) => line.atom > expected) ?? lines[0]
    fail(
      after.line,
      `verse ${after.atom} follows without verse ${expected} — the section's ` +
        `verses must run 1..N`,
    )
  })
}

// Letter order: the unlettered lead-in first (only ever before the letters
// of its atom), then the letters in alphabetical order.
const letterOrder = (lines: VerseSourceLine[]): VerseSourceLine[] =>
  [...lines].sort((a, b) =>
    a.letter === undefined || b.letter === undefined
      ? Number(a.letter !== undefined) - Number(b.letter !== undefined)
      : a.letter.localeCompare(b.letter),
  )

const atomOf = (ordered: VerseSourceLine[]): VerseAtom => {
  const text = ordered.map((line) => line.text).join(' ')
  const isProse = ordered.length === 1 && ordered[0].letter === undefined
  if (isProse) return { text }
  const lines: VerseLine[] = []
  let start = 0
  for (const line of ordered) {
    lines.push({
      start,
      ...(line.paragraph === true ? { paragraph: true } : {}),
      ...(line.letter === undefined ? {} : { letter: line.letter }),
    })
    start += line.text.length + 1
  }
  return { text, lines }
}

const isIdentityWalk = (
  reading: ReadingStep[],
  atoms: VerseAtom[],
): boolean => {
  const identity: ReadingStep[] = atoms.flatMap((atom, index) =>
    atom.lines === undefined
      ? [{ atom: index + 1 }]
      : atom.lines.map((_line, line) => ({ atom: index + 1, line })),
  )
  return (
    identity.length === reading.length &&
    identity.every(
      (step, index) =>
        step.atom === reading[index].atom && step.line === reading[index].line,
    )
  )
}

export type VerseSectionContent = {
  atoms: VerseAtom[]
  reading?: ReadingStep[]
}

export const verseSectionAtoms = (
  chapter: number,
  lines: VerseSourceLine[],
): VerseSectionContent => {
  const groups = groupByAtom(lines)
  assertNoHoles(groups, lines)
  const ordered = groups.map((group) => letterOrder(group.lines))
  const atoms = ordered.map(atomOf)
  const stepOf = new Map<VerseSourceLine, ReadingStep>()
  ordered.forEach((atomLines, index) => {
    const whole = atoms[index].lines === undefined
    atomLines.forEach((line, position) => {
      stepOf.set(line, whole ? { atom: index + 1 } : { atom: index + 1, line: position })
    })
  })
  const reading = lines.map((line) => stepOf.get(line) as ReadingStep)
  if (isIdentityWalk(reading, atoms)) return { atoms }
  assertReadingWalk(chapter, reading, atoms)
  return { atoms, reading }
}

// The build checks ADR 0013 asks of a present `reading`: the whole section
// walked, every line of a lined atom exactly once, every prose atom exactly
// once as a whole, nothing out of range and nothing twice.
export const assertReadingWalk = (
  chapter: number,
  reading: readonly ReadingStep[],
  atoms: readonly { lines?: readonly VerseLine[] }[],
): void => {
  const failSection = (message: string): never => {
    throw new Error(`section ${chapter}: reading ${message}`)
  }
  const walked = new Set<string>()
  for (const { atom, line } of reading) {
    const target = atoms[atom - 1]
    if (target === undefined) failSection(`walks atom ${atom}, which the section does not have`)
    const key = `${atom}:${line ?? ''}`
    if (walked.has(key))
      failSection(
        line === undefined
          ? `walks atom ${atom} twice`
          : `walks atom ${atom} line ${line} twice`,
      )
    walked.add(key)
    if (target.lines === undefined) {
      if (line !== undefined)
        failSection(`walks atom ${atom} by line, but it carries no lines`)
    } else if (line === undefined) {
      failSection(`walks atom ${atom} whole, but it carries lines`)
    } else if (line < 0 || line >= target.lines.length) {
      failSection(
        `walks atom ${atom} line ${line}, which it does not have`,
      )
    }
  }
  atoms.forEach((target, index) => {
    const atom = index + 1
    if (target.lines === undefined) {
      if (!walked.has(`${atom}:`)) failSection(`never walks atom ${atom}`)
      return
    }
    target.lines.forEach((_line, line) => {
      if (!walked.has(`${atom}:${line}`))
        failSection(`never walks atom ${atom} line ${line}`)
    })
  })
}
