import type { Plugin } from 'obsidian'
import { mount, unmount } from 'svelte'
import { PluginFeature } from '../data-access'
import RibbonMenuPanel from './RibbonMenuPanel.svelte'
import {
  buildRibbonMenuItems,
  type RibbonMenuActions,
  type RibbonMenuItem,
} from './ribbon-menu-items'

export type { RibbonMenuActions } from './ribbon-menu-items'

type RibbonMenuApi = {
  toggle: (anchor?: HTMLElement | null) => void
  close: () => void
}

// The plugin's single "home" ribbon icon, adapted from
// obsidian-journal-folder's master ribbon menu: one icon opening a panel of
// per-feature entries instead of one ribbon icon per feature. The command
// mirrors the toggle for mobile, where Obsidian has no ribbon strip;
// without an anchor the panel centres itself.
export class RibbonMenuFeature extends PluginFeature {
  #host: HTMLElement | null = null
  #component: Record<string, unknown> | null = null
  #api: RibbonMenuApi | null = null
  #ribbonEl: HTMLElement | null = null

  constructor(
    plugin: Plugin,
    private readonly actions: RibbonMenuActions,
  ) {
    super(plugin)
  }

  override async load(): Promise<void> {
    const host = activeDocument.body.createDiv()
    this.#host = host
    this.#component = mount(RibbonMenuPanel, {
      target: host,
      props: {
        getItems: (): RibbonMenuItem[] => buildRibbonMenuItems(this.actions),
        registerApi: (api: RibbonMenuApi) => {
          this.#api = api
        },
      },
    }) as Record<string, unknown>
    this.#ribbonEl = this.plugin.addRibbonIcon(
      'library',
      'Scripture Study',
      () => this.#api?.toggle(this.#ribbonEl),
    )
    this.plugin.addCommand({
      id: 'open-menu',
      name: 'Open menu',
      callback: () => this.#api?.toggle(null),
    })
  }

  override unload(): void {
    this.#api?.close()
    if (this.#component !== null) {
      void unmount(this.#component)
      this.#component = null
    }
    this.#host?.remove()
    this.#host = null
    this.#api = null
    this.#ribbonEl = null
  }
}
