import type { View } from 'obsidian'
import type {
  CrossReference,
  CrossReferenceMemberView,
  CrossReferenceView,
} from '../cross-references'
import type { Reference } from '../reference'
import type { VerseSegment } from '../rendering'

export type StrongsEntryView = {
  strongs: string
  lemma: string
  transliteration: string
  gloss: string
  definition: string
}

export type TranslationRowView = {
  id: string
  label: string
  name: string
  segments: VerseSegment[] | null
}

// One annotation intersecting the chapter on screen, headed by the reference
// its frontmatter declares.
export type ChapterAnnotationView = {
  file: string
  label: string
  body: string
}

// One note mentioning the chapter on screen — an intersecting note that is
// not an annotation — titled by its note name and labelled by the references
// in it that fall inside the chapter.
export type ChapterMentionView = {
  file: string
  title: string
  labels: string[]
}

// A selected span of book paragraphs: the full citation and the prose itself
// stand where a scripture selection stacks its translations (spec-books §5).
export type BookDetailsView = {
  citation: string
  text: string
}

// The selected span's details: each translation carries the text of the whole
// selection, and the title names that span.
export type VerseDetailsView = {
  verseId: number
  title: string
  // Non-null exactly for a book selection, which carries no translations.
  book: BookDetailsView | null
  translations: TranslationRowView[]
  strongs: StrongsEntryView[]
  strongsAttribution: string | null
}

// The strip that builds a cross-reference: members, description and the
// actions over them, whether it is creating one or editing one that exists.
export type CollectionView = {
  members: CrossReferenceMemberView[]
  canAddSelection: boolean
  canSave: boolean
  error: string | null
  // True when this strip edits an existing cross-reference rather than
  // building a new one — saving writes back to the same id.
  editing: boolean
  // Deleting the edited cross-reference takes a second press to go through.
  confirmingDelete: boolean
  // Seeded from the cross-reference being edited, so saving an untouched
  // strip keeps the description it already had.
  description: string
  typedMember: string
}

// Everything one reader tab offers for study beside its scripture text: the
// verse selection and its details, the cross-references touching the chapter
// on screen, and the collect-a-cross-reference strip.
export type StudyMaterial = {
  // Names the tab this material comes from — the reader's book and chapter.
  title: string
  // True while the tab reads a non-biblical book. A book has exactly one
  // layer, so its paragraph details take the place of the Translations tab
  // rather than living under one (spec-books §5).
  bookMode: boolean
  selectedVerseId: number | null
  selectionEndId: number | null
  // The selection's details, or null when nothing is selected, no surface
  // wants them, or the load is still in flight.
  details: VerseDetailsView | null
  // Every cross-reference touching the chapter on screen, independent of any
  // verse selection.
  chapterCrossReferences: CrossReferenceView[]
  // Every annotation intersecting the chapter on screen, in scripture order,
  // independent of any verse selection.
  chapterAnnotations: ChapterAnnotationView[]
  // Every mention intersecting the chapter on screen, in scripture order with
  // a path A-Z tiebreak, independent of any verse selection.
  chapterMentions: ChapterMentionView[]
  collection: CollectionView | null
}

// What the user deliberately picked in the reader: a verse row, or a
// Strong's-tagged word within one.
export type SelectionKind = 'verse' | 'word'

// One reader tab's study material, observable and actionable without reaching
// into the reader: the surface that renders it — today the reader's own
// details region, later the Study Panel — reads snapshots and invokes actions
// through here.
export interface StudyMaterialSource {
  readonly studyMaterial: StudyMaterial
  subscribe(listener: () => void): () => void
  // Fires only when the user explicitly picks a verse or a Strong's-tagged
  // word in this tab. Separate from subscribe(), which reports every material
  // change: a surface may act on a deliberate selection — revealing itself,
  // say — without acting on material that merely changed underneath it.
  onSelection(listener: (kind: SelectionKind) => void): () => void
  // Whether any surface is showing the verse details right now. Details load
  // only while wanted: selections made while nothing wants them fetch no
  // passage text, and wanting them later loads the current selection.
  setDetailsWanted(wanted: boolean): void
  // Dismisses the selection outright: details and row highlight go with it.
  // Never fires the selection feed — clearing is not a deliberate selection.
  clearSelection(): void
  // The reference the chapter-level annotate action prefills: the current
  // selection when there is one, otherwise the whole chapter on screen.
  chapterAnnotationReference(): Reference
  startCollecting(): void
  startEditingCrossReference(entry: CrossReference): void
  cancelCollecting(): void
  addSelectionToCollection(): void
  typeMember(text: string): void
  addTypedReferenceToCollection(): void
  removeCollectionMember(index: number): void
  describeCollection(description: string): void
  saveCrossReference(): Promise<void>
  confirmDeleteCrossReference(): void
  cancelDeleteCrossReference(): void
  deleteCrossReference(): Promise<void>
}

// Resolves a focused tab to its study material, so a surface holding workspace
// leaves never needs the reader's view class.
export interface StudyMaterialProvider {
  studyMaterialFor(view: View | null): StudyMaterialSource | null
}

// Stands in until the reader feature is wired up: no tab ever carries study
// material, so surfaces holding one keep their non-reader view.
export const NO_STUDY_MATERIAL: StudyMaterialProvider = {
  studyMaterialFor: () => null,
}
