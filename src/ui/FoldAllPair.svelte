<!--
The collapse-all and expand-all pair a section heading carries out at its far
edge, acting on that section's own rows: one set of icons, labels and
keyboard grammar wherever rows fold, for the References heading and the
Annotations heading alike.
-->
<script lang="ts">
  import { icon } from './icon'
  import { activate } from './keyboard-activate'

  let {
    onFoldAll,
    onExpandAll,
  }: {
    onFoldAll: () => void
    onExpandAll: () => void
  } = $props()
</script>

<span
  role="button"
  tabindex="0"
  class="bsm-fold-all"
  aria-label="Collapse all"
  title="Collapse all"
  use:icon={'chevrons-down-up'}
  onclick={onFoldAll}
  onkeydown={activate(onFoldAll)}
></span>
<span
  role="button"
  tabindex="0"
  class="bsm-fold-all"
  aria-label="Expand all"
  title="Expand all"
  use:icon={'chevrons-up-down'}
  onclick={onExpandAll}
  onkeydown={activate(onExpandAll)}
></span>

<style>
  .bsm-fold-all {
    display: flex;
    align-items: center;
    padding: 2px;
    border-radius: var(--radius-s);
    color: var(--text-muted);
    cursor: pointer;
  }

  .bsm-fold-all:hover {
    color: var(--text-normal);
    background: var(--background-modifier-hover);
  }

  .bsm-fold-all :global(svg) {
    width: var(--icon-s);
    height: var(--icon-s);
  }
</style>
