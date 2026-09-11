import { StateEffect, type Extension, type Range } from '@codemirror/state'
import {
  Decoration,
  EditorView,
  ViewPlugin,
  WidgetType,
  type DecorationSet,
  type ViewUpdate,
} from '@codemirror/view'
import { editorInfoField, editorLivePreviewField } from 'obsidian'
import { rewriteCueTokens } from '../highlights'
import type { HighlightCue } from '../reference'
import type {
  HighlightCueWriter,
  HighlightEditContext,
} from './highlight-editing'
import {
  liveDecorationSpecs,
  type LiveDecorationSpec,
} from './live-decoration-specs'
import { renderPageBreakIndicator } from './page-break-indicator'
import { RED_LETTER_CLASS } from './red-letter'
import {
  sameRenderModel,
  type ReferenceRenderModel,
  type RenderContext,
} from './reference-render-model'
import { renderReference, type ReferenceRenderDeps } from './render-reference'

const RED_LETTER_DECORATION = Decoration.mark({ class: RED_LETTER_CLASS })

const HIDDEN_PREFIX = Decoration.replace({})

export const renderContextChangedEffect = StateEffect.define<null>()

export const refreshRenderedReferences = (view: EditorView): void =>
  view.dispatch({ effects: renderContextChangedEffect.of(null) })

// Editing highlights needs the document position of the token the widget
// replaced; the widget owns that, so it hands the popover a writer that turns
// a fresh cue set back into note text.
export type HighlightEditingSupport = (
  host: HTMLElement,
  context: HighlightEditContext,
  write: HighlightCueWriter,
) => () => void

type WidgetHighlightEditing = {
  attach: HighlightEditingSupport
  translationIds: () => readonly string[]
}

// Cues belong to the one occurrence the widget replaced. A position that does
// not spell the token out is abandoned rather than searched around: an
// identical token elsewhere in the note is a different occurrence.
export const verifiedTokenStart = (
  doc: string,
  position: number,
  source: string,
): number | null =>
  doc.slice(position, position + source.length) === source ? position : null

const tokenStart = (
  view: EditorView,
  holder: HTMLElement,
  source: string,
): number | null =>
  verifiedTokenStart(view.state.doc.toString(), view.posAtDOM(holder), source)

export class ReferenceWidget extends WidgetType {
  #detachEditing: (() => void) | null = null

  constructor(
    private readonly source: string,
    private readonly model: ReferenceRenderModel,
    private readonly deps: ReferenceRenderDeps,
    private readonly sourcePath: string | null = null,
    private readonly editing: WidgetHighlightEditing | null = null,
  ) {
    super()
  }

  override eq(other: ReferenceWidget): boolean {
    return (
      other.source === this.source &&
      other.sourcePath === this.sourcePath &&
      sameRenderModel(other.model, this.model)
    )
  }

  override toDOM(view: EditorView): HTMLElement {
    const holder = createSpan({ cls: 'scripture-study-reference' })
    void renderReference(
      holder,
      this.model,
      this.#renderDeps(view, holder),
      this.sourcePath,
    )
    return holder
  }

  override destroy(): void {
    this.#detachEditing?.()
    this.#detachEditing = null
  }

  #renderDeps(view: EditorView, holder: HTMLElement): ReferenceRenderDeps {
    const editing = this.editing
    if (editing === null) return this.deps
    return {
      ...this.deps,
      editHighlights: (host, context) => {
        this.#detachEditing?.()
        this.#detachEditing = editing.attach(host, context, (cues) =>
          this.#writeCues(view, holder, cues, editing.translationIds()),
        )
      },
    }
  }

  #writeCues(
    view: EditorView,
    holder: HTMLElement,
    cues: readonly HighlightCue[],
    translationIds: readonly string[],
  ): void {
    const start = tokenStart(view, holder, this.source)
    if (start === null) return
    const rewritten = rewriteCueTokens(
      this.source.slice(1, -1),
      {
        highlights: cues,
        underlines: this.model.underlines,
        excerpt: this.model.excerpt,
      },
      { translation: this.model.translationId, translationIds },
    )
    view.dispatch({
      changes: {
        from: start,
        to: start + this.source.length,
        insert: `{${rewritten}}`,
      },
    })
  }
}

// CodeMirror lets no view plugin add block decorations, so the indicator
// replaces the marker line's text as an inline widget; the cursor can still
// land at either end of the line, and the raw text returns while it does. A
// click on the indicator is left to the editor for the same reason.
export class PageBreakWidget extends WidgetType {
  constructor(private readonly trailing: boolean) {
    super()
  }

  override eq(other: PageBreakWidget): boolean {
    return other.trailing === this.trailing
  }

  override toDOM(): HTMLElement {
    return renderPageBreakIndicator(this.trailing)
  }

  override ignoreEvent(): boolean {
    return false
  }
}

const hasRenderContextChange = (update: ViewUpdate): boolean =>
  update.transactions.some((transaction) =>
    transaction.effects.some((effect) =>
      effect.is(renderContextChangedEffect),
    ),
  )

const livePreviewToggled = (update: ViewUpdate): boolean =>
  update.state.field(editorLivePreviewField) !==
  update.startState.field(editorLivePreviewField)

export const createLivePreviewExtension = (
  contextProvider: () => RenderContext,
  deps: ReferenceRenderDeps,
  highlightEditing?: HighlightEditingSupport,
): Extension => {
  const editing: WidgetHighlightEditing | null =
    highlightEditing === undefined
      ? null
      : {
          attach: highlightEditing,
          translationIds: () => contextProvider().knownTranslationIds,
        }
  const buildDecorations = (view: EditorView): DecorationSet => {
    if (!view.state.field(editorLivePreviewField)) return Decoration.none
    const selections = view.state.selection.ranges.map((range) => ({
      from: range.from,
      to: range.to,
    }))
    const sourcePath =
      view.state.field(editorInfoField, false)?.file?.path ?? null
    const decorate = (spec: LiveDecorationSpec): Range<Decoration>[] => {
      switch (spec.kind) {
        case 'reference':
          return [
            Decoration.replace({
              widget: new ReferenceWidget(
                view.state.sliceDoc(spec.start, spec.end),
                spec.model,
                deps,
                sourcePath,
                editing,
              ),
            }).range(spec.start, spec.end),
          ]
        case 'christ-quote':
          return [
            ...(spec.prefixHidden
              ? [HIDDEN_PREFIX.range(spec.prefix, spec.prefix + 1)]
              : []),
            RED_LETTER_DECORATION.range(spec.start, spec.end),
          ]
        case 'page-break':
          return [
            Decoration.replace({
              widget: new PageBreakWidget(spec.trailing),
            }).range(spec.start, spec.end),
          ]
      }
    }
    const specs = liveDecorationSpecs(
      view.state.doc.toString(),
      view.visibleRanges,
      selections,
      contextProvider(),
    )
    // Quote and Page Break ranges follow the reference ranges, so the
    // concatenation is not in offset order; let the set sort it.
    return Decoration.set(specs.flatMap(decorate), true)
  }

  return ViewPlugin.fromClass(
    class {
      decorations: DecorationSet

      constructor(view: EditorView) {
        this.decorations = buildDecorations(view)
      }

      update(update: ViewUpdate): void {
        if (
          update.docChanged ||
          update.selectionSet ||
          update.viewportChanged ||
          livePreviewToggled(update) ||
          hasRenderContextChange(update)
        ) {
          this.decorations = buildDecorations(update.view)
        }
      }
    },
    { decorations: (value) => value.decorations },
  )
}
