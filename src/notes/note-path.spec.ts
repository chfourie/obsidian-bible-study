import { describe, expect, it } from 'vitest'
import { joinNotePath, splitNotePath } from './note-path'

describe('splitNotePath', () => {
  it('parts the folder from the name without its extension', () => {
    expect(splitNotePath('Study/Vine.md')).toEqual({ folder: 'Study', basename: 'Vine' })
  })

  it('gives an empty folder at the vault root', () => {
    expect(splitNotePath('Vine.md')).toEqual({ folder: '', basename: 'Vine' })
  })

  it('keeps a name that carries no markdown extension', () => {
    expect(splitNotePath('Study/Vine')).toEqual({ folder: 'Study', basename: 'Vine' })
  })
})

describe('joinNotePath', () => {
  it('puts the note in its folder', () => {
    expect(joinNotePath('Study', 'Vine')).toBe('Study/Vine.md')
  })

  it('leaves no leading slash at the vault root', () => {
    expect(joinNotePath('', 'Vine')).toBe('Vine.md')
  })
})
