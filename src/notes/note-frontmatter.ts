import { frontmatterLength } from '../reference'

export type FrontmatterKeyBlock = [key: string, lines: string[]]

export type SplitTemplate = {
  frontmatter: string
  body: string
}

const EMPTY_FRONTMATTER = '---\n---\n'

// A template without frontmatter is all body; without a template the note
// gets empty frontmatter and a blank line to start writing on.
export const splitTemplate = (template: string | null): SplitTemplate => {
  if (template === null) return { frontmatter: EMPTY_FRONTMATTER, body: '\n' }
  const end = frontmatterLength(template)
  return {
    frontmatter: end > 0 ? template.slice(0, end) : EMPTY_FRONTMATTER,
    body: template.slice(end),
  }
}

// A line YAML reads as part of the key above it: indented (a block scalar's
// text, a nested mapping, an indented list item) or an unindented list item.
const isContinuation = (line: string): boolean => /^[ \t]|^-(\s|$)/.test(line)

// A blank line belongs to the block only while more of it follows.
const blockEnd = (lines: readonly string[], keyIndex: number): number => {
  let end = keyIndex + 1
  for (let i = end; i < lines.length; i++) {
    if (isContinuation(lines[i])) end = i + 1
    else if (lines[i].trim() !== '') break
  }
  return end
}

// Replaces the key's whole block in place, or appends the block when the key
// is absent — a template's own key order survives, and a key it carried is
// never left beside the plugin's.
const withKeyBlock = (lines: string[], key: string, block: string[]): string[] => {
  const keyIndex = lines.findIndex((line) => line.startsWith(`${key}:`))
  if (keyIndex < 0) return [...lines, ...block]
  return [...lines.slice(0, keyIndex), ...block, ...lines.slice(blockEnd(lines, keyIndex))]
}

export const withFrontmatterKeys = (
  frontmatter: string,
  keys: readonly FrontmatterKeyBlock[],
): string => {
  const lines = frontmatter.replace(/\n$/, '').split('\n')
  const inner = keys.reduce(
    (current, [key, block]) => withKeyBlock(current, key, block),
    lines.slice(1, -1),
  )
  return `${[lines[0], ...inner, lines[lines.length - 1]].join('\n')}\n`
}
