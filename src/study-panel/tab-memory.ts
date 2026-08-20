import type { StudySubTab } from '../study-material'

// What the Study Panel remembers about one tab it follows: the details sub-tab
// that tab last showed, and the passage entries unfolded under it. Entries
// start folded, so it is the unfolding that is worth remembering.
export type StudyTabState = {
  subTab: StudySubTab
  expanded: ReadonlySet<string>
}

export const freshTabState = (): StudyTabState => ({
  subTab: 'translations',
  expanded: new Set(),
})

// Panel state one tab at a time, in memory for that tab's lifetime: two tabs
// on the same content hold their own state, and a closed tab takes its state
// with it, so reopening the same content starts fresh.
export class TabMemory<Tab> {
  readonly #states = new Map<Tab, StudyTabState>()

  stateFor(tab: Tab): StudyTabState {
    const remembered = this.#states.get(tab)
    if (remembered !== undefined) return remembered
    const state = freshTabState()
    this.#states.set(tab, state)
    return state
  }

  retain(tabs: Iterable<Tab>): void {
    const live = new Set(tabs)
    for (const tab of [...this.#states.keys()])
      if (!live.has(tab)) this.#states.delete(tab)
  }
}
