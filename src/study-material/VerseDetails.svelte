<!--
Everything the selected span offers beside its text: the Strong's entries for
a tapped word, and the whole selection in every installed translation — each
translation a collapsible block headed by its full name, with fold-all
controls beside the selection's title.
-->
<script lang="ts">
  import { setIcon } from 'obsidian'
  import type {
    StudyMaterialSource,
    TranslationRowView,
    VerseDetailsView,
  } from '../contracts'
  import type { VerseSegment } from '../rendering'
  import { activate } from '../ui'

  let {
    details,
    source,
    collapsed,
    toggle,
    collapseAll,
    expandAll,
  }: {
    details: VerseDetailsView
    source: StudyMaterialSource
    collapsed: ReadonlySet<string>
    toggle: (id: string) => void
    collapseAll: () => void
    expandAll: () => void
  } = $props()

  function icon(node: HTMLElement, name: string) {
    setIcon(node, name)
    return {
      update(next: string) {
        node.empty()
        setIcon(node, next)
      },
    }
  }

  // The block leads with the translation's full name; a translation known
  // only by its abbreviation gets that alone.
  const heading = (row: TranslationRowView): string =>
    row.name.trim() !== '' && row.name !== row.label
      ? `${row.name} (${row.label})`
      : row.label
</script>

{#snippet formattedText(segment: VerseSegment)}{#if segment.redLetter || segment.supplied || segment.psalmHeading}<span
      class:scripture-study-red-letter={segment.redLetter}
      class:scripture-study-supplied={segment.supplied}
      class:scripture-study-psalm-heading={segment.psalmHeading}
    >{segment.text}</span>{:else}{segment.text}{/if}{/snippet}

<div class="bsm-details-head">
  <span class="bsm-details-title">{details.title}</span>
  <span
    role="button"
    tabindex="0"
    class="bsm-fold-all"
    aria-label="Collapse all translations"
    title="Collapse all translations"
    use:icon={'chevrons-down-up'}
    onclick={collapseAll}
    onkeydown={activate(collapseAll)}
  ></span>
  <span
    role="button"
    tabindex="0"
    class="bsm-fold-all"
    aria-label="Expand all translations"
    title="Expand all translations"
    use:icon={'chevrons-up-down'}
    onclick={expandAll}
    onkeydown={activate(expandAll)}
  ></span>
  <button
    type="button"
    class="bsm-fold-all"
    aria-label="Copy formatted reference"
    title="Copy formatted reference"
    use:icon={'copy'}
    onclick={() => void source.copyFormattedReference()}
  ></button>
  <button
    type="button"
    class="bsm-details-clear"
    aria-label="Clear verse selection"
    title="Clear verse selection"
    onclick={() => source.clearSelection()}
  >×</button>
</div>

{#if details.strongs.length > 0}
  <div class="bsm-group-label">Strong's</div>
  {#each details.strongs as entry (entry.strongs)}
    <div class="bsm-strongs-entry">
      <div class="bsm-strongs-head">
        <span class="bsm-strongs-number">{entry.strongs}</span>
        <span class="bsm-strongs-lemma">{entry.lemma}</span>
        <span class="bsm-strongs-translit">{entry.transliteration}</span>
      </div>
      <div class="bsm-strongs-gloss">{entry.gloss}</div>
      <div class="bsm-strongs-definition">{entry.definition}</div>
    </div>
  {/each}
  {#if details.strongsAttribution !== null}
    <div class="bsm-strongs-attribution">{details.strongsAttribution}</div>
  {/if}
{/if}

{#each details.translations as row (row.id)}
  <section class="bsm-trans-block">
    <span
      role="button"
      tabindex="0"
      class="bsm-trans-head"
      aria-expanded={!collapsed.has(row.id)}
      onclick={() => toggle(row.id)}
      onkeydown={activate(() => toggle(row.id))}
    >
      <span
        class="bsm-trans-fold-icon"
        aria-hidden="true"
        use:icon={collapsed.has(row.id) ? 'chevron-right' : 'chevron-down'}
      ></span>
      {heading(row)}
    </span>
    {#if !collapsed.has(row.id)}
      <div class="bsm-trans-text">
        {#if row.segments === null}
          <span class="bsm-unavailable">Unavailable</span>
        {:else}
          {#each row.segments as segment, index (index)}{@render formattedText(segment)}{/each}
        {/if}
      </div>
    {/if}
  </section>
{/each}

<style>
  .bsm-details-head {
    display: flex;
    align-items: center;
    gap: 0.25rem;
    margin-bottom: 6px;
  }

  .bsm-details-title {
    margin-right: auto;
    font-size: var(--font-smallest);
    color: var(--text-faint);
  }

  .bsm-fold-all {
    display: flex;
    align-items: center;
    padding: 2px;
    border-radius: var(--radius-s);
    color: var(--text-muted);
    cursor: pointer;
    /* Buttons sharing this look (the copy action) shed the browser's own
       chrome so they read exactly like the span-based fold icons beside
       them. */
    background: none;
    border: none;
    box-shadow: none;
    width: auto;
    height: auto;
    min-height: 0;
  }

  .bsm-fold-all:hover {
    color: var(--text-normal);
    background: var(--background-modifier-hover);
  }

  .bsm-fold-all :global(svg) {
    width: var(--icon-s);
    height: var(--icon-s);
  }

  .bsm-details-clear {
    display: inline-flex;
    align-items: center;
    background: none;
    border: none;
    box-shadow: none;
    padding: 0 2px;
    height: auto;
    line-height: 1;
    color: var(--text-muted);
    cursor: pointer;
  }

  .bsm-details-clear:hover {
    color: var(--text-accent);
    background: none;
    box-shadow: none;
  }

  .bsm-group-label {
    display: block;
    margin-top: 8px;
    font-size: var(--font-smallest);
    color: var(--text-faint);
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  .bsm-trans-block {
    margin-bottom: 8px;
  }

  .bsm-trans-head {
    display: inline-flex;
    align-items: center;
    gap: 0.3em;
    font-size: var(--font-ui-small);
    font-weight: 600;
    color: var(--text-accent);
    cursor: pointer;
  }

  .bsm-trans-fold-icon {
    display: inline-flex;
    align-items: center;
    color: var(--text-muted);
  }

  .bsm-trans-fold-icon :global(svg) {
    width: var(--icon-xs);
    height: var(--icon-xs);
  }

  .bsm-trans-text {
    margin-top: 2px;
    padding-left: calc(var(--icon-xs) + 0.3em);
    line-height: var(--line-height-normal);
    user-select: text;
  }

  .bsm-unavailable {
    color: var(--text-faint);
    font-style: italic;
  }

  .bsm-strongs-entry {
    border: 1px solid var(--background-modifier-border);
    border-left: 3px solid var(--text-accent);
    border-radius: var(--radius-m);
    background: var(--background-secondary);
    margin: 6px 0;
    padding: 6px 10px;
    font-size: var(--font-ui-small);
  }

  .bsm-strongs-head {
    display: flex;
    align-items: baseline;
    gap: 8px;
  }

  .bsm-strongs-number {
    color: var(--text-accent);
    font-weight: 600;
    font-size: var(--font-ui-smaller);
  }

  .bsm-strongs-lemma {
    font-size: 1.1em;
  }

  .bsm-strongs-translit {
    color: var(--text-muted);
    font-style: italic;
  }

  .bsm-strongs-gloss {
    font-weight: 600;
    margin-top: 2px;
  }

  .bsm-strongs-definition {
    margin-top: 4px;
    color: var(--text-muted);
    white-space: pre-line;
    max-height: 200px;
    overflow-y: auto;
    user-select: text;
  }

  .bsm-strongs-attribution {
    color: var(--text-faint);
    font-size: var(--font-smallest);
    margin: 4px 0 8px;
  }
</style>
