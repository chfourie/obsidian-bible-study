<!--
Consolidated reader options popup, following the same body-portaled panel
pattern as TranslationMenu (adapted from obsidian-journal-folder's sidebar
menus): a toolbar trigger opening a fixed-position panel that escapes the
toolbar's overflow clipping. The panel stays open across picks so several
options can be adjusted in one visit.
-->
<script lang="ts">
  import { setIcon } from 'obsidian'
  import {
    FONT_SCALE_MAX,
    FONT_SCALE_MIN,
    type ReaderToggles,
  } from './reader-pane-model'
  import { readerOptionGroups } from './reader-options'
  import { activate, computeMenuPanelPosition } from '../ui'

  let {
    toggles,
    strongsAvailable,
    fontScalePercent,
    onSetToggle,
    onIncreaseFontScale,
    onDecreaseFontScale,
    onResetFontScale,
  }: {
    toggles: ReaderToggles
    strongsAvailable: boolean
    fontScalePercent: number
    onSetToggle: (key: keyof ReaderToggles, value: string) => void
    onIncreaseFontScale: () => void
    onDecreaseFontScale: () => void
    onResetFontScale: () => void
  } = $props()

  const groups = $derived(readerOptionGroups(strongsAvailable))

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
        width: panelEl?.offsetWidth ?? 200,
        height: panelEl?.offsetHeight ?? 0,
      },
      viewport: {
        width: activeWindow.innerWidth,
        height: activeWindow.innerHeight,
      },
      align: 'left',
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

  const icon = (node: HTMLElement, name: string) => {
    setIcon(node, name)
  }
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
  aria-label="Reader options"
  title="Reader options"
  onclick={toggle}
>
  Options…
  <span class="bsr-menu-caret" aria-hidden="true">▾</span>
</button>

{#if open}
  <div
    use:portal
    bind:this={panelEl}
    class="bsr-menu-panel bsr-options-panel"
    style={panelStyle}
    role="menu"
    tabindex="-1"
  >
    {#each groups as group (group.key)}
      <div class="bsr-options-section">
        <div class="bsr-options-section-label">{group.label}</div>
        <div class="bsr-options-rule"></div>
        {#each group.options as option (option.value)}
          <span
            role="menuitemradio"
            aria-checked={toggles[group.key] === option.value}
            tabindex="0"
            class="bsr-menu-item"
            onclick={() => onSetToggle(group.key, option.value)}
            onkeydown={activate(() => onSetToggle(group.key, option.value))}
          >
            <span class="bsr-menu-check" aria-hidden="true">
              {toggles[group.key] === option.value ? '✓' : ''}
            </span>
            <span>{option.label}</span>
          </span>
        {/each}
      </div>
    {/each}
    <div class="bsr-options-section">
      <div class="bsr-options-section-label">Text size</div>
      <div class="bsr-options-rule"></div>
      <div class="bsr-options-font">
        <button
          type="button"
          class="bsr-options-font-btn"
          aria-label="Decrease text size"
          disabled={fontScalePercent <= FONT_SCALE_MIN}
          onclick={onDecreaseFontScale}
          use:icon={'a-arrow-down'}
        ></button>
        <button
          type="button"
          class="bsr-options-font-reset"
          aria-label="Reset text size"
          title="Reset text size"
          onclick={onResetFontScale}
        >{fontScalePercent}%</button>
        <button
          type="button"
          class="bsr-options-font-btn"
          aria-label="Increase text size"
          disabled={fontScalePercent >= FONT_SCALE_MAX}
          onclick={onIncreaseFontScale}
          use:icon={'a-arrow-up'}
        ></button>
      </div>
    </div>
  </div>
{/if}

<style>
  .bsr-menu-trigger {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    background: var(--background-secondary);
    border: 1px solid var(--background-modifier-border);
    border-radius: var(--radius-s);
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
    min-width: 180px;
    max-width: min(320px, 90vw);
    max-height: min(70vh, 560px);
    overflow-y: auto;
    padding: 0.4rem;
    background: var(--background-primary);
    border: solid var(--border-width) var(--hr-color);
    border-radius: 0.5rem;
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.18);
    box-sizing: border-box;
    font-size: var(--font-ui-smaller);
  }

  .bsr-options-section + .bsr-options-section {
    margin-top: 0.4rem;
  }

  .bsr-options-section-label {
    padding: 0.1rem 0.4rem;
    font-size: var(--font-smallest);
    color: var(--text-faint);
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  .bsr-options-rule {
    height: 1px;
    margin: 0.1rem 0.2rem 0.2rem;
    background: var(--background-modifier-border);
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

  .bsr-options-font {
    display: flex;
    align-items: center;
    gap: 0.3rem;
    padding: 0.2rem 0.4rem;
  }

  .bsr-options-font-btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    background: var(--background-secondary);
    border: 1px solid var(--background-modifier-border);
    border-radius: var(--radius-s);
    box-shadow: none;
    padding: 2px 8px;
    color: var(--text-muted);
    cursor: pointer;
  }

  .bsr-options-font-btn :global(svg) {
    width: 14px;
    height: 14px;
  }

  .bsr-options-font-btn:disabled {
    color: var(--text-faint);
    cursor: default;
  }

  .bsr-options-font-reset {
    min-width: 42px;
    background: none;
    border: none;
    box-shadow: none;
    padding: 2px 6px;
    color: var(--text-muted);
    cursor: pointer;
  }

  .bsr-options-font-reset:hover {
    color: var(--text-normal);
  }
</style>
