import { Menu } from 'obsidian'
import type { WordCloudWordView } from '../contracts'

// What a cloud word's menu can set off; who performs each is the feature's
// business. The word study carries the item's own activation event, whose
// modifier decides between retargeting a panel and opening a new one.
export type CloudWordMenuActions = {
  toggleEmphasis: () => void
  openWordStudy: (event: MouseEvent | KeyboardEvent) => void
  exclude: () => void
}

// The menu a Word Cloud word opens on activation: its Occurrence Emphasis,
// the family's word study and its exclusion. A pointer opens it where it
// was; a keyboard opens it under the word.
export const showCloudWordMenu = (
  word: WordCloudWordView,
  event: MouseEvent | KeyboardEvent,
  actions: CloudWordMenuActions,
): void => {
  const menu = new Menu()
  menu.addItem((item) =>
    item
      .setTitle(word.active ? 'Clear highlight' : 'Highlight occurrences')
      .setIcon('highlighter')
      .setChecked(word.active)
      .onClick(() => actions.toggleEmphasis()),
  )
  menu.addItem((item) =>
    item
      .setTitle('Word study')
      .setIcon('book-open')
      .onClick((clicked) => actions.openWordStudy(clicked)),
  )
  menu.addItem((item) =>
    item
      .setTitle('Exclude from key words…')
      .setIcon('eye-off')
      .onClick(() => actions.exclude()),
  )
  if (event instanceof MouseEvent) menu.showAtMouseEvent(event)
  else menu.showAtPosition(belowTarget(event))
}

const belowTarget = (event: KeyboardEvent): { x: number; y: number } => {
  const target = event.target
  if (!(target instanceof HTMLElement)) return { x: 0, y: 0 }
  const rect = target.getBoundingClientRect()
  return { x: rect.left, y: rect.bottom }
}
