import { CROSS_REFERENCE_NOTE_TYPE } from '../cross-references/compose-cross-reference-note'

// What a cross-reference note declares in its frontmatter, still as text:
// the member grammar strings in order and the summary line (ADR 0015).
export type CrossReferenceFrontmatter = {
  members: string[]
  summary: string | null
}

const keyLine = (key: string): RegExp => new RegExp(`^${key}:[ \\t]*(.*?)[ \\t]*$`, 'm')

const LIST_ITEM = /^[ \t]+-[ \t]+(.*?)[ \t]*$/
const NESTED_LINE = /^[ \t]/

const unescapeSingleQuoted = (value: string): string =>
  value.slice(1, -1).replace(/''/g, "'")

const parseDoubleQuoted = (value: string): string => {
  try {
    return String(JSON.parse(value))
  } catch {
    return value.slice(1, -1)
  }
}

// A YAML scalar as a plain string: double-quoted read by JSON's rules,
// single-quoted by YAML's doubled-apostrophe rule, anything else verbatim.
export const yamlScalarText = (value: string): string => {
  if (value.length >= 2 && value.startsWith('"') && value.endsWith('"'))
    return parseDoubleQuoted(value)
  if (value.length >= 2 && value.startsWith("'") && value.endsWith("'"))
    return unescapeSingleQuoted(value)
  return value
}

const keyValue = (frontmatter: string, key: string): string | null => {
  const match = keyLine(key).exec(frontmatter)
  return match === null ? null : match[1]
}

// The block list under `refs:` — every `- item` line indented beneath it,
// up to the next top-level key.
const refsItems = (frontmatter: string): string[] | null => {
  const lines = frontmatter.split(/\r?\n/)
  const start = lines.findIndex((line) => keyLine('refs').test(line))
  if (start === -1) return null
  const items: string[] = []
  for (const line of lines.slice(start + 1)) {
    if (line.trim() === '') continue
    if (!NESTED_LINE.test(line)) break
    const item = LIST_ITEM.exec(line)
    if (item) items.push(yamlScalarText(item[1]))
  }
  return items
}

const declaresType = (frontmatter: string): boolean => {
  const type = keyValue(frontmatter, 'type')
  return type !== null && yamlScalarText(type) === CROSS_REFERENCE_NOTE_TYPE
}

// Null unless the note declares both `type: cross-reference` and `refs`; the
// members come back as written, parseable or not.
export const crossReferenceFrontmatter = (
  frontmatter: string,
): CrossReferenceFrontmatter | null => {
  if (!declaresType(frontmatter)) return null
  const members = refsItems(frontmatter)
  if (members === null) return null
  const summary = keyValue(frontmatter, 'summary')
  const summaryText = summary === null ? '' : yamlScalarText(summary)
  return { members, summary: summaryText === '' ? null : summaryText }
}
