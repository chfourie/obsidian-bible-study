<!--
A body-portaled menu panel: fixed-position rows built from MenuSections,
anchored on an element (or centred without one), dismissed by an outside
click, Escape, a scroll or a resize. The owner mounts it while the menu is
open and hears `onClose` when it should stop; choosing an item closes first,
then runs it.
-->
<script lang="ts">
  import { setIcon } from 'obsidian'
  import {
    computeMenuPanelPosition,
    type MenuPanelAlign,
    type MenuPanelPlacement,
  } from './menu-panel-position'
  import type { MenuItem, MenuSection } from './menu-items'
  import { wirePanelDismiss } from './panel-dismiss'
  import { pressable } from './pressable'

  let {
    sections,
    anchor,
    placement = 'below',
    align = 'right',
    anchorDismisses = false,
    focusOnOpen = false,
    onClose,
  }: {
    sections: MenuSection[]
    anchor: HTMLElement | null
    placement?: MenuPanelPlacement
    align?: MenuPanelAlign
    // A click on the anchor dismisses only when asked: the gesture that
    // opened a ribbon menu bubbles on in the same click and would otherwise
    // re-close it at once.
    anchorDismisses?: boolean
    // Keyboard-opened menus move focus to their first item.
    focusOnOpen?: boolean
    onClose: () => void
  } = $props()

  let panelEl: HTMLElement | undefined = $state()
  let panelStyle = $state('')

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
    const rect = anchor?.getBoundingClientRect()
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
      viewport: { width: win.innerWidth, height: win.innerHeight },
      placement,
      align,
    })
    panelStyle = `top: ${top}px; left: ${left}px;`
  }

  function runItem(item: MenuItem, event: MouseEvent | KeyboardEvent) {
    onClose()
    item.onClick(event)
  }

  // Position once the portaled panel actually exists — a pass before
  // `panelEl` binds would fall back to estimated dimensions. Dismiss
  // listeners wire against the panel's own document: the portal may have
  // dropped it into a popout window, whose events never reach the main
  // window's `document` (where `svelte:window` and delegated handlers live).
  $effect(() => {
    if (!panelEl) return
    updatePanelPosition()
    if (focusOnOpen)
      panelEl.querySelector<HTMLElement>('.bsm-item')?.focus()
    return wirePanelDismiss(panelEl.ownerDocument, {
      isInsidePanel: (target) =>
        Boolean(
          panelEl?.contains(target) ||
            (!anchorDismisses && anchor?.contains(target)),
        ),
      onDismiss: onClose,
      onViewportChange: updatePanelPosition,
    })
  })
</script>

{#snippet label(item: MenuItem)}
  <span class="bsm-icon" aria-hidden="true" use:icon={item.icon}></span>
  <span class="bsm-title">{item.title}</span>
  {#if item.checked}
    <span class="bsm-icon bsm-check" aria-hidden="true" use:icon={'check'}
    ></span>
  {/if}
{/snippet}

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
           main window's document, unreachable from a popout portal. The
           role is spelled out per branch: Svelte's a11y checks need a
           literal to accept the tabindex. -->
      {#if item.checked === undefined}
        <span
          role="menuitem"
          tabindex="0"
          class="bsm-item"
          use:pressable={(event) => runItem(item, event)}
        >
          {@render label(item)}
        </span>
      {:else}
        <span
          role="menuitemcheckbox"
          aria-checked={item.checked}
          tabindex="0"
          class="bsm-item"
          use:pressable={(event) => runItem(item, event)}
        >
          {@render label(item)}
        </span>
      {/if}
    {/each}
  {/each}
</div>

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

  .bsm-item:hover,
  .bsm-item:focus-visible {
    background: var(--background-modifier-hover);
  }

  .bsm-title {
    flex: 1;
  }

  .bsm-icon {
    display: inline-flex;
    align-items: center;
    color: var(--text-muted);
  }

  .bsm-check {
    color: var(--interactive-accent);
  }

  .bsm-icon :global(svg) {
    width: var(--icon-s);
    height: var(--icon-s);
  }
</style>
