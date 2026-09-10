import { describe, expect, it } from 'vitest'
import { uniqueNotePath } from './unique-note-path'

describe('uniqueNotePath', () => {
  it('places the markdown note in the folder when the name is free', () => {
    expect(uniqueNotePath('Notes', 'John 15.4', () => false)).toBe(
      'Notes/John 15.4.md',
    )
  })

  it('suffixes colliding names with 1, 2, …', () => {
    const taken = new Set(['Notes/John 15.4.md', 'Notes/John 15.4 1.md'])

    expect(uniqueNotePath('Notes', 'John 15.4', (path) => taken.has(path))).toBe(
      'Notes/John 15.4 2.md',
    )
  })
})
