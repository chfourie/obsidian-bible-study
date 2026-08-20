<!--
A labelled section of study material, optionally carrying its single add
action, which stays out of the way until the heading line is hovered.
Sections without an add action render the bare heading.
-->
<script lang="ts">
  import { setIcon } from 'obsidian'

  let {
    label,
    action = '',
    onAdd = null,
    disabled = false,
  }: {
    label: string
    action?: string
    onAdd?: (() => void) | null
    disabled?: boolean
  } = $props()

  const icon = (node: HTMLElement, name: string) => {
    setIcon(node, name)
  }
</script>

<div class="bsm-section-head">
  <span class="bsm-group-label">{label}</span>
  {#if onAdd !== null}
    <button
      type="button"
      class="bsm-section-add"
      aria-label={action}
      title={action}
      {disabled}
      onclick={onAdd}
    ><span class="bsm-section-add-icon" use:icon={'circle-plus'}></span></button>
  {/if}
</div>

<style>
  .bsm-section-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    margin-top: 16px;
  }

  .bsm-group-label {
    display: block;
    font-size: var(--font-smallest);
    color: var(--text-faint);
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  .bsm-section-add {
    display: inline-flex;
    align-items: center;
    opacity: 0;
    background: none;
    border: none;
    box-shadow: none;
    padding: 0 2px;
    height: auto;
    color: var(--text-muted);
    cursor: pointer;
  }

  .bsm-section-head:hover .bsm-section-add:not(:disabled),
  .bsm-section-add:focus-visible {
    opacity: 1;
  }

  .bsm-section-add:hover {
    color: var(--text-accent);
    background: none;
    box-shadow: none;
  }

  .bsm-section-add-icon {
    display: inline-flex;
    align-items: center;
  }

  .bsm-section-add-icon :global(svg) {
    width: var(--icon-s);
    height: var(--icon-s);
  }
</style>
