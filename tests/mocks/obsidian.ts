/*
Test-only mock of the `obsidian` module.

Surfaces just enough of the real package to exercise the plugin code under
test: TFile/TFolder/TAbstractFile (real classes so `instanceof` works),
`normalizePath`, and a Plugin shell with App/Vault stubs. Grows alongside
the plugin as features start touching more of the API.
*/

import { StateField } from '@codemirror/state'

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
// tests default to Live Preview being active.
export const editorLivePreviewField = StateField.define<boolean>({
  create: () => true,
  update: (value) => value,
})

// Just enough of MarkdownView for `instanceof` checks; specs assign the
// members they need (e.g. `editor`) onto instances directly.
export class MarkdownView {
  editor: unknown = null
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
