import { StateEffect, type Extension } from '@codemirror/state'
import {
  Decoration,
  EditorView,
  ViewPlugin,
  WidgetType,
  type DecorationSet,
  type ViewUpdate,
} from '@codemirror/view'
import { editorInfoField, editorLivePreviewField } from 'obsidian'
import { liveDecorationSpecs } from './live-decoration-specs'
import {
  sameRenderModel,
  type ReferenceRenderModel,
  type RenderContext,
} from './reference-render-model'
import { renderReference, type ReferenceRenderDeps } from './render-reference'

export const renderContextChangedEffect = StateEffect.define<null>()

export const refreshRenderedReferences = (view: EditorView): void =>
  view.dispatch({ effects: renderContextChangedEffect.of(null) })

export class ReferenceWidget extends WidgetType {
  constructor(
    private readonly source: string,
    private readonly model: ReferenceRenderModel,
    private readonly deps: ReferenceRenderDeps,
    private readonly sourcePath: string | null = null,
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

  override toDOM(): HTMLElement {
    const holder = createSpan({ cls: 'scripture-study-reference' })
    void renderReference(holder, this.model, this.deps, this.sourcePath)
    return holder
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
): Extension => {
  const buildDecorations = (view: EditorView): DecorationSet => {
    if (!view.state.field(editorLivePreviewField)) return Decoration.none
    const selections = view.state.selection.ranges.map((range) => ({
      from: range.from,
      to: range.to,
    }))
    const sourcePath =
      view.state.field(editorInfoField, false)?.file?.path ?? null
    const specs = liveDecorationSpecs(
      view.state.doc.toString(),
      view.visibleRanges,
      selections,
      contextProvider(),
    )
    return Decoration.set(
      specs.map((spec) =>
        Decoration.replace({
          widget: new ReferenceWidget(
            view.state.sliceDoc(spec.start, spec.end),
            spec.model,
            deps,
            sourcePath,
          ),
        }).range(spec.start, spec.end),
      ),
    )
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
