/*
Test-only mock of the `obsidian` module.

Surfaces just enough of the real package to exercise the plugin code under
test: TFile/TFolder/TAbstractFile (real classes so `instanceof` works),
`normalizePath`, and a Plugin shell with App/Vault stubs. Grows alongside
the plugin as features start touching more of the API.
*/

import { StateEffect, StateField } from '@codemirror/state'

export class Vault {
  getAllFolders(): TFolder[] {
    return []
  }

  getMarkdownFiles(): TFile[] {
    return []
  }
}

export class TAbstractFile {
  vault: Vault = new Vault()
  path = ''
  name = ''
  parent: TFolder | null = null
}

export class TFile extends TAbstractFile {
  basename = ''
  extension = 'md'
  stat: { ctime: number; mtime: number; size: number } = {
    ctime: 0,
    mtime: 0,
    size: 0,
  }
}

export class TFolder extends TAbstractFile {
  children: TAbstractFile[] = []
  isRoot(): boolean {
    return this.path === '' || this.path === '/'
  }
}

// Real Obsidian exposes a Platform constant with `isMobile`/`isPhone`/etc.
// Tests assume desktop unless they explicitly toggle this.
export const Platform = {
  isDesktop: true,
  isMobile: false,
  isPhone: false,
  isTablet: false,
}

// Network requests never leave the test environment; specs inject their own
// transports. Anything that reaches this stub is a wiring mistake.
export type RequestUrlParam = { url: string; [key: string]: unknown }

export function requestUrl(request: RequestUrlParam): Promise<never> {
  return Promise.reject(
    new Error(`network access attempted in tests: ${request.url}`)
  )
}

// Real Obsidian injects an SVG icon; tests only need to see which icon a
// element asked for.
export function setIcon(el: HTMLElement, iconId: string): void {
  el.setAttribute('data-icon', iconId)
}

export function normalizePath(path: string): string {
  return path.replace(/\\/g, '/').replace(/\/+/g, '/').replace(/\/$/, '') || '/'
}

export type PluginManifest = {
  id: string
  name: string
  version: string
  minAppVersion: string
  description: string
  author: string
}

export class App {
  vault: Vault = new Vault()
}

// Real Obsidian exposes the Live Preview flag as a CodeMirror state field;
// tests default to Live Preview being active. Real Obsidian flips the field
// internally when the user switches editor modes; tests simulate that switch
// by dispatching `setLivePreview` (a mock-only export).
export const setLivePreview = StateEffect.define<boolean>()

export const editorLivePreviewField = StateField.define<boolean>({
  create: () => true,
  update: (value, transaction) => {
    for (const effect of transaction.effects) {
      if (effect.is(setLivePreview)) return effect.value
    }
    return value
  },
})

// Real Obsidian exposes the editor's backing file as a CodeMirror state
// field; tests seed it with `setEditorFile` when a spec needs a note path.
export const setEditorFile = StateEffect.define<TFile | null>()

export const editorInfoField = StateField.define<{ file: TFile | null }>({
  create: () => ({ file: null }),
  update: (value, transaction) => {
    for (const effect of transaction.effects) {
      if (effect.is(setEditorFile)) return { file: effect.value }
    }
    return value
  },
})

// Markdown never actually renders in tests; view glue passes bodies through
// this stub and specs assert on the model instead.
export const MarkdownRenderer = {
  render: async (
    _app: App,
    _markdown: string,
    _el: HTMLElement,
    _sourcePath: string,
    _component: unknown,
  ): Promise<void> => {},
}

// Real Obsidian pops a toast; tests read back what was shown and reset the
// record between cases.
export class Notice {
  static shownMessages: string[] = []

  constructor(message: string) {
    Notice.shownMessages.push(message)
  }
}

// Just enough of Modal for glue that prompts the user: open/close call the
// lifecycle hooks synchronously; specs reach into `contentEl` to drive the UI.
export class Modal {
  contentEl: HTMLElement = document.createElement('div')
  titleEl: HTMLElement = document.createElement('div')

  constructor(public app: App) {}

  open(): void {
    this.onOpen()
  }

  close(): void {
    this.onClose()
  }

  onOpen(): void {}

  onClose(): void {}
}

// Just enough of MarkdownView for `instanceof` checks; specs assign the
// members they need (e.g. `editor`) onto instances directly.
export class MarkdownView {
  editor: unknown = null
  previewMode: { rerender: (full?: boolean) => void } = { rerender: () => {} }
}

// Just enough of WorkspaceLeaf/ItemView for the reader pane: real classes so
// `instanceof` and subclassing work; specs drive `setViewState` themselves.
export class WorkspaceLeaf {
  view: unknown = null

  async setViewState(_state: unknown): Promise<void> {}

  async loadIfDeferred(): Promise<void> {}
}

export abstract class ItemView {
  app: App = new App()
  contentEl: HTMLElement = document.createElement('div')

  constructor(readonly leaf: WorkspaceLeaf) {}

  abstract getViewType(): string
  abstract getDisplayText(): string
}

export class Plugin {
  constructor(
    public app: App,
    public manifest: PluginManifest
  ) {}

  async loadData(): Promise<unknown> {
    return null
  }

  async saveData(_data: unknown): Promise<void> {}

  addSettingTab(tab: PluginSettingTab): void {
    tab.update()
  }
}

// Fluent Setting mock: builds real DOM controls so glue-level specs can read
// back names, inputs, and interact with the handlers they registered.
class SettingTextComponent {
  inputEl: HTMLInputElement

  constructor(parent: HTMLElement) {
    this.inputEl = parent.createEl('input')
    this.inputEl.type = 'text'
  }

  setPlaceholder(placeholder: string): this {
    this.inputEl.placeholder = placeholder
    return this
  }

  setValue(value: string): this {
    this.inputEl.value = value
    return this
  }

  onChange(handler: (value: string) => unknown): this {
    this.inputEl.addEventListener('input', () => void handler(this.inputEl.value))
    return this
  }
}

class SettingDropdownComponent {
  selectEl: HTMLSelectElement

  constructor(parent: HTMLElement) {
    this.selectEl = parent.createEl('select')
  }

  addOption(value: string, display: string): this {
    const option = this.selectEl.createEl('option')
    option.value = value
    option.textContent = display
    return this
  }

  addOptions(options: Record<string, string>): this {
    Object.entries(options).forEach(([value, display]) =>
      this.addOption(value, display)
    )
    return this
  }

  setValue(value: string): this {
    this.selectEl.value = value
    return this
  }

  setDisabled(disabled: boolean): this {
    this.selectEl.disabled = disabled
    return this
  }

  onChange(handler: (value: string) => unknown): this {
    this.selectEl.addEventListener('change', () =>
      void handler(this.selectEl.value)
    )
    return this
  }
}

class SettingToggleComponent {
  toggleEl: HTMLInputElement

  constructor(parent: HTMLElement) {
    this.toggleEl = parent.createEl('input')
    this.toggleEl.type = 'checkbox'
  }

  setValue(value: boolean): this {
    this.toggleEl.checked = value
    return this
  }

  setDisabled(disabled: boolean): this {
    this.toggleEl.disabled = disabled
    return this
  }

  onChange(handler: (value: boolean) => unknown): this {
    this.toggleEl.addEventListener('change', () =>
      void handler(this.toggleEl.checked)
    )
    return this
  }
}

class SettingButtonComponent {
  buttonEl: HTMLButtonElement

  constructor(parent: HTMLElement) {
    this.buttonEl = parent.createEl('button')
  }

  setButtonText(text: string): this {
    this.buttonEl.textContent = text
    return this
  }

  setIcon(iconId: string): this {
    this.buttonEl.setAttribute('data-icon', iconId)
    return this
  }

  setTooltip(tooltip: string): this {
    this.buttonEl.setAttribute('aria-label', tooltip)
    return this
  }

  setCta(): this {
    this.buttonEl.addClass('mod-cta')
    return this
  }

  setWarning(): this {
    this.buttonEl.addClass('mod-warning')
    return this
  }

  setDestructive(): this {
    this.buttonEl.addClass('mod-destructive')
    return this
  }

  setDisabled(disabled: boolean): this {
    this.buttonEl.disabled = disabled
    return this
  }

  onClick(handler: () => unknown): this {
    this.buttonEl.addEventListener('click', () => void handler())
    return this
  }
}

export class Setting {
  settingEl: HTMLElement
  nameEl: HTMLElement
  descEl: HTMLElement
  controlEl: HTMLElement

  constructor(containerEl: HTMLElement) {
    this.settingEl = containerEl.createDiv({ cls: 'setting-item' })
    const info = this.settingEl.createDiv({ cls: 'setting-item-info' })
    this.nameEl = info.createDiv({ cls: 'setting-item-name' })
    this.descEl = info.createDiv({ cls: 'setting-item-description' })
    this.controlEl = this.settingEl.createDiv({ cls: 'setting-item-control' })
  }

  setName(name: string): this {
    this.nameEl.setText(name)
    return this
  }

  setDesc(desc: string | DocumentFragment): this {
    if (typeof desc === 'string') {
      this.descEl.setText(desc)
    } else {
      this.descEl.replaceChildren(desc)
    }
    return this
  }

  setHeading(): this {
    this.settingEl.addClass('setting-item-heading')
    return this
  }

  setClass(cls: string): this {
    this.settingEl.addClass(cls)
    return this
  }

  addText(configure: (text: SettingTextComponent) => unknown): this {
    configure(new SettingTextComponent(this.controlEl))
    return this
  }

  addDropdown(configure: (dropdown: SettingDropdownComponent) => unknown): this {
    configure(new SettingDropdownComponent(this.controlEl))
    return this
  }

  addToggle(configure: (toggle: SettingToggleComponent) => unknown): this {
    configure(new SettingToggleComponent(this.controlEl))
    return this
  }

  addButton(configure: (button: SettingButtonComponent) => unknown): this {
    configure(new SettingButtonComponent(this.controlEl))
    return this
  }

  addExtraButton(configure: (button: SettingButtonComponent) => unknown): this {
    configure(new SettingButtonComponent(this.controlEl))
    return this
  }
}

// Just enough of AbstractInputSuggest for the folder/file suggest glue to
// subclass. Suggestions never pop up in tests; specs find their instance in
// `created` (reset it between cases) and drive picks through
// `selectSuggestion`, mirroring the real PopoverSuggest API.
export abstract class AbstractInputSuggest<T> {
  static created: AbstractInputSuggest<unknown>[] = []

  #selectCallbacks: ((value: T, evt: MouseEvent | KeyboardEvent) => unknown)[] =
    []

  constructor(
    public app: App,
    protected textInputEl: HTMLInputElement
  ) {
    AbstractInputSuggest.created.push(this as AbstractInputSuggest<unknown>)
  }

  protected abstract getSuggestions(query: string): T[] | Promise<T[]>

  abstract renderSuggestion(value: T, el: HTMLElement): void

  onSelect(
    callback: (value: T, evt: MouseEvent | KeyboardEvent) => unknown
  ): this {
    this.#selectCallbacks.push(callback)
    return this
  }

  selectSuggestion(value: T, evt: MouseEvent | KeyboardEvent): void {
    this.#selectCallbacks.forEach((callback) => callback(value, evt))
  }

  setValue(value: string): void {
    this.textInputEl.value = value
  }

  getValue(): string {
    return this.textInputEl.value
  }

  close(): void {}
}

// Just enough of EditorSuggest for the reference autocomplete to subclass.
// Specs instantiate the subclass, seed `context`, and call the abstract
// methods directly — the popup itself never renders in tests.
export type EditorPosition = { line: number; ch: number }

export type EditorSuggestTriggerInfo = {
  start: EditorPosition
  end: EditorPosition
  query: string
}

export abstract class EditorSuggest<T> {
  context:
    | (EditorSuggestTriggerInfo & { editor: unknown; file: unknown })
    | null = null

  constructor(public app: App) {}

  abstract renderSuggestion(value: T, el: HTMLElement): void

  close(): void {}
}

// Declarative settings API (Obsidian ≥1.13): just enough of the
// setting-definition shapes for a tab to describe itself through
// `getSettingDefinitions()` — only the fields and control types the plugin
// uses. Rendering lives in PluginSettingTab below.
export type SettingControl = {
  key: string
  disabled?: boolean | (() => boolean)
} & (
  | { type: 'dropdown'; options: Record<string, string> }
  | { type: 'toggle' }
  | { type: 'folder'; placeholder?: string; filter?: (folder: TFolder) => boolean }
  | { type: 'file'; placeholder?: string; filter?: (file: TFile) => boolean }
)

export type SettingDefinition = {
  name: string
  desc?: string | DocumentFragment
  control?: SettingControl
  render?: (setting: Setting, group: unknown) => void
}

export type SettingDefinitionGroup = {
  type: 'group'
  heading?: string
  items?: SettingDefinition[]
}

export type SettingDefinitionPage = {
  type: 'page'
  name: string
  desc?: string | DocumentFragment
  items?: SettingDefinitionItem[]
}

export type SettingDefinitionItem =
  | SettingDefinition
  | SettingDefinitionGroup
  | SettingDefinitionPage

const resolveDisabled = (flag: boolean | (() => boolean) | undefined): boolean =>
  typeof flag === 'function' ? flag() : (flag ?? false)

// The folder/file controls' built-in suggesters. Real Obsidian owns these;
// the mock registers them in `AbstractInputSuggest.created` so specs can
// drive picks the same way they drive hand-rolled suggests.
class FolderControlSuggest extends AbstractInputSuggest<TFolder> {
  constructor(
    app: App,
    inputEl: HTMLInputElement,
    private readonly filter: ((folder: TFolder) => boolean) | undefined,
    commit: (path: string) => void
  ) {
    super(app, inputEl)
    this.onSelect((folder) => {
      this.setValue(folder.path)
      commit(folder.path)
      this.close()
    })
  }

  protected getSuggestions(query: string): TFolder[] {
    return this.app.vault
      .getAllFolders()
      .filter(
        (folder) =>
          (this.filter?.(folder) ?? true) &&
          folder.path.toLowerCase().includes(query.toLowerCase())
      )
  }

  renderSuggestion(folder: TFolder, el: HTMLElement): void {
    el.setText(folder.path)
  }
}

class FileControlSuggest extends AbstractInputSuggest<TFile> {
  constructor(
    app: App,
    inputEl: HTMLInputElement,
    private readonly filter: ((file: TFile) => boolean) | undefined,
    commit: (path: string) => void
  ) {
    super(app, inputEl)
    this.onSelect((file) => {
      this.setValue(file.path)
      commit(file.path)
      this.close()
    })
  }

  // The mock vault only lists markdown files, so they double as the
  // suggestion universe; `filter` narrows further like the real control.
  protected getSuggestions(query: string): TFile[] {
    return this.app.vault
      .getMarkdownFiles()
      .filter(
        (file) =>
          (this.filter?.(file) ?? true) &&
          file.path.toLowerCase().includes(query.toLowerCase())
      )
  }

  renderSuggestion(file: TFile, el: HTMLElement): void {
    el.setText(file.path)
  }
}

// PluginSettingTab with the ≥1.13 declarative pipeline, faithful to the
// 1.13.7 runtime's call order (verified against the shipped app.js):
// - addSettingTab() calls update() while containerEl is detached; update()
//   caches getSettingDefinitions() in settingItems and re-renders only the
//   currently open tab.
// - Opening the tab calls renderTab(), which renders from the *cached*
//   settingItems when non-empty — getSettingDefinitions() is NOT re-invoked
//   on open — and falls back to display() only when the cache is empty.
// - Rendering reads each control's value through getControlValue and persists
//   through setControlValue, producing the same markup as the Setting mock.
export class PluginSettingTab {
  containerEl: HTMLElement = document.createElement('div')
  settingItems: SettingDefinitionItem[] = []
  #openPageName: string | null = null

  constructor(
    public app: App,
    public plugin: Plugin
  ) {}

  getSettingDefinitions(): SettingDefinitionItem[] {
    return []
  }

  getControlValue(_key: string): unknown {
    return undefined
  }

  setControlValue(_key: string, _value: unknown): void | Promise<void> {}

  display(): void {
    this.#render()
  }

  renderTab(): void {
    this.#openPageName = null
    if (this.settingItems.length > 0) this.#render()
    else this.display()
  }

  // Navigates into / out of a declarative sub-page, standing in for the real
  // runtime's pageStack. The open page re-renders on update(), like
  // refreshCurrentPage() re-displaying the stack's top page.
  openPage(name: string): void {
    this.#openPageName = name
    this.#render()
  }

  closePage(): void {
    this.#openPageName = null
    this.#render()
  }

  update(): void {
    this.settingItems = this.getSettingDefinitions()
    if (this.containerEl.isConnected) this.#render()
  }

  #render(): void {
    this.containerEl.empty()
    for (const item of this.#currentPageItems()) {
      if ('type' in item && item.type === 'group') {
        this.#renderGroup(item)
      } else if ('type' in item && item.type === 'page') {
        this.#renderPageEntry(item)
      } else {
        this.#renderDefinition(item as SettingDefinition)
      }
    }
  }

  #currentPageItems(): SettingDefinitionItem[] {
    if (this.#openPageName === null) return this.settingItems
    const page = this.settingItems.find(
      (item) =>
        'type' in item &&
        item.type === 'page' &&
        item.name === this.#openPageName
    )
    if (page === undefined) throw new Error(`no page named ${this.#openPageName}`)
    return (page as SettingDefinitionPage).items ?? []
  }

  #renderPageEntry(page: SettingDefinitionPage): void {
    const setting = new Setting(this.containerEl).setName(page.name)
    if (page.desc !== undefined) setting.setDesc(page.desc)
    setting.settingEl.addClass('setting-item-navigate')
    setting.settingEl.addEventListener('click', () => this.openPage(page.name))
  }

  hide(): void {}

  #renderGroup(group: SettingDefinitionGroup): void {
    if (group.heading !== undefined) {
      new Setting(this.containerEl).setName(group.heading).setHeading()
    }
    group.items?.forEach((item) => this.#renderDefinition(item))
  }

  #renderDefinition(def: SettingDefinition): void {
    const setting = new Setting(this.containerEl).setName(def.name)
    if (def.desc !== undefined) setting.setDesc(def.desc)
    if (def.render) {
      def.render(setting, {})
      return
    }
    if (def.control) this.#renderControl(setting, def.control)
  }

  #renderControl(setting: Setting, control: SettingControl): void {
    const value = this.getControlValue(control.key)
    const disabled = resolveDisabled(control.disabled)
    const commit = (next: unknown) => void this.setControlValue(control.key, next)
    switch (control.type) {
      case 'dropdown':
        setting.addDropdown((dropdown) =>
          dropdown
            .addOptions(control.options)
            .setValue(String(value ?? ''))
            .setDisabled(disabled)
            .onChange(commit)
        )
        return
      case 'toggle':
        setting.addToggle((toggle) =>
          toggle
            .setValue(value === true)
            .setDisabled(disabled)
            .onChange(commit)
        )
        return
      case 'folder':
      case 'file':
        setting.addText((text) => {
          if (control.placeholder !== undefined) {
            text.setPlaceholder(control.placeholder)
          }
          text.setValue(String(value ?? ''))
          text.inputEl.disabled = disabled
          text.inputEl.addEventListener('change', () =>
            commit(text.inputEl.value)
          )
          if (control.type === 'folder') {
            new FolderControlSuggest(this.app, text.inputEl, control.filter, commit)
          }
          if (control.type === 'file') {
            new FileControlSuggest(this.app, text.inputEl, control.filter, commit)
          }
        })
        return
    }
  }
}
