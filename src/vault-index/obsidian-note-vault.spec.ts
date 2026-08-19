import { describe, expect, it } from 'vitest'
import { TFile, TFolder, type Plugin, type TAbstractFile } from 'obsidian'
import { ObsidianNoteVault } from './obsidian-note-vault'

type RenameHandler = (file: TAbstractFile, oldPath: string) => void

const setup = () => {
  const renameHandlers: RenameHandler[] = []
  const plugin = {
    registerEvent: () => {},
    app: {
      vault: {
        on: (name: string, handler: RenameHandler) => {
          if (name === 'rename') renameHandlers.push(handler)
          return {}
        },
      },
    },
  } as unknown as Plugin
  const noteVault = new ObsidianNoteVault(plugin)
  const fireRename = (file: TAbstractFile, oldPath: string) =>
    renameHandlers.forEach((handler) => handler(file, oldPath))
  return { noteVault, fireRename }
}

const fileAt = (path: string, extension: string): TFile =>
  Object.assign(new TFile(), { path, extension })

const folderAt = (path: string): TFolder =>
  Object.assign(new TFolder(), { path })

describe('ObsidianNoteVault renames', () => {
  it('notifies a rename between markdown paths', () => {
    const { noteVault, fireRename } = setup()
    const renames: Array<[string, string]> = []
    noteVault.onNoteRenamed((path, oldPath) => renames.push([path, oldPath]))

    fireRename(fileAt('folder/new.md', 'md'), 'old.md')

    expect(renames).toEqual([['folder/new.md', 'old.md']])
  })

  it('notifies a deletion when a note is renamed to a non-markdown file', () => {
    const { noteVault, fireRename } = setup()
    const renames: string[] = []
    const deletions: string[] = []
    noteVault.onNoteRenamed((path) => renames.push(path))
    noteVault.onNoteDeleted((path) => deletions.push(path))

    fireRename(fileAt('note.txt', 'txt'), 'note.md')

    expect(renames).toEqual([])
    expect(deletions).toEqual(['note.md'])
  })

  it('notifies a rename when a non-markdown file becomes a note', () => {
    const { noteVault, fireRename } = setup()
    const renames: Array<[string, string]> = []
    const deletions: string[] = []
    noteVault.onNoteRenamed((path, oldPath) => renames.push([path, oldPath]))
    noteVault.onNoteDeleted((path) => deletions.push(path))

    fireRename(fileAt('note.md', 'md'), 'note.txt')

    expect(renames).toEqual([['note.md', 'note.txt']])
    expect(deletions).toEqual([])
  })

  it('ignores the cross-references data file despite its .md extension', () => {
    const { noteVault, fireRename } = setup()
    const renames: string[] = []
    const deletions: string[] = []
    noteVault.onNoteRenamed((path) => renames.push(path))
    noteVault.onNoteDeleted((path) => deletions.push(path))

    fireRename(
      fileAt('Study/scripture-study-cross-references.md', 'md'),
      'scripture-study-cross-references.md',
    )

    expect(renames).toEqual([])
    expect(deletions).toEqual([])
  })

  it('ignores folder renames', () => {
    const { noteVault, fireRename } = setup()
    const renames: string[] = []
    const deletions: string[] = []
    noteVault.onNoteRenamed((path) => renames.push(path))
    noteVault.onNoteDeleted((path) => deletions.push(path))

    fireRename(folderAt('renamed folder.md'), 'folder.md')

    expect(renames).toEqual([])
    expect(deletions).toEqual([])
  })
})
