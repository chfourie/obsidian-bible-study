<!--
Custom popup replacing the native select for the reader's collapsed
translation picker, adapted from obsidian-journal-folder's sidebar menus:
a pill-styled trigger opening a body-portaled panel so the menu escapes the
toolbar's overflow clipping and matches the plugin's look on all platforms.
-->
<script lang="ts">
  import type { TranslationPill } from './reader-pane-model'
  import { activate, computeMenuPanelPosition } from '../ui'

  let {
    options,
    onPick,
  }: {
    options: TranslationPill[]
    onPick: (id: string) => void
  } = $props()

  let open = $state(false)
  let triggerEl: HTMLElement | undefined = $state()
  let panelEl: HTMLElement | undefined = $state()
  let panelStyle = $state('')

  const shown = $derived(
    options.find((option) => option.active) ?? options[0] ?? null,
  )

  function portal(node: HTMLElement) {
    activeDocument.body.appendChild(node)
    return {
      destroy() {
        node.remove()
      },
    }
  }

  function updatePanelPosition() {
    if (!triggerEl) return
    const rect = triggerEl.getBoundingClientRect()
    const { top, left } = computeMenuPanelPosition({
      anchor: {
        top: rect.top,
        left: rect.left,
        right: rect.right,
        bottom: rect.bottom,
        width: rect.width,
      },
      panel: {
        width: panelEl?.offsetWidth ?? 160,
        height: panelEl?.offsetHeight ?? 0,
      },
      viewport: {
        width: activeWindow.innerWidth,
        height: activeWindow.innerHeight,
      },
    })
    panelStyle = `top: ${top}px; left: ${left}px;`
  }

  // Position once the portaled panel actually exists — a first-open pass
  // before `panelEl` binds would fall back to estimated dimensions. The
  // effect re-runs when `panelEl` binds, with the rendered panel measurable.
  $effect(() => {
    if (open && panelEl) updatePanelPosition()
  })

  function toggle() {
    open = !open
  }

  function pick(id: string) {
    open = false
    onPick(id)
  }

  function handleDocumentClick(event: MouseEvent) {
    if (!open) return
    const target = event.target as Node | null
    if (target && triggerEl?.contains(target)) return
    if (target && panelEl?.contains(target)) return
    open = false
  }

  function handleKeydown(event: KeyboardEvent) {
    if (open && event.key === 'Escape') open = false
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

  // Dragging an Obsidian split divider resizes the pane without a window
  // resize event; the toolbar slot holding the trigger changes width, so
  // observing it keeps an open panel anchored.
  $effect(() => {
    const slot = open ? (triggerEl?.parentElement ?? null) : null
    if (slot === null) return
    const observer = new ResizeObserver(handleViewportChange)
    observer.observe(slot)
    return () => observer.disconnect()
  })
</script>

<svelte:window
  onclick={handleDocumentClick}
  onkeydown={handleKeydown}
  onresize={handleViewportChange}
/>

<button
  type="button"
  bind:this={triggerEl}
  class="bsr-menu-trigger"
  class:bsr-on={open}
  aria-haspopup="menu"
  aria-expanded={open}
  onclick={toggle}
>
  {shown?.label ?? ''}
  <span class="bsr-menu-caret" aria-hidden="true">▾</span>
</button>

{#if open}
  <div
    use:portal
    bind:this={panelEl}
    class="bsr-menu-panel"
    style={panelStyle}
    role="menu"
    tabindex="-1"
  >
    {#each options as option (option.id)}
      <span
        role="menuitemradio"
        aria-checked={option.active}
        tabindex="0"
        class="bsr-menu-item"
        onclick={() => pick(option.id)}
        onkeydown={activate(() => pick(option.id))}
      >
        <span class="bsr-menu-check" aria-hidden="true">
          {option.active ? '✓' : ''}
        </span>
        <span>{option.label}</span>
      </span>
    {/each}
  </div>
{/if}

<style>
  .bsr-menu-trigger {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    background: var(--background-secondary);
    border: 1px solid var(--background-modifier-border);
    border-radius: 999px;
    box-shadow: none;
    padding: 2px 10px;
    font-size: var(--font-ui-smaller);
    color: var(--text-muted);
    cursor: pointer;
  }

  .bsr-menu-trigger.bsr-on {
    border-color: var(--text-accent);
    color: var(--text-accent);
  }

  .bsr-menu-caret {
    font-size: 0.7em;
  }

  .bsr-menu-panel {
    position: fixed;
    z-index: 10000001;
    display: flex;
    flex-direction: column;
    gap: 0.1rem;
    min-width: 140px;
    max-width: min(320px, 90vw);
    max-height: min(60vh, 480px);
    overflow-y: auto;
    padding: 0.4rem;
    background: var(--background-primary);
    border: solid var(--border-width) var(--hr-color);
    border-radius: 0.5rem;
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.18);
    box-sizing: border-box;
    font-size: var(--font-ui-smaller);
  }

  .bsr-menu-item {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.3rem 0.4rem;
    border-radius: 0.3rem;
    cursor: pointer;
    user-select: none;
    color: var(--text-normal);
  }

  .bsr-menu-item:hover {
    background: var(--background-modifier-hover);
  }

  .bsr-menu-item[aria-checked='true'] {
    color: var(--text-accent);
  }

  .bsr-menu-check {
    display: inline-flex;
    justify-content: center;
    flex: 0 0 1em;
  }
</style>
