import { describe, expect, it } from 'vitest'
import { splitTemplate, withFrontmatterKeys } from './note-frontmatter'

describe('splitTemplate', () => {
  it('gives empty frontmatter and a blank body without a template', () => {
    expect(splitTemplate(null)).toEqual({ frontmatter: '---\n---\n', body: '\n' })
  })

  it('treats a frontmatter-less template as all body', () => {
    expect(splitTemplate('## Why\n')).toEqual({
      frontmatter: '---\n---\n',
      body: '## Why\n',
    })
  })

  it('splits a template at the end of its frontmatter', () => {
    expect(splitTemplate('---\ntags: study\n---\nBody\n')).toEqual({
      frontmatter: '---\ntags: study\n---\n',
      body: 'Body\n',
    })
  })
})

describe('withFrontmatterKeys', () => {
  it('appends keys the frontmatter lacks, in the order given', () => {
    expect(
      withFrontmatterKeys('---\ntags: study\n---\n', [
        ['type', ['type: note']],
        ['refs', ['refs:', '  - John 15:4']],
      ]),
    ).toBe('---\ntags: study\ntype: note\nrefs:\n  - John 15:4\n---\n')
  })

  it('replaces a key and its list items in place', () => {
    expect(
      withFrontmatterKeys('---\nrefs:\n  - Genesis 1:1\n  - Exodus 2:2\ntags: study\n---\n', [
        ['refs', ['refs:', '  - John 15:4']],
      ]),
    ).toBe('---\nrefs:\n  - John 15:4\ntags: study\n---\n')
  })

  it('replaces a block scalar with its continuation lines', () => {
    expect(
      withFrontmatterKeys('---\nsummary: >-\n  The vine\n  is Israel\ntags: study\n---\n', [
        ['summary', ['summary: Vine']],
      ]),
    ).toBe('---\nsummary: Vine\ntags: study\n---\n')
  })

  it('replaces list items along with the lines nested under them', () => {
    expect(
      withFrontmatterKeys(
        '---\nrefs:\n- John 15:1\n  # the vine\n- Psalm 80:8\n    grafted\ntags: study\n---\n',
        [['refs', ['refs:', '  - Romans 11:17']]],
      ),
    ).toBe('---\nrefs:\n  - Romans 11:17\ntags: study\n---\n')
  })

  it('leaves a blank line between the key and the next one', () => {
    expect(
      withFrontmatterKeys('---\nsummary: |\n  Vine\n\ntags: study\n---\n', [
        ['summary', ['summary: Israel']],
      ]),
    ).toBe('---\nsummary: Israel\n\ntags: study\n---\n')
  })

  it('leaves the frontmatter as it was without keys', () => {
    expect(withFrontmatterKeys('---\ntags: study\n---\n', [])).toBe(
      '---\ntags: study\n---\n',
    )
  })
})
