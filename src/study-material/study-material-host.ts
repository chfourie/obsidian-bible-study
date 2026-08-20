import type { NavigationOptions } from '../contracts'
import type { CrossReference } from '../cross-references'
import type { Reference } from '../reference'

// The tab a surface shows a reader's study material under: the chapter's
// study sections, or the selection's details.
export type StudySubTab = 'chapter' | 'selection'

// What a surface rendering study material — the Study Panel — must be able to
// do on the workspace around it. Everything that acts on the material itself
// goes through StudyMaterialSource instead.
export type StudyMaterialHost = {
  openNote: (file: string) => void
  openReference: (reference: Reference, options?: NavigationOptions) => void
  // Cmd/Ctrl-clicking an edit icon sends the cross-reference to its own pane
  // rather than taking over the collect strip on screen.
  editCrossReferenceInNewPane: (entry: CrossReference) => void
  // Opens the annotation prompt with the given reference typed in, letting
  // the user adjust it before the note is created.
  promptAnnotate: (prefill: Reference) => void
  renderMarkdown: (
    el: HTMLElement,
    markdown: string,
    sourcePath: string,
  ) => void
}
