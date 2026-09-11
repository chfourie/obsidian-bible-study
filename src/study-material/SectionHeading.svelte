<!--
A labelled section of study material, optionally carrying its single add
action, which stays out of the way until the heading line is hovered, and
optionally the fold-all pair acting on the section's own rows, which sits at
the far edge of the heading line as the References heading has it.
Sections with neither render the bare heading.
-->
<script lang="ts">
  import { FoldAllPair, icon } from '../ui'

  let {
    label,
    action = '',
    onAdd = null,
    disabled = false,
    onFoldAll = null,
    onExpandAll = null,
  }: {
    label: string
    action?: string
    onAdd?: (() => void) | null
    disabled?: boolean
    onFoldAll?: (() => void) | null
    onExpandAll?: (() => void) | null
  } = $props()
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
  {#if onFoldAll !== null && onExpandAll !== null}
    <FoldAllPair {onFoldAll} {onExpandAll} />
  {/if}
</div>

<style>
  .bsm-section-head {
    display: flex;
    align-items: center;
    gap: 0.25rem;
    margin-top: 16px;
  }

  /* The label holds the line's left edge; every action sits out at the right,
     as the References heading has them. */
  .bsm-group-label {
    display: block;
    margin-right: auto;
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
