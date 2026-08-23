import type { EditorView } from '@codemirror/view'
import {
  MarkdownView,
  Platform,
  type Editor,
  type MarkdownPostProcessorContext,
  type Plugin,
} from 'obsidian'
import {
  NOOP_REFERENCE_NAVIGATOR,
  type ReferenceNavigator,
} from '../contracts'
import { PluginFeature } from '../data-access'
import type { ModuleStore } from '../modules'
import {
  FallbackPassageSource,
  resolveFallbackTranslationId,
} from './fallback-passage-source'
import { attachHighlightEditing } from './highlight-editing'
import {
  createLivePreviewExtension,
  refreshRenderedReferences,
} from './live-preview-extension'
import { ModulePassageSource } from './module-passage-source'
import { ReferenceEditorSuggest } from './reference-editor-suggest'
import type { VaultReferenceIndex } from '../vault-index'
import { PassageRepository } from './passage-repository'
import {
  EMPTY_SECTION,
  processRenderedElement,
  type RenderedSection,
} from './process-rendered-element'
import { renderContextFromSettings } from './render-context'
import type {
  FirstRunInstallDeps,
  ReferenceRenderDeps,
} from './render-reference'

const renderedSection = (
  element: HTMLElement,
  context: MarkdownPostProcessorContext,
): RenderedSection => {
  const info = context.getSectionInfo(element)
  if (!info) return EMPTY_SECTION
  return {
    noteSource: info.text,
    lineStart: info.lineStart,
    lineEnd: info.lineEnd,
  }
}

export class RenderingFeature extends PluginFeature {
  readonly #repository: PassageRepository
  readonly #deps: ReferenceRenderDeps

  constructor(
    plugin: Plugin,
    store: ModuleStore,
    readonly navigator: ReferenceNavigator = NOOP_REFERENCE_NAVIGATOR,
    index?: VaultReferenceIndex,
    firstRun?: FirstRunInstallDeps,
  ) {
    super(plugin)
    this.#repository = new PassageRepository(
      new FallbackPassageSource(
        new ModulePassageSource(store, {
          derivedRedLetter: () => this.settings.derivedRedLetter,
        }),
        () => resolveFallbackTranslationId(this.settings),
      ),
    )
    this.#deps = {
      passages: this.#repository,
      openReference: (model, options) =>
        navigator.openReference(model.reference, model.translationId, options),
      intersections: index && {
        intersecting: (reference) => index.intersectingOccurrences(reference),
        openNote: (file) => navigator.openNote(file),
      },
      firstRun,
    }
  }

  override async load(): Promise<void> {
    this.plugin.registerMarkdownPostProcessor((element, context) =>
      processRenderedElement(
        element,
        renderContextFromSettings(this.settings),
        this.#deps,
        renderedSection(element, context),
        context.sourcePath,
      ),
    )
    this.plugin.registerEditorExtension(
      createLivePreviewExtension(
        () => renderContextFromSettings(this.settings),
        this.#deps,
        // Editing highlights is a Live Preview gesture on desktop; the reading
        // and mobile surfaces get the same passage without the popover.
        Platform.isMobile ? undefined : attachHighlightEditing,
      ),
    )
    this.plugin.registerEditorSuggest(
      new ReferenceEditorSuggest(this.plugin.app, () =>
        renderContextFromSettings(this.settings),
      ),
    )
  }

  override onSettingsChanged(): void {
    this.#repository.clear()
    this.#refreshMarkdownViews()
  }

  #refreshMarkdownViews(): void {
    this.plugin.app.workspace.iterateAllLeaves((leaf) => {
      const view = leaf.view
      if (!(view instanceof MarkdownView)) return
      const editorView = (view.editor as Editor & { cm?: EditorView }).cm
      if (editorView) refreshRenderedReferences(editorView)
      view.previewMode.rerender(true)
    })
  }
}
