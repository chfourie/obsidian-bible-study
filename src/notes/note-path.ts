export const NOTE_EXTENSION = '.md'

export type SplitNotePath = { folder: string; basename: string }

// A vault path taken apart: the folder ('' at the root) and the name without
// its extension.
export const splitNotePath = (path: string): SplitNotePath => {
  const slash = path.lastIndexOf('/')
  const name = path.slice(slash + 1)
  return {
    folder: slash < 0 ? '' : path.slice(0, slash),
    basename: name.endsWith(NOTE_EXTENSION)
      ? name.slice(0, -NOTE_EXTENSION.length)
      : name,
  }
}

export const joinNotePath = (folder: string, basename: string): string =>
  `${folder === '' ? '' : `${folder}/`}${basename}${NOTE_EXTENSION}`
