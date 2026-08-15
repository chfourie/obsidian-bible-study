import type { MarkdownPostProcessorContext, Plugin } from 'obsidian'
import {
  NOOP_REFERENCE_NAVIGATOR,
  type ReferenceNavigator,
} from '../contracts'
import { PluginFeature } from '../data-access'
import type { ModuleStore } from '../modules'
import { createLivePreviewExtension } from './live-preview-extension'
import { ModulePassageSource } from './module-passage-source'
import { PassageRepository } from './passage-repository'
import {
  escapedReferenceInners,
  processRenderedElement,
} from './process-rendered-element'
import { renderContextFromSettings } from './render-context'
import type { ReferenceRenderDeps } from './render-reference'

const sectionSource = (
  element: HTMLElement,
  context: MarkdownPostProcessorContext,
): string => {
  const info = context.getSectionInfo(element)
  if (!info) return ''
  return info.text
    .split('\n')
    .slice(info.lineStart, info.lineEnd + 1)
    .join('\n')
}

export class RenderingFeature extends PluginFeature {
  readonly #repository: PassageRepository
  readonly #deps: ReferenceRenderDeps

  constructor(
    plugin: Plugin,
    store: ModuleStore,
    navigator: ReferenceNavigator = NOOP_REFERENCE_NAVIGATOR,
  ) {
    super(plugin)
    this.#repository = new PassageRepository(new ModulePassageSource(store))
    this.#deps = {
      passages: this.#repository,
      openReference: (model) =>
        navigator.openReference(model.reference, model.translationId),
    }
  }

  override async load(): Promise<void> {
    this.plugin.registerMarkdownPostProcessor((element, context) =>
      processRenderedElement(
        element,
        renderContextFromSettings(this.settings),
        this.#deps,
        escapedReferenceInners(sectionSource(element, context)),
      ),
    )
    this.plugin.registerEditorExtension(
      createLivePreviewExtension(
        () => renderContextFromSettings(this.settings),
        this.#deps,
      ),
    )
  }

  override onExternalSettingsChange(): void {
    this.#repository.clear()
  }
}
