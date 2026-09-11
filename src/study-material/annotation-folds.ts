// The fold state of the annotation rows a surface shows, and the actions over
// it, handed in by the Study Panel that holds the followed tab's memory. Rows
// are keyed by the annotation note's path; the same shape serves the
// reader-tab study material and the note-tab panel.
export type AnnotationFolds = {
  folded: ReadonlySet<string>
  toggle: (file: string) => void
  foldAll: () => void
  expandAll: () => void
}
