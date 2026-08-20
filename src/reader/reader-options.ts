import type { ReaderToggles } from './reader-pane-model'

export type ReaderOptionGroup = {
  key: keyof ReaderToggles
  label: string
  options: { value: string; label: string }[]
}

const NAV_GROUP: ReaderOptionGroup = {
  key: 'nav',
  label: 'Nav',
  options: [
    { value: 'tree', label: 'Tree' },
    { value: 'breadcrumb', label: 'Breadcrumb' },
  ],
}

const SCRIPTURE_GROUPS: ReaderOptionGroup[] = [
  NAV_GROUP,
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

const PARA_NUMBERS_GROUP: ReaderOptionGroup = {
  key: 'paraNumbers',
  label: 'Para numbers',
  options: [
    { value: 'on', label: 'On' },
    { value: 'hover', label: 'Hover' },
  ],
}

export type ReaderOptionContext = {
  strongsAvailable: boolean
  bookMode: boolean
}

// A book has no verse grid, no words of Christ and no Strong's tags, so those
// groups are hidden rather than disabled (spec-books §5).
export const readerOptionGroups = ({
  strongsAvailable,
  bookMode,
}: ReaderOptionContext): ReaderOptionGroup[] => {
  if (bookMode) return [NAV_GROUP, PARA_NUMBERS_GROUP]
  return strongsAvailable
    ? [...SCRIPTURE_GROUPS, STRONGS_GROUP]
    : SCRIPTURE_GROUPS
}
