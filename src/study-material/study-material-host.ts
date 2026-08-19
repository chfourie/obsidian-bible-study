import type { NavigationOptions } from '../contracts'
import type { CrossReference } from '../cross-references'
import type { Reference } from '../reference'

// The sub-tab a surface shows the selected verse's details under.
export type StudySubTab = 'translations' | 'notes'

// What a surface rendering study material — the reader's own details region or
// the Study Panel — must be able to do on the workspace around it. Everything
// that acts on the material itself goes through StudyMaterialSource instead.
export type StudyMaterialHost = {
  openNote: (file: string) => void
  openReference: (reference: Reference, options?: NavigationOptions) => void
  // Cmd/Ctrl-clicking an edit icon sends the cross-reference to its own pane
  // rather than taking over the collect strip on screen.
  editCrossReferenceInNewPane: (entry: CrossReference) => void
  annotate: (reference: Reference) => void
  renderMarkdown: (
    el: HTMLElement,
    markdown: string,
    sourcePath: string,
  ) => void
}
