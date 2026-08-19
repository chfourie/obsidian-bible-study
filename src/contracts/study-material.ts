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

export type NoteCardView = {
  file: string
}

export type AnnotationBlockView = {
  file: string
  body: string
}

export type VerseDetailsView = {
  verseId: number
  title: string
  translations: TranslationRowView[]
  annotations: AnnotationBlockView[]
  mentions: NoteCardView[]
  crossReferences: CrossReferenceView[]
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
  selectedVerseId: number | null
  selectionEndId: number | null
  // The selected verse's details, or null when nothing is selected or the
  // details have not loaded yet.
  details: VerseDetailsView | null
  // Every cross-reference touching the chapter on screen, independent of any
  // verse selection.
  chapterCrossReferences: CrossReferenceView[]
  collection: CollectionView | null
}

// One reader tab's study material, observable and actionable without reaching
// into the reader: the surface that renders it — today the reader's own
// details region, later the Study Panel — reads snapshots and invokes actions
// through here.
export interface StudyMaterialSource {
  readonly studyMaterial: StudyMaterial
  subscribe(listener: () => void): () => void
  // The reference an annotation of this verse covers: the current selection
  // when it contains the verse, otherwise the verse alone.
  annotationReference(verseId: number): Reference
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
