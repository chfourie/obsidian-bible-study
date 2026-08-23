import type { WordCloudWordView } from '../contracts'
import type { MenuItem } from '../ui'

// What a cloud word's menu can set off; who performs each is the feature's
// business. The word study carries the item's own activation event, whose
// modifier decides between retargeting a panel and opening a new one.
export type CloudWordMenuActions = {
  toggleEmphasis: () => void
  openWordStudy: (event: MouseEvent | KeyboardEvent) => void
  exclude: () => void
}

// The menu a Word Cloud word opens on a right-click: its Occurrence
// Emphasis, the family's word study and its exclusion.
export const buildCloudWordMenuItems = (
  word: WordCloudWordView,
  actions: CloudWordMenuActions,
): MenuItem[] => [
  {
    title: word.active ? 'Clear highlight' : 'Highlight occurrences',
    icon: 'highlighter',
    checked: word.active,
    onClick: () => actions.toggleEmphasis(),
  },
  {
    title: 'Word study',
    icon: 'book-open',
    onClick: (event) => actions.openWordStudy(event),
  },
  {
    title: 'Exclude from key words…',
    icon: 'eye-off',
    onClick: () => actions.exclude(),
  },
]
