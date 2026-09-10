import {
  splitTemplate,
  withFrontmatterKeys,
  type FrontmatterKeyBlock,
} from '../notes'
import { formatReference, type Reference } from '../reference'
import { CROSS_REFERENCE_NOTE_TYPE, type MemberAsWritten } from '../vault-index'

// A plain YAML scalar is anything the parser could not mistake for
// structure; everything else is written as a JSON string, which YAML reads.
const PLAIN_SCALAR = /^[A-Za-z0-9][^#:\r\n]*(?::[^ #\r\n][^#:\r\n]*)*$/
const LITERAL_LOOKALIKE =
  /^(?:true|false|yes|no|on|off|null|~|[-+]?(?:0x[\da-f]+|0o[0-7]+|[\d.,_e]+(?::[\d.,_e]+)*))$/i

const yamlScalar = (value: string): string =>
  PLAIN_SCALAR.test(value) &&
  !LITERAL_LOOKALIKE.test(value) &&
  value === value.trim()
    ? value
    : JSON.stringify(value)

const keyLine = (key: string, value: string): string => `${key}: ${yamlScalar(value)}`

const memberText = (member: MemberAsWritten): string =>
  typeof member === 'string' ? member : formatReference(member)

const refsBlock = (members: readonly MemberAsWritten[]): string[] => [
  'refs:',
  ...members.map((member) => `  - ${yamlScalar(memberText(member))}`),
]

export const crossReferenceMemberKeys = (
  members: readonly MemberAsWritten[],
  summary: string | null,
): FrontmatterKeyBlock[] => [
  ['refs', refsBlock(members)],
  ['summary', [keyLine('summary', summary ?? '')]],
]

const crossReferenceKeys = (
  members: readonly Reference[],
  summary: string | null,
): FrontmatterKeyBlock[] => [
  ['type', [keyLine('type', CROSS_REFERENCE_NOTE_TYPE)]],
  ...crossReferenceMemberKeys(members, summary),
]

export const composeCrossReferenceNote = (
  members: readonly Reference[],
  summary: string | null,
  template: string | null,
): string => {
  const split = splitTemplate(template)
  const frontmatter = withFrontmatterKeys(
    split.frontmatter,
    crossReferenceKeys(members, summary),
  )
  return `${frontmatter}${split.body}`
}
