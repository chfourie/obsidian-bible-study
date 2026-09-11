import type { StudySubTab } from '../study-material'

// What the Study Panel remembers about one tab it follows: the sub-tab it
// last showed, the passage entries unfolded under it, the translation blocks
// collapsed on the Selection tab, and the annotation rows toggled away from
// how they started. Entries start folded and translations start open, so
// each set holds the departures worth remembering; annotations start as the
// setting chose when the tab was first followed, recorded here so a later
// setting change can tell an untouched tab from an arranged one.
export type StudyTabState = {
  subTab: StudySubTab
  expanded: ReadonlySet<string>
  collapsedTranslations: ReadonlySet<string>
  annotationsStartExpanded: boolean
  toggledAnnotations: ReadonlySet<string>
}

export const freshTabState = (
  annotationsStartExpanded = false,
): StudyTabState => ({
  subTab: 'chapter',
  expanded: new Set(),
  collapsedTranslations: new Set(),
  annotationsStartExpanded,
  toggledAnnotations: new Set(),
})

// A tab that has toggled no annotation row has arranged nothing there, so a
// changed start-expanded default may still take hold of it.
export const hasAnnotationMemory = (state: StudyTabState): boolean =>
  state.toggledAnnotations.size > 0

// Panel state one tab at a time, in memory for that tab's lifetime: two tabs
// on the same content hold their own state, and a closed tab takes its state
// with it, so reopening the same content starts fresh. Each new tab reads
// the annotation default as it stands then; tabs already followed keep theirs.
export class TabMemory<Tab> {
  readonly #states = new Map<Tab, StudyTabState>()

  constructor(
    private readonly annotationsStartExpanded: () => boolean = () => false,
  ) {}

  stateFor(tab: Tab): StudyTabState {
    const remembered = this.#states.get(tab)
    if (remembered !== undefined) return remembered
    const state = freshTabState(this.annotationsStartExpanded())
    this.#states.set(tab, state)
    return state
  }

  retain(tabs: Iterable<Tab>): void {
    const live = new Set(tabs)
    for (const tab of [...this.#states.keys()])
      if (!live.has(tab)) this.#states.delete(tab)
  }
}
