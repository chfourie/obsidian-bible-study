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
}
