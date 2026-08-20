// A vault note's display title: its basename with the .md extension gone.
// Only .md goes — vault notes are markdown, and a dot elsewhere in a title
// is part of the name.
export const noteTitle = (file: string): string => {
  const basename = file.split('/').pop() ?? file
  return basename.replace(/\.md$/, '')
}
