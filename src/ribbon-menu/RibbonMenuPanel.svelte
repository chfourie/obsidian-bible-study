<!--
Body-portaled panel behind the plugin's single ribbon icon. The feature
drives it imperatively: the ribbon click passes its element to anchor
against; the command passes no anchor and the panel centres (mobile).
-->
<script lang="ts">
  import { setIcon } from 'obsidian'
  import { activate, computeMenuPanelPosition } from '../ui'
  import type { RibbonMenuItem } from './ribbon-menu-items'

  let {
    getItems,
    registerApi,
  }: {
    getItems: () => RibbonMenuItem[]
    registerApi: (api: {
      toggle: (anchor?: HTMLElement | null) => void
      close: () => void
    }) => void
  } = $props()

  let open = $state(false)
  let items = $state.raw<RibbonMenuItem[]>([])
  let panelEl: HTMLElement | undefined = $state()
  let panelStyle = $state('')
  // Non-reactive: only read inside positioning, which re-runs explicitly.
  let anchorEl: HTMLElement | null = null

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
        width: activeWindow.innerWidth,
        height: activeWindow.innerHeight,
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
    items = getItems()
    open = true
  }

  function closePanel() {
    open = false
  }

  function runItem(item: RibbonMenuItem) {
    closePanel()
    item.onClick()
  }

  // Position once the portaled panel actually exists — a first-open pass
  // before `panelEl` binds would fall back to estimated dimensions.
  $effect(() => {
    if (open && panelEl) updatePanelPosition()
  })

  function handleDocumentClick(event: MouseEvent) {
    if (!open) return
    const target = event.target as Node | null
    // The ribbon click that opened us bubbles to window in the same gesture;
    // ignore clicks within the anchor so we don't immediately re-close.
    if (target && anchorEl?.contains(target)) return
    if (target && panelEl?.contains(target)) return
    closePanel()
  }

  function handleKeydown(event: KeyboardEvent) {
    if (open && event.key === 'Escape') closePanel()
  }

  function handleViewportChange() {
    if (open) updatePanelPosition()
  }

  $effect(() => {
    if (!open) return
    activeDocument.addEventListener('scroll', handleViewportChange, true)
    return () =>
      activeDocument.removeEventListener('scroll', handleViewportChange, true)
  })
</script>

<svelte:window
  onclick={handleDocumentClick}
  onkeydown={handleKeydown}
  onresize={handleViewportChange}
/>

{#if open}
  <div
    use:portal
    bind:this={panelEl}
    class="bsm-panel"
    style={panelStyle}
    role="menu"
    tabindex="-1"
  >
    {#each items as item (item.title)}
      <span
        role="menuitem"
        tabindex="0"
        class="bsm-item"
        onclick={() => runItem(item)}
        onkeydown={activate(() => runItem(item))}
      >
        <span class="bsm-icon" aria-hidden="true" use:icon={item.icon}></span>
        <span>{item.title}</span>
      </span>
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
