import { describe, expect, it, vi } from 'vitest'
import type { App, Editor, EditorSuggestContext } from 'obsidian'
import {
  braceQueryStart,
  ReferenceEditorSuggest,
} from './reference-editor-suggest'

const context = {
  knownTranslationIds: ['nkjv', 'web'],
  defaultTranslationId: 'web',
}

const suggestOver = (line: string) => {
  const editor = {
    getLine: () => line,
    replaceRange: vi.fn(),
    setCursor: vi.fn(),
  }
  const suggest = new ReferenceEditorSuggest({} as App, () => context)
  return { suggest, editor }
}

describe('braceQueryStart', () => {
  it('finds the character after an unclosed opening brace', () => {
    expect(braceQueryStart('see {John 15')).toBe(5)
    expect(braceQueryStart('{')).toBe(1)
  })

  it('returns null without an open brace before the cursor', () => {
    expect(braceQueryStart('see John 15')).toBeNull()
    expect(braceQueryStart('see {John 15:4} and')).toBeNull()
    expect(braceQueryStart('see \\{John 15')).toBeNull()
  })
})

describe('ReferenceEditorSuggest', () => {
  it('triggers inside an unclosed brace with the brace text as query', () => {
    const { suggest, editor } = suggestOver('see {John 15:4 c and more')

    const trigger = suggest.onTrigger(
      { line: 2, ch: 16 },
      editor as unknown as Editor,
    )

    expect(trigger).toEqual({
      start: { line: 2, ch: 5 },
      end: { line: 2, ch: 16 },
      query: 'John 15:4 c',
    })
  })

  it('does not trigger outside braces', () => {
    const { suggest, editor } = suggestOver('plain prose line')

    expect(
      suggest.onTrigger({ line: 0, ch: 10 }, editor as unknown as Editor),
    ).toBeNull()
  })

  it('suggests completions for the query using known translations', () => {
    const { suggest } = suggestOver('')

    const suggestions = suggest.getSuggestions({
      query: 'John 15:4 n',
    } as EditorSuggestContext)

    expect(suggestions.map((suggestion) => suggestion.label)).toEqual(['nkjv'])
  })

  it('replaces only the partial token and moves the cursor after it', () => {
    const { suggest, editor } = suggestOver('see {John 15:4 c')
    suggest.context = {
      editor: editor as unknown as Editor,
      file: null,
      start: { line: 0, ch: 5 },
      end: { line: 0, ch: 16 },
      query: 'John 15:4 c',
    } as unknown as EditorSuggestContext

    suggest.selectSuggestion({
      label: 'block',
      insert: 'block',
      replaceFrom: 10,
    })

    expect(editor.replaceRange).toHaveBeenCalledWith(
      'block',
      { line: 0, ch: 15 },
      { line: 0, ch: 16 },
    )
    expect(editor.setCursor).toHaveBeenCalledWith({ line: 0, ch: 20 })
  })
})
