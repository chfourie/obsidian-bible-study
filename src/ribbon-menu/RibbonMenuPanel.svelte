<!--
Body-portaled panel behind the plugin's single ribbon icon. The feature
drives it imperatively: the ribbon click passes its element to anchor
against; the command passes no anchor and the panel centres (mobile).
-->
<script lang="ts">
  import { setIcon } from 'obsidian'
  import { computeMenuPanelPosition, pressable, wirePanelDismiss } from '../ui'
  import type { RibbonMenuItem, RibbonMenuSection } from './ribbon-menu-items'

  let {
    getSections,
    registerApi,
  }: {
    getSections: () => Promise<RibbonMenuSection[]>
    registerApi: (api: {
      toggle: (anchor?: HTMLElement | null) => void
      close: () => void
    }) => void
  } = $props()

  let open = $state(false)
  let sections = $state.raw<RibbonMenuSection[]>([])
  let panelEl: HTMLElement | undefined = $state()
  let panelStyle = $state('')
  // Non-reactive: only read inside positioning, which re-runs explicitly.
  let anchorEl: HTMLElement | null = null
  // Sections arrive asynchronously, so a close or a second toggle in the
  // meantime must win over the open the in-flight build would have done.
  let openToken = 0

  // Registering through an effect avoids capturing the prop non-reactively
  // and runs well before any user click.
  $effect(() => {
    registerApi({ toggle, close: closePanel })
  })

  function portal(node: HTMLElement) {
    activeDocument.body.appendChild(node)
    return {
      destroy() {
        node.remove()
      },
    }
  }

  function icon(node: HTMLElement, name: string) {
    setIcon(node, name)
  }

  function updatePanelPosition() {
    const rect = anchorEl?.getBoundingClientRect()
    const win = panelEl?.ownerDocument.win ?? activeWindow
    const { top, left } = computeMenuPanelPosition({
      anchor: rect
        ? {
            top: rect.top,
            left: rect.left,
            right: rect.right,
            bottom: rect.bottom,
            width: rect.width,
          }
        : null,
      panel: {
        width: panelEl?.offsetWidth ?? 220,
        height: panelEl?.offsetHeight ?? 0,
      },
      viewport: {
        width: win.innerWidth,
        height: win.innerHeight,
      },
      placement: 'right',
    })
    panelStyle = `top: ${top}px; left: ${left}px;`
  }

  function toggle(anchor?: HTMLElement | null) {
    if (open) {
      closePanel()
      return
    }
    anchorEl = anchor ?? null
    const token = ++openToken
    void getSections().then((built) => {
      if (token !== openToken) return
      sections = built
      open = true
    })
  }

  function closePanel() {
    openToken += 1
    open = false
  }

  function runItem(item: RibbonMenuItem, event: MouseEvent | KeyboardEvent) {
    closePanel()
    item.onClick(event)
  }

  // Position once the portaled panel actually exists — a first-open pass
  // before `panelEl` binds would fall back to estimated dimensions. Dismiss
  // listeners wire against the panel's own document: the portal may have
  // dropped it into a popout window, whose events never reach the main
  // window's `document` (where `svelte:window` and delegated handlers live).
  $effect(() => {
    if (!open || !panelEl) return
    updatePanelPosition()
    return wirePanelDismiss(panelEl.ownerDocument, {
      // The ribbon click that opened us bubbles in the same gesture; treating
      // the anchor as inside avoids an immediate re-close.
      isInsidePanel: (target) =>
        Boolean(anchorEl?.contains(target) || panelEl?.contains(target)),
      onDismiss: closePanel,
      onViewportChange: updatePanelPosition,
    })
  })
</script>

{#if open}
  <div
    use:portal
    bind:this={panelEl}
    class="bsm-panel"
    style={panelStyle}
    role="menu"
    tabindex="-1"
  >
    {#each sections as section (section.label)}
      {#if section.label !== null}
        <div class="bsm-section-label">{section.label}</div>
      {/if}
      {#each section.items as item (item.title)}
        <!-- pressable, not onclick/onkeydown: Svelte delegates those to the
             main window's document, unreachable from a popout portal. -->
        <span
          role="menuitem"
          tabindex="0"
          class="bsm-item"
          use:pressable={(event) => runItem(item, event)}
        >
          <span class="bsm-icon" aria-hidden="true" use:icon={item.icon}></span>
          <span>{item.title}</span>
        </span>
      {/each}
    {/each}
  </div>
{/if}

<style>
  .bsm-panel {
    position: fixed;
    z-index: 10000001;
    display: flex;
    flex-direction: column;
    gap: 0.1rem;
    min-width: 200px;
    max-width: min(320px, 90vw);
    padding: 0.4rem;
    background: var(--background-primary);
    border: solid var(--border-width) var(--hr-color);
    border-radius: 0.5rem;
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.18);
    box-sizing: border-box;
    font-size: var(--font-ui-smaller);
  }

  .bsm-section-label {
    padding: 0.4rem 0.4rem 0.15rem;
    color: var(--text-muted);
    font-size: var(--font-ui-smaller);
    font-weight: 600;
  }

  .bsm-item {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.3rem 0.4rem;
    border-radius: 0.3rem;
    cursor: pointer;
    user-select: none;
    color: var(--text-normal);
  }

  .bsm-item:hover {
    background: var(--background-modifier-hover);
  }

  .bsm-icon {
    display: inline-flex;
    align-items: center;
    color: var(--text-muted);
  }

  .bsm-icon :global(svg) {
    width: var(--icon-s);
    height: var(--icon-s);
  }
</style>
