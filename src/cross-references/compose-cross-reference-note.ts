import { formatReference, frontmatterLength, type Reference } from '../reference'

export const CROSS_REFERENCE_NOTE_TYPE = 'cross-reference'

// A plain YAML scalar is anything the parser could not mistake for
// structure; everything else is written as a JSON string, which YAML reads.
const PLAIN_SCALAR = /^[A-Za-z0-9][^#:]*(?::[^ #][^#:]*)*$/
const LITERAL_LOOKALIKE = /^(?:true|false|yes|no|on|off|null|~|[-+]?[\d.,_e]+)$/i

const yamlScalar = (value: string): string =>
  PLAIN_SCALAR.test(value) &&
  !LITERAL_LOOKALIKE.test(value) &&
  value === value.trim()
    ? value
    : JSON.stringify(value)

const keyLine = (key: string, value: string): string => `${key}: ${yamlScalar(value)}`

const refsBlock = (members: readonly Reference[]): string[] => [
  'refs:',
  ...members.map((member) => `  - ${yamlScalar(formatReference(member))}`),
]

const isListItem = (line: string): boolean => /^\s+-(\s|$)|^-(\s|$)/.test(line)

// Replaces the key's block (its line plus any indented list items) in place,
// or appends the block when the key is absent — a template's own key order
// survives, and a key it carried is never left beside the plugin's.
const withKeyBlock = (lines: string[], key: string, block: string[]): string[] => {
  const keyIndex = lines.findIndex((line) => line.startsWith(`${key}:`))
  if (keyIndex < 0) return [...lines, ...block]
  let end = keyIndex + 1
  while (end < lines.length && isListItem(lines[end])) end++
  return [...lines.slice(0, keyIndex), ...block, ...lines.slice(end)]
}

const crossReferenceKeys = (
  members: readonly Reference[],
  summary: string | null,
): [key: string, block: string[]][] => [
  ['type', [keyLine('type', CROSS_REFERENCE_NOTE_TYPE)]],
  ['refs', refsBlock(members)],
  ['summary', [keyLine('summary', summary ?? '')]],
]

const withCrossReferenceKeys = (
  frontmatter: string,
  members: readonly Reference[],
  summary: string | null,
): string => {
  const lines = frontmatter.replace(/\n$/, '').split('\n')
  const inner = crossReferenceKeys(members, summary).reduce(
    (keys, [key, block]) => withKeyBlock(keys, key, block),
    lines.slice(1, -1),
  )
  return `${[lines[0], ...inner, lines[lines.length - 1]].join('\n')}\n`
}

export const composeCrossReferenceNote = (
  members: readonly Reference[],
  summary: string | null,
  template: string | null,
): string => {
  const templateFrontmatterEnd =
    template === null ? 0 : frontmatterLength(template)
  const body = template === null ? '\n' : template.slice(templateFrontmatterEnd)
  const frontmatter = withCrossReferenceKeys(
    templateFrontmatterEnd > 0 && template !== null
      ? template.slice(0, templateFrontmatterEnd)
      : '---\n---\n',
    members,
    summary,
  )
  return `${frontmatter}${body}`
}
