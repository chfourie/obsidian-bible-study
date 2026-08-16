import {
  PluginSettingTab,
  type Plugin,
  type Setting,
  type SettingDefinitionControl,
  type SettingDefinitionGroup,
  type SettingDefinitionItem,
  type SettingDefinitionPage,
  type TFile,
} from 'obsidian'
import type { AnnotationOrdering, ScriptureStudySettings } from '../data-access'
import { STRONGS_ATTRIBUTION } from '../strongs'
import type {
  SettingsTabModel,
  SettingsTabView,
  TranslationOption,
  TranslationRowView,
} from './settings-tab-model'

const NO_TRANSLATIONS_PLACEHOLDER =
  'No translations installed — see Translations below'

const READER_DEFAULT_DESC =
  'Seeds new reader panes; in-pane switches stay per pane.'

type SettingsControlKey =
  | 'defaultTranslationId'
  | 'fallbackTranslationId'
  | 'languageFilter'
  | 'strongsEnabled'
  | 'readerDetailsDefault'
  | 'readerNavDefault'
  | 'readerLayoutDefault'
  | 'readerStrongsDefault'
  | 'annotationsFolder'
  | 'annotationTemplatePath'
  | 'annotationOrdering'

type ReaderDefaultKey = Extract<SettingsControlKey, `reader${string}`>

export class ScriptureStudySettingTab extends PluginSettingTab {
  #unsubscribe: (() => void) | null = null
  #catalogLoadedThisOpen = false
  #updateQueuedBehindFocusedInput = false
  #renderedStructureSignature: string | null = null

  constructor(
    plugin: Plugin,
    private readonly model: SettingsTabModel,
  ) {
    super(plugin.app, plugin)
  }

  // Obsidian ≥1.13 renders the tab declaratively: addSettingTab() calls
  // update() → getSettingDefinitions() with a detached containerEl to index
  // the tab for settings search, and that call must not refresh — refreshing
  // hits the network at plugin load. The bootstrap — subscribe and kick a
  // refresh, torn down again in hide() — therefore runs on the first call
  // that arrives with the tab on screen.
  //
  // WORKAROUND (Obsidian 1.13.7, remove when fixed upstream): opening the
  // tab does not call getSettingDefinitions() — renderTab() reuses the
  // settingItems cached by the index-time update() whenever they are
  // non-empty, so this method alone never sees a connected containerEl and
  // the bootstrap would never run. getControlValue() IS called for every
  // control on each on-screen render, so it doubles as the open hook below.
  // The workaround is removable once a per-open callback exists or open
  // re-invokes getSettingDefinitions(); see docs/adr/0002.
  override getSettingDefinitions(): SettingDefinitionItem<SettingsControlKey>[] {
    this.#bootstrapWhenOnScreen()
    const view = this.model.view
    return [
      this.#translationPicker(
        'Default translation',
        'Used when a reference names no translation.',
        'defaultTranslationId',
        view.defaultTranslationOptions,
      ),
      this.#translationPicker(
        'Offline fallback translation',
        'Served, clearly labeled, when the requested translation is unavailable.',
        'fallbackTranslationId',
        view.fallbackTranslationOptions,
      ),
      this.#translationsPage(view),
      this.#strongsGroup(view),
      this.#readerGroup(),
      this.#annotationsGroup(),
    ]
  }

  override hide(): void {
    this.#unsubscribe?.()
    this.#unsubscribe = null
    this.#catalogLoadedThisOpen = false
    this.#renderedStructureSignature = null
  }

  #bootstrapWhenOnScreen(): void {
    if (this.#unsubscribe !== null || !this.containerEl.isConnected) return
    this.#unsubscribe = this.model.subscribe(() => this.update())
    void this.model.refreshLocal()
  }

  // The catalogue fetch is deferred to the Translations sub-page: the
  // languageFilter control renders only there, so its value read doubles as
  // the page-open hook (same render-time hook as #bootstrapWhenOnScreen).
  // Once per settings-open cycle — re-entering the page reuses the loaded
  // catalogue; hide() rearms it.
  #loadCatalogOnTranslationsPageRender(): void {
    if (this.#catalogLoadedThisOpen || !this.containerEl.isConnected) return
    this.#catalogLoadedThisOpen = true
    void this.model.refreshCatalog()
  }

  override getControlValue(key: string): unknown {
    this.#bootstrapWhenOnScreen()
    if ((key as SettingsControlKey) === 'languageFilter')
      this.#loadCatalogOnTranslationsPageRender()
    const view = this.model.view
    const settings = view.settings
    switch (key as SettingsControlKey) {
      case 'defaultTranslationId':
        return (
          settings.defaultTranslationId ??
          view.defaultTranslationOptions[0]?.id ??
          ''
        )
      case 'fallbackTranslationId':
        return (
          settings.fallbackTranslationId ??
          view.fallbackTranslationOptions[0]?.id ??
          ''
        )
      case 'languageFilter':
        return settings.languageFilter
      case 'strongsEnabled':
        return view.strongsInstalled
      case 'readerDetailsDefault':
      case 'readerNavDefault':
      case 'readerLayoutDefault':
      case 'readerStrongsDefault':
        return settings[key as ReaderDefaultKey]
      case 'annotationsFolder':
        return settings.annotationsFolder
      case 'annotationTemplatePath':
        return settings.annotationTemplatePath ?? ''
      case 'annotationOrdering':
        return settings.annotationOrdering
    }
  }

  override setControlValue(key: string, value: unknown): void | Promise<void> {
    switch (key as SettingsControlKey) {
      case 'defaultTranslationId':
        return this.#update((settings) => ({
          ...settings,
          defaultTranslationId: value as string,
        }))
      case 'fallbackTranslationId':
        return this.#update((settings) => ({
          ...settings,
          fallbackTranslationId: value as string,
        }))
      case 'languageFilter':
        return this.model.setLanguageFilter(value as string)
      case 'strongsEnabled':
        return this.model.setStrongsEnabled(value === true)
      case 'readerDetailsDefault':
      case 'readerNavDefault':
      case 'readerLayoutDefault':
      case 'readerStrongsDefault':
        return this.#update((settings) => ({ ...settings, [key]: value }))
      case 'annotationsFolder':
        return this.#update((settings) => ({
          ...settings,
          annotationsFolder: (value as string).trim() || 'Annotations',
        }))
      case 'annotationTemplatePath':
        return this.#update((settings) => ({
          ...settings,
          annotationTemplatePath: (value as string).trim() || null,
        }))
      case 'annotationOrdering':
        return this.#update((settings) => ({
          ...settings,
          annotationOrdering: value as AnnotationOrdering,
        }))
    }
  }

  #update(update: (settings: ScriptureStudySettings) => ScriptureStudySettings): void {
    void this.model.updateSettings(update)
  }

  // Rebuilding the tab while the user is typing would wipe their unsaved
  // text (values persist only on change/blur), so an update arriving while a
  // text input has focus waits for the blur.
  //
  // A rebuild is also skipped when the tab's structure is unchanged — the
  // model notifies on every persisted value, but the control the user touched
  // already shows the new value, and emptying the container would clamp the
  // settings scroller back to the top.
  override update(): void {
    const focusedInput = this.#focusedTextInput()
    if (focusedInput !== null) {
      this.#queueUpdateAfterBlur(focusedInput)
      return
    }
    this.#updateQueuedBehindFocusedInput = false
    const signature = this.#structureSignature()
    if (signature === this.#renderedStructureSignature) return
    this.#renderedStructureSignature = signature
    const scroller = this.#scrolledAncestor()
    const scrollTop = scroller?.scrollTop ?? 0
    super.update()
    if (scroller !== null) scroller.scrollTop = scrollTop
  }

  // Everything that shapes the rendered tree except the per-control values:
  // rows, option lists, languages, Strong's state — plus the language filter,
  // which feeds its own dropdown's option list.
  #structureSignature(): string {
    const { settings, ...structure } = this.model.view
    return JSON.stringify({
      ...structure,
      languageFilter: settings.languageFilter,
    })
  }

  #scrolledAncestor(): HTMLElement | null {
    for (
      let el: HTMLElement | null = this.containerEl;
      el !== null;
      el = el.parentElement
    ) {
      if (el.scrollTop > 0) return el
    }
    return null
  }

  #focusedTextInput(): HTMLInputElement | null {
    const active = this.containerEl.ownerDocument.activeElement
    const isTextInput =
      active instanceof HTMLInputElement &&
      (active.type === 'text' || active.type === 'password')
    return isTextInput && this.containerEl.contains(active) ? active : null
  }

  #queueUpdateAfterBlur(input: HTMLInputElement): void {
    if (this.#updateQueuedBehindFocusedInput) return
    this.#updateQueuedBehindFocusedInput = true
    input.addEventListener('blur', () => this.update(), { once: true })
  }

  #translationPicker(
    name: string,
    desc: string,
    key: Extract<SettingsControlKey, `${string}TranslationId`>,
    options: TranslationOption[],
  ): SettingDefinitionControl<SettingsControlKey> {
    if (options.length === 0) {
      return {
        name,
        desc,
        control: {
          type: 'dropdown',
          key,
          options: { '': NO_TRANSLATIONS_PLACEHOLDER },
          disabled: true,
        },
      }
    }
    return {
      name,
      desc,
      control: {
        type: 'dropdown',
        key,
        options: Object.fromEntries(
          options.map((option) => [option.id, option.label]),
        ),
      },
    }
  }

  #translationsPage(
    view: SettingsTabView,
  ): SettingDefinitionPage<SettingsControlKey> {
    const languages = [
      ...new Set([...view.languages, view.settings.languageFilter]),
    ].sort()
    return {
      type: 'page',
      name: 'Translations',
      desc: 'Download and manage translation modules.',
      items: [
        {
          name: 'Language',
          desc: 'Filters the translation list.',
          control: {
            type: 'dropdown',
            key: 'languageFilter',
            options: Object.fromEntries(
              languages.map((language) => [language, language]),
            ),
          },
        },
        ...view.rows.map((row) => ({
          name: row.name,
          render: (setting: Setting) => this.#renderTranslationRow(setting, row),
        })),
      ],
    }
  }

  #decorateRow(setting: Setting, row: TranslationRowView): void {
    if (row.strongsTagged) {
      setting.nameEl.createSpan({
        cls: 'scripture-study-strongs-badge',
        text: "Strong's",
      })
    }
    if (row.error !== null) {
      setting.descEl.createDiv({
        cls: 'scripture-study-settings-error',
        text: row.error,
      })
    }
  }

  #renderTranslationRow(setting: Setting, row: TranslationRowView): void {
    this.#decorateRow(setting, row)
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
    } else if (row.redownloadable) {
      // bolls publishes no checksums, so there is no update detection for
      // catalogue modules — updating one is an ordinary re-download.
      setting.addButton((button) =>
        button
          .setButtonText('Re-download')
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

  #strongsGroup(
    view: SettingsTabView,
  ): SettingDefinitionGroup<SettingsControlKey> {
    return {
      type: 'group',
      heading: "Strong's",
      items: [
        {
          name: "Enable Strong's",
          desc: this.#strongsDesc(view),
          control: {
            type: 'toggle',
            key: 'strongsEnabled',
            disabled: view.strongsBusy,
          },
        },
      ],
    }
  }

  #strongsDesc(view: SettingsTabView): string | DocumentFragment {
    const base =
      "Downloads the Strong's Dictionaries module. " + STRONGS_ATTRIBUTION
    if (view.strongsError === null && view.taggedTranslationInstalled) {
      return base
    }
    const fragment = createFragment()
    fragment.append(base)
    if (view.strongsError !== null) {
      fragment.append(
        createDiv({
          cls: 'scripture-study-settings-error',
          text: view.strongsError,
        }),
      )
    }
    if (!view.taggedTranslationInstalled) {
      fragment.append(
        createDiv({
          text: "Strong's mode needs a translation with the Strong's badge — install one under Translations (e.g. Berean Standard Bible).",
        }),
      )
    }
    return fragment
  }

  #readerGroup(): SettingDefinitionGroup<SettingsControlKey> {
    return {
      type: 'group',
      heading: 'Reader defaults',
      items: [
        this.#readerDefault('Details', 'readerDetailsDefault', {
          inline: 'Inline expand',
          'side-panel': 'Side panel',
        }),
        this.#readerDefault('Navigation', 'readerNavDefault', {
          tree: 'Tree panel',
          breadcrumb: 'Breadcrumbs',
        }),
        this.#readerDefault('Layout', 'readerLayoutDefault', {
          'verse-per-line': 'Verse per line',
          continuous: 'Continuous prose',
        }),
        this.#readerDefault("Strong's mode", 'readerStrongsDefault', {
          off: 'Off',
          on: 'On',
        }),
      ],
    }
  }

  #readerDefault<Key extends ReaderDefaultKey>(
    name: string,
    key: Key,
    labels: Record<ScriptureStudySettings[Key], string>,
  ): SettingDefinitionControl<SettingsControlKey> {
    return {
      name,
      desc: READER_DEFAULT_DESC,
      control: { type: 'dropdown', key, options: labels },
    }
  }

  #annotationsGroup(): SettingDefinitionGroup<SettingsControlKey> {
    return {
      type: 'group',
      heading: 'Annotations',
      items: [
        {
          name: 'Folder',
          desc: 'Where new annotation notes are created.',
          control: {
            type: 'folder',
            key: 'annotationsFolder',
            placeholder: 'Annotations',
          },
        },
        {
          name: 'Template file',
          desc: 'Copied into new annotation notes; leave empty for none.',
          control: {
            type: 'file',
            key: 'annotationTemplatePath',
            placeholder: 'None',
            filter: (file: TFile) => file.extension === 'md',
          },
        },
        {
          name: 'Display ordering',
          desc: 'Order of annotations in the reader details surface.',
          control: {
            type: 'dropdown',
            key: 'annotationOrdering',
            options: {
              'created-oldest-first': 'Creation date, oldest first',
              'path-a-z': 'File path, A to Z',
            },
          },
        },
      ],
    }
  }
}
