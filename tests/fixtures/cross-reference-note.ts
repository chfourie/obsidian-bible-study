export type CrossReferenceNoteFixture = {
  members: readonly string[]
  summary?: string | null
  body?: string
  type?: string | null
  ref?: string
}

// A cross-reference note as the plugin writes it — or, with `type` or a
// member altered, as a hand-authored one might be.
export const crossReferenceNote = ({
  members,
  summary = null,
  body = '',
  type = 'cross-reference',
  ref,
}: CrossReferenceNoteFixture): string =>
  [
    '---',
    ...(type === null ? [] : [`type: ${type}`]),
    ...(ref === undefined ? [] : [`ref: ${ref}`]),
    'refs:',
    ...members.map((member) => `  - ${member}`),
    `summary: ${summary === null ? '""' : summary}`,
    '---',
    body,
  ].join('\n')
