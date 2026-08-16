import {
  EditorSuggest,
  type App,
  type Editor,
  type EditorPosition,
  type EditorSuggestContext,
  type EditorSuggestTriggerInfo,
} from 'obsidian'
import { suggestReference, type ReferenceSuggestion } from '../reference'
import type { RenderContext } from './reference-render-model'

export const braceQueryStart = (beforeCursor: string): number | null => {
  const open = beforeCursor.lastIndexOf('{')
  if (open === -1) return null
  if (beforeCursor[open - 1] === '\\') return null
  if (beforeCursor.includes('}', open + 1)) return null
  return open + 1
}

export class ReferenceEditorSuggest extends EditorSuggest<ReferenceSuggestion> {
  constructor(
    app: App,
    readonly renderContext: () => RenderContext,
  ) {
    super(app)
  }

  onTrigger(
    cursor: EditorPosition,
    editor: Editor,
  ): EditorSuggestTriggerInfo | null {
    const before = editor.getLine(cursor.line).slice(0, cursor.ch)
    const start = braceQueryStart(before)
    if (start === null) return null
    return {
      start: { line: cursor.line, ch: start },
      end: cursor,
      query: before.slice(start),
    }
  }

  getSuggestions(context: EditorSuggestContext): ReferenceSuggestion[] {
    return suggestReference(context.query, {
      translationIds: this.renderContext().knownTranslationIds,
    })
  }

  renderSuggestion(suggestion: ReferenceSuggestion, el: HTMLElement): void {
    el.setText(suggestion.label)
  }

  selectSuggestion(suggestion: ReferenceSuggestion): void {
    if (!this.context) return
    const { editor, start, end } = this.context
    const from = { line: start.line, ch: start.ch + suggestion.replaceFrom }
    editor.replaceRange(suggestion.insert, from, end)
    editor.setCursor({ line: from.line, ch: from.ch + suggestion.insert.length })
  }
}
