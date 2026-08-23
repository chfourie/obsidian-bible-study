import { Modal, type App } from 'obsidian'
import type { WordCloudWordView } from '../contracts'

// Confirms an exclusion before it lands in settings: the word is named as
// the cloud shows it, and the way back is spelled out.
export class ExcludeCloudWordModal extends Modal {
  constructor(
    app: App,
    private readonly word: WordCloudWordView,
    private readonly confirm: () => void,
  ) {
    super(app)
  }

  override onOpen(): void {
    const { word } = this
    const shown = word.rendering === '' ? word.gloss : word.rendering
    this.titleEl.setText('Exclude from word cloud')
    this.contentEl.createEl('p', {
      text: `Leave "${shown}" (${word.family}) out of every chapter's word cloud? It can be brought back under Settings › Word cloud.`,
    })
    const buttons = this.contentEl.createDiv({ cls: 'modal-button-container' })
    buttons
      .createEl('button', { text: 'Exclude', cls: 'mod-warning' })
      .addEventListener('click', () => {
        this.confirm()
        this.close()
      })
    buttons
      .createEl('button', { text: 'Cancel' })
      .addEventListener('click', () => this.close())
  }

  override onClose(): void {
    this.contentEl.empty()
  }
}
