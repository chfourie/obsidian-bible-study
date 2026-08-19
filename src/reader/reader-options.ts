import type { ReaderToggles } from './reader-pane-model'

export type ReaderOptionGroup = {
  key: keyof ReaderToggles
  label: string
  options: { value: string; label: string }[]
}

const BASE_GROUPS: ReaderOptionGroup[] = [
  {
    key: 'nav',
    label: 'Nav',
    options: [
      { value: 'tree', label: 'Tree' },
      { value: 'breadcrumb', label: 'Breadcrumb' },
    ],
  },
  {
    key: 'layout',
    label: 'Layout',
    options: [
      { value: 'verse-per-line', label: 'Verse per line' },
      { value: 'continuous', label: 'Continuous' },
    ],
  },
  {
    key: 'redLetter',
    label: 'Red letter',
    options: [
      { value: 'off', label: 'Off' },
      { value: 'on', label: 'On' },
    ],
  },
]

const STRONGS_GROUP: ReaderOptionGroup = {
  key: 'strongs',
  label: "Strong's",
  options: [
    { value: 'off', label: 'Off' },
    { value: 'on', label: 'On' },
  ],
}

export const readerOptionGroups = (
  strongsAvailable: boolean,
): ReaderOptionGroup[] =>
  strongsAvailable ? [...BASE_GROUPS, STRONGS_GROUP] : BASE_GROUPS
