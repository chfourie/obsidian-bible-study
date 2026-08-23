import type {
  NavigationOptions,
  StudyMaterialSource,
  WordCloudWordView,
  WordStudyOptions,
} from '../contracts'
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
  // Sends an extended Strong's number to the Word Study Panel: plainly, it
  // retargets the most-recently-focused panel; with the new-pane modifier, it
  // opens another beside it.
  openWordStudy: (strongsNumber: string, options?: WordStudyOptions) => void
  // Opens the menu a Word Cloud word offers — highlight, word study,
  // exclude — over the tab whose cloud it is, where the word was activated.
  openCloudWordMenu: (
    word: WordCloudWordView,
    source: StudyMaterialSource,
    event: MouseEvent | KeyboardEvent,
  ) => void
  renderMarkdown: (
    el: HTMLElement,
    markdown: string,
    sourcePath: string,
  ) => void
}
