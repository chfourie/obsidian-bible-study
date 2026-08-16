/*
Test-only mock of the `obsidian` module.

Surfaces just enough of the real package to exercise the plugin code under
test: TFile/TFolder/TAbstractFile (real classes so `instanceof` works),
`normalizePath`, and a Plugin shell with App/Vault stubs. Grows alongside
the plugin as features start touching more of the API.
*/

import { StateEffect, StateField } from '@codemirror/state'

export class Vault {}

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

  addSettingTab(_tab: PluginSettingTab): void {}
}

// Just enough of PluginSettingTab for glue registration; specs drive
// `display`/`hide` directly when they need the rendered DOM.
export class PluginSettingTab {
  containerEl: HTMLElement = document.createElement('div')

  constructor(
    public app: App,
    public plugin: Plugin
  ) {}

  display(): void {}

  hide(): void {}
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

  setDesc(desc: string): this {
    this.descEl.setText(desc)
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
// subclass; suggestions never pop up in tests.
export abstract class AbstractInputSuggest<T> {
  constructor(
    public app: App,
    protected textInputEl: HTMLInputElement
  ) {}

  protected abstract getSuggestions(query: string): T[] | Promise<T[]>

  abstract renderSuggestion(value: T, el: HTMLElement): void

  onSelect(
    _callback: (value: T, evt: MouseEvent | KeyboardEvent) => unknown
  ): this {
    return this
  }

  setValue(value: string): void {
    this.textInputEl.value = value
  }

  getValue(): string {
    return this.textInputEl.value
  }

  close(): void {}
}
