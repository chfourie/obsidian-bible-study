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
