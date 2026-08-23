import { Modal, type App } from 'obsidian'
import type { WordCloudWordView } from '../contracts'
import type { SettingsStore } from '../data-access'

// Asks before a family joins the user's Cloud Exclusions, since that list
// hides the word from every cloud until it is pruned in the settings tab.
export class CloudExclusionModal extends Modal {
  constructor(
    app: App,
    private readonly word: WordCloudWordView,
    private readonly confirm: () => void,
  ) {
    super(app)
  }

  override onOpen(): void {
    this.titleEl.setText('Exclude everywhere?')
    this.contentEl.createEl('p', {
      text:
        `"${this.word.rendering}" (${this.word.family}, ${this.word.gloss}) ` +
        'will be left out of the Top Words of every chapter until you ' +
        'remove it from the excluded words in settings.',
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

// Puts a family on the user's Cloud Exclusions once the user confirms.
export const cloudExclusionEditor = (
  app: App,
  settingsStore: Pick<SettingsStore, 'updateSettings'>,
) => ({
  confirmAndExclude: (word: WordCloudWordView): void => {
    new CloudExclusionModal(app, word, () => {
      void settingsStore.updateSettings((settings) => ({
        ...settings,
        wordCloudExclusions: settings.wordCloudExclusions.includes(word.family)
          ? settings.wordCloudExclusions
          : [...settings.wordCloudExclusions, word.family],
      }))
    }).open()
  },
})
