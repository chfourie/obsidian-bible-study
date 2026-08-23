import {
  PluginSettingTab,
  type Plugin,
  type Setting,
  type SettingDefinitionControl,
  type SettingDefinitionGroup,
  type SettingDefinitionItem,
  type SettingDefinitionPage,
  type SettingGroupItem,
  type TFile,
} from 'obsidian'
import {
  defaultHighlightPalette,
  FONT_SCALE_MAX,
  FONT_SCALE_MIN,
  FONT_SCALE_STEP,
  HIGHLIGHT_SLOTS,
  type AnnotationOrdering,
  type HighlightPalette,
  type HighlightSlot,
  type HighlightThemeMode,
  type ReaderDevice,
  type ScriptureStudySettings,
} from '../data-access'
import { LSJ_ATTRIBUTION, STRONGS_ATTRIBUTION } from '../strongs'
import { resolveHighlightPalette } from './highlight-palette'
import type {
  BookRowView,
  SettingsTabModel,
  SettingsTabView,
  TranslationOption,
  TranslationRowView,
} from './settings-tab-model'

// The Download / progress / Update / Delete button set shared by translation
// and book rows.
type ModuleRowActions = {
  id: string
  busy: 'downloading' | 'removing' | null
  installed: boolean
  offerUpdate: boolean
  offerRedownload: boolean
}

const NO_TRANSLATIONS_PLACEHOLDER =
  'No translations installed — see Translations below'

const READER_DEFAULT_DESC =
  'Seeds new reader panes; in-pane switches stay per pane.'

type ReaderOptionField =
  | 'readerNavDefault'
  | 'readerLayoutDefault'
  | 'readerStrongsDefault'
  | 'readerParaNumbersDefault'

type ReaderDefaultControlKey =
  | `${ReaderOptionField}Desktop`
  | `${ReaderOptionField}Mobile`

type SettingsControlKey =
  | 'defaultTranslationId'
  | 'fallbackTranslationId'
  | 'languageFilter'
  | 'derivedRedLetter'
  | 'revealPanelOnSelection'
  | 'strongsEnabled'
  | 'lsjEnabled'
  | ReaderDefaultControlKey
  | 'readerFontScalePercent'
  | 'annotationsFolder'
  | 'annotationTemplatePath'
  | 'annotationOrdering'
  | 'crossReferencesFolder'

// Maps each per-device settings control back to the field it reads/writes
// and which device slot within it — the settings tab shows both slots of
// every reader option under a single "desktop" / "mobile" pair of rows.
const READER_DEFAULT_CONTROLS: Record<
  ReaderDefaultControlKey,
  { field: ReaderOptionField; device: ReaderDevice }
> = {
  readerNavDefaultDesktop: { field: 'readerNavDefault', device: 'desktop' },
  readerNavDefaultMobile: { field: 'readerNavDefault', device: 'mobile' },
  readerLayoutDefaultDesktop: {
    field: 'readerLayoutDefault',
    device: 'desktop',
  },
  readerLayoutDefaultMobile: { field: 'readerLayoutDefault', device: 'mobile' },
  readerStrongsDefaultDesktop: {
    field: 'readerStrongsDefault',
    device: 'desktop',
  },
  readerStrongsDefaultMobile: {
    field: 'readerStrongsDefault',
    device: 'mobile',
  },
  readerParaNumbersDefaultDesktop: {
    field: 'readerParaNumbersDefault',
    device: 'desktop',
  },
  readerParaNumbersDefaultMobile: {
    field: 'readerParaNumbersDefault',
    device: 'mobile',
  },
}

const isReaderDefaultControlKey = (
  key: SettingsControlKey,
): key is ReaderDefaultControlKey => key in READER_DEFAULT_CONTROLS

export class ScriptureStudySettingTab extends PluginSettingTab {
  #unsubscribe: (() => void) | null = null
  #catalogLoadedThisOpen = false
  #updatesLoadedThisOpen = false
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
      {
        name: 'Derived red letter',
        desc: 'Shows whole verses containing the words of Christ in red in translations without their own red-letter data.',
        control: { type: 'toggle', key: 'derivedRedLetter' },
      },
      {
        name: 'Reveal Study Panel on selection',
        desc: 'Opens the Study Panel when a verse or a tagged word is clicked in a reader. With this off, only an already-open panel follows the selection.',
        control: { type: 'toggle', key: 'revealPanelOnSelection' },
      },
      this.#translationsPage(view),
      this.#booksPage(view),
      this.#strongsGroup(view),
      this.#wordCloudGroup(view),
      this.#readerGroup(),
      this.#highlightsGroup(view),
      this.#annotationsGroup(),
      this.#crossReferencesGroup(),
    ]
  }

  override hide(): void {
    this.#unsubscribe?.()
    this.#unsubscribe = null
    this.#catalogLoadedThisOpen = false
    this.#updatesLoadedThisOpen = false
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
    if (isReaderDefaultControlKey(key as SettingsControlKey)) {
      const { field, device } =
        READER_DEFAULT_CONTROLS[key as ReaderDefaultControlKey]
      return settings[field][device]
    }
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
      case 'derivedRedLetter':
        return settings.derivedRedLetter
      case 'revealPanelOnSelection':
        return settings.revealPanelOnSelection
      case 'strongsEnabled':
        return view.strongsInstalled
      case 'lsjEnabled':
        return view.lsjInstalled
      case 'readerFontScalePercent':
        return settings.readerFontScalePercent
      case 'annotationsFolder':
        return settings.annotationsFolder
      case 'annotationTemplatePath':
        return settings.annotationTemplatePath ?? ''
      case 'annotationOrdering':
        return settings.annotationOrdering
      case 'crossReferencesFolder':
        return settings.crossReferencesFolder
    }
  }

  override setControlValue(key: string, value: unknown): void | Promise<void> {
    if (isReaderDefaultControlKey(key as SettingsControlKey)) {
      const { field, device } =
        READER_DEFAULT_CONTROLS[key as ReaderDefaultControlKey]
      return this.#update((settings) => ({
        ...settings,
        [field]: { ...settings[field], [device]: value },
      }))
    }
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
      case 'derivedRedLetter':
        return this.#update((settings) => ({
          ...settings,
          derivedRedLetter: value === true,
        }))
      case 'revealPanelOnSelection':
        return this.#update((settings) => ({
          ...settings,
          revealPanelOnSelection: value === true,
        }))
      case 'strongsEnabled':
        return this.model.setStrongsEnabled(value === true)
      case 'lsjEnabled':
        return this.model.setLsjEnabled(value === true)
      case 'readerFontScalePercent':
        return this.#update((settings) => ({
          ...settings,
          readerFontScalePercent: value as number,
        }))
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
      case 'crossReferencesFolder':
        return this.#update((settings) => ({
          ...settings,
          crossReferencesFolder: (value as string)
            .trim()
            .replace(/^\/+|\/+$/g, ''),
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
  // which feeds its own dropdown's option list, and the highlight palette,
  // whose imperatively rendered pickers hold no key of their own to refresh
  // (reset changes all ten at once).
  #structureSignature(): string {
    const { settings, ...structure } = this.model.view
    return JSON.stringify({
      ...structure,
      languageFilter: settings.languageFilter,
      highlightPalette: settings.highlightPalette,
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
    if (row.formatOutdated && row.redownloadable && row.busy === null) {
      setting.descEl.createDiv({
        text: 'Update to the newest module format — adds formatting like red letter and poetry lines where the source provides them.',
      })
    }
  }

  #renderTranslationRow(setting: Setting, row: TranslationRowView): void {
    this.#decorateRow(setting, row)
    this.#renderRowActions(setting, {
      id: row.id,
      busy: row.busy,
      installed: row.installed,
      // bolls publishes no checksums, so there is no update detection for
      // catalogue modules — updating one is an ordinary re-download.
      offerUpdate:
        row.updateAvailable || (row.formatOutdated && row.redownloadable),
      offerRedownload: row.redownloadable,
    })
  }

  #booksPage(view: SettingsTabView): SettingDefinitionPage<SettingsControlKey> {
    return {
      type: 'page',
      name: 'Books',
      desc: 'Download and manage book modules.',
      items: view.bookRows.map((row) => ({
        name: `${row.title} — ${row.author}`,
        desc: row.editionCode,
        render: (setting: Setting) => this.#renderBookRow(setting, row),
      })),
    }
  }

  // The Books page holds no control of its own, so — like the Translations
  // page's languageFilter read — its first rendered row doubles as the
  // page-open hook that goes looking for published updates.
  #loadUpdatesOnBooksPageRender(): void {
    if (this.#updatesLoadedThisOpen || !this.containerEl.isConnected) return
    this.#updatesLoadedThisOpen = true
    void this.model.refreshUpdates()
  }

  #renderBookRow(setting: Setting, row: BookRowView): void {
    this.#loadUpdatesOnBooksPageRender()
    if (row.error !== null) {
      setting.descEl.createDiv({
        cls: 'scripture-study-settings-error',
        text: row.error,
      })
    }
    this.#renderRowActions(setting, {
      id: row.id,
      busy: row.busy,
      installed: row.installed,
      offerUpdate: row.updateAvailable,
      offerRedownload: false,
    })
  }

  #renderRowActions(setting: Setting, row: ModuleRowActions): void {
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
    if (row.offerUpdate) {
      setting.addButton((button) =>
        button
          .setButtonText('Update')
          .setCta()
          .onClick(() => void this.model.download(row.id)),
      )
    } else if (row.offerRedownload) {
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
        {
          name: 'Enable full LSJ lexicon',
          desc: this.#lsjDesc(view),
          control: {
            type: 'toggle',
            key: 'lsjEnabled',
            disabled: view.lsjBusy,
          },
        },
      ],
    }
  }

  // The user's own Cloud Exclusions: added from a cloud word's menu in the
  // Study Panel, removed here.
  #wordCloudGroup(
    view: SettingsTabView,
  ): SettingDefinitionGroup<SettingsControlKey> {
    const items: SettingGroupItem<SettingsControlKey>[] =
      view.wordCloudExclusions.length === 0
        ? [
            {
              name: 'No words excluded',
              desc: 'Exclude a word from its menu in the Study Panel word cloud.',
              render: () => {},
            },
          ]
        : view.wordCloudExclusions.map((exclusion) => ({
            name: exclusion.label,
            desc: 'Excluded from the word cloud.',
            render: (setting: Setting) =>
              void setting.addButton((button) =>
                button
                  .setButtonText('Remove')
                  .onClick(
                    () => void this.model.removeWordCloudExclusion(exclusion.family),
                  ),
              ),
          }))
    return { type: 'group', heading: 'Word cloud', items }
  }

  #lsjDesc(view: SettingsTabView): string | DocumentFragment {
    const base =
      'Adds the full Liddell-Scott-Jones entry to the word study of a Greek ' +
      `number. Greek only, and a large download. ${LSJ_ATTRIBUTION}`
    if (view.lsjError === null) return base
    const fragment = createFragment()
    fragment.append(base)
    fragment.append(
      createDiv({
        cls: 'scripture-study-settings-error',
        text: view.lsjError,
      }),
    )
    return fragment
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
        ...this.#readerDefaultPair('Navigation', 'readerNavDefault', {
          tree: 'Tree panel',
          breadcrumb: 'Breadcrumbs',
        }),
        ...this.#readerDefaultPair('Layout', 'readerLayoutDefault', {
          'verse-per-line': 'Verse per line',
          continuous: 'Continuous prose',
        }),
        ...this.#readerDefaultPair("Strong's mode", 'readerStrongsDefault', {
          off: 'Off',
          on: 'On',
        }),
        ...this.#readerDefaultPair(
          'Paragraph numbers',
          'readerParaNumbersDefault',
          { on: 'On', hover: 'On hover' },
        ),
        {
          name: 'Text size',
          desc: READER_DEFAULT_DESC + ' Relative to the app font size.',
          control: {
            type: 'slider',
            key: 'readerFontScalePercent',
            min: FONT_SCALE_MIN,
            max: FONT_SCALE_MAX,
            step: FONT_SCALE_STEP,
            displayFormat: (value: number) => `${value}%`,
          },
        },
      ],
    }
  }

  // One dropdown per device slot — a new pane seeds from whichever slot
  // matches the device it opens on.
  #readerDefaultPair<Field extends ReaderOptionField>(
    name: string,
    field: Field,
    labels: Record<ScriptureStudySettings[Field][ReaderDevice], string>,
  ): SettingDefinitionControl<SettingsControlKey>[] {
    return (['desktop', 'mobile'] as const).map((device) => ({
      name: `${name} (${device})`,
      desc: READER_DEFAULT_DESC,
      control: {
        type: 'dropdown',
        key: `${field}${
          device === 'desktop' ? 'Desktop' : 'Mobile'
        }` as ReaderDefaultControlKey,
        options: labels,
      },
    }))
  }

  #highlightsGroup(
    view: SettingsTabView,
  ): SettingDefinitionGroup<SettingsControlKey> {
    const palette = resolveHighlightPalette(view.settings.highlightPalette)
    return {
      type: 'group',
      heading: 'Highlights',
      items: [
        ...HIGHLIGHT_SLOTS.map((slot) => ({
          name: `Slot ${slot}`,
          desc: 'Light mode color, then dark mode color.',
          render: (setting: Setting) =>
            this.#renderHighlightSlot(setting, palette, slot),
        })),
        {
          name: 'Reset colors',
          desc: 'Restores the shipped palette.',
          render: (setting: Setting) =>
            void setting.addButton((button) =>
              button
                .setButtonText('Reset')
                .onClick(() =>
                  this.#update((settings) => ({
                    ...settings,
                    highlightPalette: defaultHighlightPalette(),
                  })),
                ),
            ),
        },
      ],
    }
  }

  #renderHighlightSlot(
    setting: Setting,
    palette: HighlightPalette,
    slot: HighlightSlot,
  ): void {
    const modes: HighlightThemeMode[] = ['light', 'dark']
    for (const mode of modes) {
      setting.addColorPicker((picker) => {
        picker.setValue(palette[mode][slot - 1] ?? '')
        picker.onChange((color) => {
          this.#setHighlightColor(palette, mode, slot, color)
        })
      })
    }
  }

  #setHighlightColor(
    palette: HighlightPalette,
    mode: HighlightThemeMode,
    slot: HighlightSlot,
    color: string,
  ): void {
    this.#update((settings) => ({
      ...settings,
      highlightPalette: {
        ...palette,
        [mode]: palette[mode].map((current, index) =>
          index === slot - 1 ? color : current,
        ),
      },
    }))
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

  #crossReferencesGroup(): SettingDefinitionGroup<SettingsControlKey> {
    return {
      type: 'group',
      heading: 'Cross-references',
      items: [
        {
          name: 'Data file folder',
          desc: 'Where the cross-references data file lives; the file moves when this changes. Empty keeps it in the vault root.',
          control: {
            type: 'folder',
            key: 'crossReferencesFolder',
            placeholder: 'Vault root',
          },
        },
      ],
    }
  }
}
