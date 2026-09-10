import { describe, expect, it } from 'vitest'
import { ref } from '../../tests/fixtures/reference'
import { rewriteCrossReferenceNote } from './rewrite-cross-reference-note'

const vine = [ref('John 15:1-8'), ref('Psalm 80:8-16')]

describe('rewriteCrossReferenceNote', () => {
  it('rewrites only the refs block and the summary key, byte-identical elsewhere', () => {
    const note =
      '---\ntags: study\ntype: cross-reference\nrefs:\n  - John 15:1-8\ncreated: 2026-09-10\nsummary: Old\naliases:\n  - Vine\n---\n\n## Why\n\nThe vine is Israel.  \n'

    expect(rewriteCrossReferenceNote(note, vine, 'Vine imagery')).toBe(
      '---\ntags: study\ntype: cross-reference\nrefs:\n  - John 15:1-8\n  - Psalms 80:8-16\ncreated: 2026-09-10\nsummary: Vine imagery\naliases:\n  - Vine\n---\n\n## Why\n\nThe vine is Israel.  \n',
    )
  })

  it('writes an empty summary as an empty string', () => {
    const note = '---\ntype: cross-reference\nrefs:\n  - John 15:1-8\nsummary: Old\n---\n'

    expect(rewriteCrossReferenceNote(note, vine, null)).toBe(
      '---\ntype: cross-reference\nrefs:\n  - John 15:1-8\n  - Psalms 80:8-16\nsummary: ""\n---\n',
    )
  })

  it('keeps an unparseable member verbatim at its place in the list', () => {
    const note =
      '---\ntype: cross-reference\nrefs:\n  - Jonh 15:1-8\n  - Psalm 80:8-16\nsummary: Vine\n---\n'

    expect(
      rewriteCrossReferenceNote(note, [ref('Psalm 80:8-16'), ref('Romans 11:17')], 'Vine'),
    ).toBe(
      '---\ntype: cross-reference\nrefs:\n  - Jonh 15:1-8\n  - Psalms 80:8-16\n  - Romans 11:17\nsummary: Vine\n---\n',
    )
  })

  it('keeps an unparseable member that fell beyond the new list at the end', () => {
    const note =
      '---\ntype: cross-reference\nrefs:\n  - John 15:1-8\n  - Psalm 80:8-16\n  - Jonh 3:16\nsummary: Vine\n---\n'

    expect(rewriteCrossReferenceNote(note, [ref('John 15:1-8')], 'Vine')).toBe(
      '---\ntype: cross-reference\nrefs:\n  - John 15:1-8\n  - Jonh 3:16\nsummary: Vine\n---\n',
    )
  })

  it('replaces a hand-typed flow list and unindented block list alike', () => {
    const flow = '---\ntype: cross-reference\nrefs: [John 15:1, Psalm 80:8]\nsummary: Vine\n---\nBody\n'
    const block = '---\ntype: cross-reference\nrefs:\n- John 15:1\n- Psalm 80:8\nsummary: Vine\n---\nBody\n'
    const expected =
      '---\ntype: cross-reference\nrefs:\n  - John 15:1-8\n  - Psalms 80:8-16\nsummary: Vine\n---\nBody\n'

    expect(rewriteCrossReferenceNote(flow, vine, 'Vine')).toBe(expected)
    expect(rewriteCrossReferenceNote(block, vine, 'Vine')).toBe(expected)
  })

  it('adds the keys a note lacks before the closing fence', () => {
    const note = '---\ntype: cross-reference\n---\nBody\n'

    expect(rewriteCrossReferenceNote(note, vine, null)).toBe(
      '---\ntype: cross-reference\nrefs:\n  - John 15:1-8\n  - Psalms 80:8-16\nsummary: ""\n---\nBody\n',
    )
  })

  it('quotes a summary YAML would misread', () => {
    const note = '---\ntype: cross-reference\nrefs:\n  - John 15:1\nsummary: Old\n---\n'

    expect(rewriteCrossReferenceNote(note, vine, 'Vine: Israel')).toContain(
      'summary: "Vine: Israel"\n',
    )
  })
})
