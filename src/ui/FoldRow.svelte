<!--
One folded row in the Study Panel's grammar: the chevron and the title toggle
the row together, a muted subtitle stands beside the title, the trailing
action sits at the far edge of the head, and the body renders beneath only
while the row stands open. A referenced passage and an annotation are both
rows of this shape, each bringing its own trailing action and body.
-->
<script lang="ts">
  import type { Snippet } from 'svelte'
  import { icon } from './icon'
  import { activate } from './keyboard-activate'

  let {
    open,
    label,
    subtitle = null,
    toggle,
    trailing,
    body,
  }: {
    open: boolean
    label: string
    subtitle?: string | null
    toggle: () => void
    trailing: Snippet
    body: Snippet
  } = $props()
</script>

<section class="bsm-fold-row">
  <div class="bsm-fold-row-head">
    <span
      role="button"
      tabindex="0"
      class="bsm-fold-row-title"
      aria-expanded={open}
      onclick={toggle}
      onkeydown={activate(toggle)}
    >
      <span
        class="bsm-fold-row-icon"
        aria-hidden="true"
        use:icon={open ? 'chevron-down' : 'chevron-right'}
      ></span>
      {label}
      {#if subtitle !== null}
        <span class="bsm-fold-row-subtitle">· {subtitle}</span>
      {/if}
    </span>
    {@render trailing()}
  </div>
  {#if open}
    {@render body()}
  {/if}
</section>

<style>
  .bsm-fold-row {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }

  .bsm-fold-row-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.5rem;
  }

  .bsm-fold-row-title {
    display: inline-flex;
    align-items: center;
    gap: 0.3em;
    font-weight: 600;
    color: var(--text-accent);
    cursor: pointer;
  }

  .bsm-fold-row-icon {
    display: inline-flex;
    align-items: center;
    color: var(--text-muted);
  }

  .bsm-fold-row-icon :global(svg) {
    width: var(--icon-xs);
    height: var(--icon-xs);
  }

  /* The subtitle is subordinate to the title it sits beside. */
  .bsm-fold-row-subtitle {
    font-weight: 400;
    color: var(--text-muted);
    font-size: var(--font-ui-smaller);
  }
</style>
