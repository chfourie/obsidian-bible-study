<!--
The breadcrumb's dropdowns: a body-portaled grouped menu built on the same
machinery as the collapsed translation picker, so a picked entry carries the
activating event and the modifier can ask for a tab of its own (ticket #78).
-->
<script lang="ts">
  import { activate, computeMenuPanelPosition, type NavMenuGroup } from '../ui'

  let {
    label,
    title,
    groups,
    onPick,
  }: {
    label: string
    title?: string
    groups: NavMenuGroup[]
    onPick: (key: string, event: MouseEvent | KeyboardEvent) => void
  } = $props()

  let open = $state(false)
  let triggerEl: HTMLElement | undefined = $state()
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

  $effect(() => {
    if (open && panelEl) updatePanelPosition()
  })

  function toggle() {
    open = !open
  }

  function pick(key: string, event: MouseEvent | KeyboardEvent) {
    open = false
    onPick(key, event)
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
  // resize event, so the breadcrumb row itself is what an open panel tracks.
  $effect(() => {
    const row = open ? (triggerEl?.parentElement ?? null) : null
    if (row === null) return
    const observer = new ResizeObserver(handleViewportChange)
    observer.observe(row)
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
  class="bsr-nav-trigger"
  class:bsr-on={open}
  aria-haspopup="menu"
  aria-expanded={open}
  {title}
  onclick={toggle}
>
  {label}
  <span class="bsr-nav-caret" aria-hidden="true">▾</span>
</button>

{#if open}
  <div
    use:portal
    bind:this={panelEl}
    class="bsr-nav-panel"
    style={panelStyle}
    role="menu"
    tabindex="-1"
  >
    {#each groups as group, index (group.label ?? index)}
      {#if group.label !== null}
        <div class="bsr-nav-group">{group.label}</div>
      {/if}
      {#each group.items as item (item.key)}
        <span
          role="menuitemradio"
          aria-checked={item.current}
          tabindex="0"
          class="bsr-nav-item"
          onclick={(event) => pick(item.key, event)}
          onkeydown={activate((event) => pick(item.key, event))}
        >
          <span class="bsr-nav-check" aria-hidden="true">
            {item.current ? '✓' : ''}
          </span>
          <span>{item.label}</span>
        </span>
      {/each}
    {/each}
  </div>
{/if}

<style>
  .bsr-nav-trigger {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    background: var(--background-secondary);
    border: 1px solid var(--background-modifier-border);
    border-radius: var(--radius-s);
    box-shadow: none;
    padding: 2px 8px;
    font-size: var(--font-ui-small);
    color: var(--text-normal);
    cursor: pointer;
  }

  .bsr-nav-trigger.bsr-on {
    border-color: var(--text-accent);
    color: var(--text-accent);
  }

  .bsr-nav-caret {
    font-size: 0.7em;
  }

  .bsr-nav-panel {
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

  .bsr-nav-group {
    padding: 0.4rem 0.4rem 0.2rem;
    color: var(--text-faint);
    font-size: var(--font-smallest);
    text-transform: uppercase;
    letter-spacing: 0.06em;
  }

  .bsr-nav-item {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.3rem 0.4rem;
    border-radius: 0.3rem;
    cursor: pointer;
    user-select: none;
    color: var(--text-normal);
  }

  .bsr-nav-item:hover {
    background: var(--background-modifier-hover);
  }

  .bsr-nav-item[aria-checked='true'] {
    color: var(--text-accent);
  }

  .bsr-nav-check {
    display: inline-flex;
    justify-content: center;
    flex: 0 0 1em;
  }
</style>
