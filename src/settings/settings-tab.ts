import {
  AbstractInputSuggest,
  PluginSettingTab,
  Setting,
  type App,
  type Plugin,
  type TFile,
  type TFolder,
} from 'obsidian'
import type { AnnotationOrdering, BibleStudySettings } from '../data-access'
import { STRONGS_ATTRIBUTION } from '../strongs'
import type {
  SettingsTabModel,
  SettingsTabView,
  TranslationRowView,
} from './settings-tab-model'

const NO_TRANSLATIONS_PLACEHOLDER =
  'No translations installed — see Translations below'

class FolderSuggest extends AbstractInputSuggest<TFolder> {
  constructor(
    app: App,
    inputEl: HTMLInputElement,
    onPick: (path: string) => void,
  ) {
    super(app, inputEl)
    this.onSelect((folder) => {
      this.setValue(folder.path)
      onPick(folder.path)
      this.close()
    })
  }

  protected getSuggestions(query: string): TFolder[] {
    return this.app.vault
      .getAllFolders()
      .filter((folder) =>
        folder.path.toLowerCase().includes(query.toLowerCase()),
      )
  }

  renderSuggestion(folder: TFolder, el: HTMLElement): void {
    el.setText(folder.path)
  }
}

class FileSuggest extends AbstractInputSuggest<TFile> {
  constructor(
    app: App,
    inputEl: HTMLInputElement,
    onPick: (path: string) => void,
  ) {
    super(app, inputEl)
    this.onSelect((file) => {
      this.setValue(file.path)
      onPick(file.path)
      this.close()
    })
  }

  protected getSuggestions(query: string): TFile[] {
    return this.app.vault
      .getMarkdownFiles()
      .filter((file) => file.path.toLowerCase().includes(query.toLowerCase()))
  }

  renderSuggestion(file: TFile, el: HTMLElement): void {
    el.setText(file.path)
  }
}

export class BibleStudySettingTab extends PluginSettingTab {
  #unsubscribe: (() => void) | null = null

  constructor(
    plugin: Plugin,
    private readonly model: SettingsTabModel,
  ) {
    super(plugin.app, plugin)
  }

  override display(): void {
    this.#unsubscribe ??= this.model.subscribe(() => this.#render())
    this.#render()
    void this.model.refresh()
  }

  override hide(): void {
    this.#unsubscribe?.()
    this.#unsubscribe = null
  }

  #update(update: (settings: BibleStudySettings) => BibleStudySettings): void {
    void this.model.updateSettings(update)
  }

  #render(): void {
    const view = this.model.view
    this.containerEl.empty()
    this.#renderGeneral(view)
    this.#renderTranslations(view)
    this.#renderStrongs(view)
    this.#renderReader(view)
    this.#renderAnnotations(view)
  }

  #renderGeneral(view: SettingsTabView): void {
    this.#translationPicker(
      'Default translation',
      'Used when a reference names no translation.',
      view.defaultTranslationOptions,
      view.settings.defaultTranslationId,
      (translationId) =>
        this.#update((settings) => ({
          ...settings,
          defaultTranslationId: translationId,
        })),
    )
    this.#translationPicker(
      'Offline fallback translation',
      'Served, clearly labeled, when the requested translation is unavailable.',
      view.fallbackTranslationOptions,
      view.settings.fallbackTranslationId,
      (translationId) =>
        this.#update((settings) => ({
          ...settings,
          fallbackTranslationId: translationId,
        })),
    )
  }

  #translationPicker(
    name: string,
    desc: string,
    options: { id: string; label: string }[],
    current: string | null,
    onChange: (translationId: string) => void,
  ): void {
    const setting = new Setting(this.containerEl).setName(name).setDesc(desc)
    if (options.length === 0) {
      setting.addDropdown((dropdown) =>
        dropdown
          .addOption('', NO_TRANSLATIONS_PLACEHOLDER)
          .setValue('')
          .setDisabled(true),
      )
      return
    }
    setting.addDropdown((dropdown) => {
      options.forEach((option) => {
        dropdown.addOption(option.id, option.label)
      })
      dropdown
        .setValue(current ?? options[0].id)
        .onChange((translationId) => onChange(translationId))
    })
  }

  #renderTranslations(view: SettingsTabView): void {
    new Setting(this.containerEl).setName('Translations').setHeading()
    new Setting(this.containerEl)
      .setName('API.Bible key')
      .setDesc(
        'Unlocks the online tier (licensed translations, fetched per passage). ' +
          "Stored as plain text in this plugin's data.json — remove the key " +
          'before publishing or sharing your vault.',
      )
      .addText((text) => {
        text.inputEl.type = 'password'
        text
          .setPlaceholder('API key')
          .setValue(view.settings.apiBibleKey ?? '')
        text.inputEl.addEventListener('change', () => {
          void this.model.setApiBibleKey(text.inputEl.value)
        })
      })
    new Setting(this.containerEl)
      .setName('Language')
      .setDesc('Filters the downloadable list.')
      .addDropdown((dropdown) => {
        const languages = new Set([
          ...view.languages,
          view.settings.languageFilter,
        ])
        ;[...languages].sort().forEach((language) => {
          dropdown.addOption(language, language)
        })
        dropdown
          .setValue(view.settings.languageFilter)
          .onChange((language) => void this.model.setLanguageFilter(language))
      })

    const downloadable = view.rows.filter((row) => row.tier === 'downloadable')
    const online = view.rows.filter((row) => row.tier === 'online')
    new Setting(this.containerEl).setName('Downloadable — free').setHeading()
    downloadable.forEach((row) => this.#renderDownloadableRow(row))
    if (online.length > 0) {
      new Setting(this.containerEl)
        .setName('Online — requires key')
        .setHeading()
      online.forEach((row) => this.#renderOnlineRow(row))
    }
  }

  #rowSetting(row: TranslationRowView): Setting {
    const setting = new Setting(this.containerEl).setName(row.name)
    if (row.strongsTagged) {
      setting.nameEl.createSpan({
        cls: 'bible-study-strongs-badge',
        text: "Strong's",
      })
    }
    if (row.error !== null) {
      setting.descEl.createDiv({
        cls: 'bible-study-settings-error',
        text: row.error,
      })
    }
    return setting
  }

  #renderDownloadableRow(row: TranslationRowView): void {
    const setting = this.#rowSetting(row)
    if (row.busy !== null) {
      setting.addButton((button) =>
        button
          .setButtonText(
            row.busy === 'downloading' ? 'Downloading…' : 'Deleting…',
          )
          .setDisabled(true),
      )
      return
    }
    if (!row.installed) {
      setting.addButton((button) =>
        button
          .setButtonText('Download')
          .setCta()
          .onClick(() => void this.model.download(row.id)),
      )
      return
    }
    if (row.updateAvailable) {
      setting.addButton((button) =>
        button
          .setButtonText('Update')
          .setCta()
          .onClick(() => void this.model.download(row.id)),
      )
    }
    setting.addButton((button) =>
      button
        .setButtonText('Delete')
        .setDestructive()
        .onClick(() => void this.model.remove(row.id)),
    )
  }

  #renderOnlineRow(row: TranslationRowView): void {
    const setting = this.#rowSetting(row)
    setting.setDesc(
      'Fetched per passage with your key; cached passages expire after 14 days.',
    )
    setting.addExtraButton((button) =>
      button
        .setIcon('eraser')
        .setTooltip('Clear cached passages')
        .onClick(() => void this.model.clearCache(row.id)),
    )
    setting.addToggle((toggle) =>
      toggle
        .setValue(row.enabled)
        .onChange((enabled) => void this.model.setOnlineEnabled(row.id, enabled)),
    )
  }

  #renderStrongs(view: SettingsTabView): void {
    new Setting(this.containerEl).setName("Strong's").setHeading()
    const setting = new Setting(this.containerEl)
      .setName("Enable Strong's")
      .setDesc(
        "Downloads the Strong's Dictionaries module. " + STRONGS_ATTRIBUTION,
      )
      .addToggle((toggle) =>
        toggle
          .setValue(view.strongsInstalled)
          .setDisabled(view.strongsBusy)
          .onChange((enabled) => void this.model.setStrongsEnabled(enabled)),
      )
    if (view.strongsError !== null) {
      setting.descEl.createDiv({
        cls: 'bible-study-settings-error',
        text: view.strongsError,
      })
    }
    if (!view.taggedTranslationInstalled) {
      setting.descEl.createDiv({
        text: "Strong's mode needs a translation with the Strong's badge — install one under Translations (e.g. Berean Standard Bible).",
      })
    }
  }

  #renderReader(view: SettingsTabView): void {
    new Setting(this.containerEl).setName('Reader defaults').setHeading()
    this.#readerToggle(view, 'Details', 'readerDetailsDefault', {
      inline: 'Inline expand',
      'side-panel': 'Side panel',
    })
    this.#readerToggle(view, 'Navigation', 'readerNavDefault', {
      tree: 'Tree panel',
      breadcrumb: 'Breadcrumbs',
    })
    this.#readerToggle(view, 'Layout', 'readerLayoutDefault', {
      'verse-per-line': 'Verse per line',
      continuous: 'Continuous prose',
    })
    this.#readerToggle(view, "Strong's mode", 'readerStrongsDefault', {
      off: 'Off',
      on: 'On',
    })
  }

  #readerToggle<
    Key extends
      | 'readerDetailsDefault'
      | 'readerNavDefault'
      | 'readerLayoutDefault'
      | 'readerStrongsDefault',
  >(
    view: SettingsTabView,
    name: string,
    key: Key,
    labels: Record<BibleStudySettings[Key], string>,
  ): void {
    new Setting(this.containerEl)
      .setName(name)
      .setDesc('Seeds new reader panes; in-pane switches stay per pane.')
      .addDropdown((dropdown) => {
        Object.entries<string>(labels).forEach(([value, label]) => {
          dropdown.addOption(value, label)
        })
        dropdown
          .setValue(view.settings[key])
          .onChange((value) =>
            this.#update((settings) => ({ ...settings, [key]: value })),
          )
      })
  }

  #renderAnnotations(view: SettingsTabView): void {
    new Setting(this.containerEl).setName('Annotations').setHeading()
    new Setting(this.containerEl)
      .setName('Folder')
      .setDesc('Where new annotation notes are created.')
      .addText((text) => {
        text.setPlaceholder('Annotations').setValue(view.settings.annotationsFolder)
        new FolderSuggest(this.app, text.inputEl, (path) =>
          this.#update((settings) => ({ ...settings, annotationsFolder: path })),
        )
        text.inputEl.addEventListener('change', () =>
          this.#update((settings) => ({
            ...settings,
            annotationsFolder: text.inputEl.value.trim() || 'Annotations',
          })),
        )
      })
    new Setting(this.containerEl)
      .setName('Template file')
      .setDesc('Copied into new annotation notes; leave empty for none.')
      .addText((text) => {
        text
          .setPlaceholder('None')
          .setValue(view.settings.annotationTemplatePath ?? '')
        new FileSuggest(this.app, text.inputEl, (path) =>
          this.#update((settings) => ({
            ...settings,
            annotationTemplatePath: path,
          })),
        )
        text.inputEl.addEventListener('change', () =>
          this.#update((settings) => ({
            ...settings,
            annotationTemplatePath: text.inputEl.value.trim() || null,
          })),
        )
      })
    new Setting(this.containerEl)
      .setName('Display ordering')
      .setDesc('Order of annotations in the reader details surface.')
      .addDropdown((dropdown) =>
        dropdown
          .addOption('created-oldest-first', 'Creation date, oldest first')
          .addOption('path-a-z', 'File path, A to Z')
          .setValue(view.settings.annotationOrdering)
          .onChange((ordering) =>
            this.#update((settings) => ({
              ...settings,
              annotationOrdering: ordering as AnnotationOrdering,
            })),
          ),
      )
  }
}
