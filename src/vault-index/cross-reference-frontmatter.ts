export const CROSS_REFERENCE_NOTE_TYPE = 'cross-reference'

// What a cross-reference note declares in its frontmatter, still as text:
// the member grammar strings in order and the summary line (ADR 0015).
export type CrossReferenceFrontmatter = {
  members: string[]
  summary: string | null
}

const keyLine = (key: string): RegExp => new RegExp(`^${key}:[ \\t]*(.*?)[ \\t]*$`, 'm')

const LIST_ITEM = /^[ \t]*-[ \t]+(.*?)[ \t]*$/
const TOP_LEVEL_LINE = /^[^ \t]/
const FLOW_LIST = /^\[(.*)\]$/
// A flow-list fragment that is only verse numbering continues the member
// before it: the grammar's own commas (`John 15:1,4`) are not separators.
const VERSE_CONTINUATION = /^\d[\d:,\s-]*$/

const unescapeSingleQuoted = (value: string): string =>
  value.slice(1, -1).replace(/''/g, "'")

const parseDoubleQuoted = (value: string): string => {
  try {
    return String(JSON.parse(value))
  } catch {
    return value.slice(1, -1)
  }
}

const isQuoted = (value: string, quote: string): boolean =>
  value.length >= 2 && value.startsWith(quote) && value.endsWith(quote)

// A YAML scalar as a plain string: double-quoted read by JSON's rules,
// single-quoted by YAML's doubled-apostrophe rule, anything else verbatim.
const yamlScalarText = (value: string): string => {
  if (isQuoted(value, '"')) return parseDoubleQuoted(value)
  if (isQuoted(value, "'")) return unescapeSingleQuoted(value)
  return value
}

const keyValue = (frontmatter: string, key: string): string | null => {
  const match = keyLine(key).exec(frontmatter)
  return match === null ? null : match[1]
}

// The text of a top-level scalar key, or null when the key is absent or
// empty.
export const frontmatterScalar = (
  frontmatter: string,
  key: string,
): string | null => {
  const value = keyValue(frontmatter, key)
  if (value === null) return null
  const text = yamlScalarText(value)
  return text === '' ? null : text
}

const splitFlowItems = (inner: string): string[] => {
  const items: string[] = []
  let current = ''
  let quote: string | null = null
  const push = (): void => {
    const item = current.trim()
    if (item === '') return
    if (VERSE_CONTINUATION.test(item) && items.length > 0)
      items[items.length - 1] += `,${item}`
    else items.push(item)
    current = ''
  }
  for (const char of inner) {
    if (quote !== null) {
      current += char
      if (char === quote) quote = null
    } else if (char === '"' || char === "'") {
      current += char
      quote = char
    } else if (char === ',') push()
    else current += char
  }
  push()
  return items.map(yamlScalarText)
}

// The block list under `refs:` — every `- item` line beneath it, indented or
// not, up to the next top-level key.
const blockItems = (lines: readonly string[]): string[] => {
  const items: string[] = []
  for (const line of lines) {
    if (line.trim() === '') continue
    const item = LIST_ITEM.exec(line)
    if (item) items.push(yamlScalarText(item[1]))
    else if (TOP_LEVEL_LINE.test(line)) break
  }
  return items
}

const refsItems = (frontmatter: string): string[] | null => {
  const lines = frontmatter.split(/\r?\n/)
  const start = lines.findIndex((line) => keyLine('refs').test(line))
  if (start === -1) return null
  const inline = keyLine('refs').exec(lines[start])?.[1] ?? ''
  const flow = FLOW_LIST.exec(inline)
  return flow ? splitFlowItems(flow[1]) : blockItems(lines.slice(start + 1))
}

// Null unless the note declares both `type: cross-reference` and `refs`; the
// members come back as written, parseable or not.
export const crossReferenceFrontmatter = (
  frontmatter: string,
): CrossReferenceFrontmatter | null => {
  if (frontmatterScalar(frontmatter, 'type') !== CROSS_REFERENCE_NOTE_TYPE)
    return null
  const members = refsItems(frontmatter)
  if (members === null) return null
  return { members, summary: frontmatterScalar(frontmatter, 'summary') }
}
