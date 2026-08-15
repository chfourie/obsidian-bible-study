import type { Extension } from '@codemirror/state'
import {
  Decoration,
  EditorView,
  ViewPlugin,
  WidgetType,
  type DecorationSet,
  type ViewUpdate,
} from '@codemirror/view'
import { editorLivePreviewField } from 'obsidian'
import { liveDecorationSpecs } from './live-decoration-specs'
import type { ReferenceRenderModel, RenderContext } from './reference-render-model'
import { renderReference, type ReferenceRenderDeps } from './render-reference'

class ReferenceWidget extends WidgetType {
  constructor(
    private readonly source: string,
    private readonly model: ReferenceRenderModel,
    private readonly deps: ReferenceRenderDeps,
  ) {
    super()
  }

  override eq(other: ReferenceWidget): boolean {
    return other.source === this.source
  }

  override toDOM(): HTMLElement {
    const holder = createSpan({ cls: 'bible-study-reference' })
    void renderReference(holder, this.model, this.deps)
    return holder
  }
}

export const createLivePreviewExtension = (
  contextProvider: () => RenderContext,
  deps: ReferenceRenderDeps,
): Extension => {
  const buildDecorations = (view: EditorView): DecorationSet => {
    if (!view.state.field(editorLivePreviewField)) return Decoration.none
    const docText = view.state.doc.toString()
    const selections = view.state.selection.ranges.map((range) => ({
      from: range.from,
      to: range.to,
    }))
    const specs = liveDecorationSpecs(docText, selections, contextProvider())
    return Decoration.set(
      specs.map((spec) =>
        Decoration.replace({
          widget: new ReferenceWidget(
            docText.slice(spec.start, spec.end),
            spec.model,
            deps,
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
        if (update.docChanged || update.selectionSet || update.viewportChanged) {
          this.decorations = buildDecorations(update.view)
        }
      }
    },
    { decorations: (value) => value.decorations },
  )
}
