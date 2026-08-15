import { MarkdownView, type Plugin } from 'obsidian'
import { PluginFeature } from '../data-access'
import { formatReference, parseReference, type Reference } from '../reference'
import type { VaultReferenceIndex } from '../vault-index'
import { createAnnotation } from './create-annotation'
import { ObsidianAnnotationVault } from './obsidian-annotation-vault'
import { RefPromptModal } from './ref-prompt-modal'

export class AnnotationsFeature extends PluginFeature {
  #prefill: () => Reference | null = () => null

  constructor(
    plugin: Plugin,
    private readonly index: VaultReferenceIndex,
  ) {
    super(plugin)
  }

  usePrefill(prefill: () => Reference | null): void {
    this.#prefill = prefill
  }

  override async load(): Promise<void> {
    this.plugin.addCommand({
      id: 'new-annotation',
      name: 'New annotation',
      callback: () =>
        new RefPromptModal(this.plugin.app, this.prefillRefText(), (text) =>
          this.submitRefText(text),
        ).open(),
    })
  }

  prefillRefText(): string {
    const reference = this.#prefill()
    return reference === null ? '' : formatReference(reference)
  }

  submitRefText(text: string): boolean {
    const parsed = parseReference(text)
    if (parsed === null) return false
    void this.annotate(parsed.reference)
    return true
  }

  async annotate(reference: Reference): Promise<void> {
    const created = await createAnnotation(
      new ObsidianAnnotationVault(this.plugin),
      reference,
      {
        folder: this.settings.annotationsFolder,
        templatePath: this.settings.annotationTemplatePath,
      },
    )
    this.index.indexNote(created.path, created.content)
    await this.#openInSplit(created.path, created.cursorLine)
  }

  async #openInSplit(path: string, cursorLine: number): Promise<void> {
    const file = this.plugin.app.vault.getFileByPath(path)
    if (file === null) return
    const leaf = this.plugin.app.workspace.getLeaf('split')
    await leaf.openFile(file)
    if (leaf.view instanceof MarkdownView)
      leaf.view.editor.setCursor({ line: cursorLine, ch: 0 })
  }
}
