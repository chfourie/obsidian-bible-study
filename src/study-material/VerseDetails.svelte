<!--
Everything one selected verse offers beside its text: the Strong's entries for
a tapped word, and the same verse in every installed translation.
-->
<script lang="ts">
  import type { StudyMaterialSource, VerseDetailsView } from '../contracts'
  import type { VerseSegment } from '../rendering'

  let {
    details,
    source,
  }: {
    details: VerseDetailsView
    source: StudyMaterialSource
  } = $props()
</script>

{#snippet formattedText(segment: VerseSegment)}{#if segment.redLetter || segment.supplied || segment.psalmHeading}<span
      class:scripture-study-red-letter={segment.redLetter}
      class:scripture-study-supplied={segment.supplied}
      class:scripture-study-psalm-heading={segment.psalmHeading}
    >{segment.text}</span>{:else}{segment.text}{/if}{/snippet}

<div class="bsm-details-head">
  <span class="bsm-details-title">{details.title}</span>
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

<table class="bsm-trans-table">
  <tbody>
    {#each details.translations as row (row.id)}
      <tr>
        <td class="bsm-trans-id" title={row.name}>{row.label}</td>
        <td class="bsm-trans-text">
          {#if row.segments === null}
            <span class="bsm-unavailable">Unavailable</span>
          {:else}
            {#each row.segments as segment, index (index)}{@render formattedText(segment)}{/each}
          {/if}
        </td>
      </tr>
    {/each}
  </tbody>
</table>

<style>
  .bsm-details-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    margin-bottom: 6px;
  }

  .bsm-details-title {
    font-size: var(--font-smallest);
    color: var(--text-faint);
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

  .bsm-trans-table {
    width: 100%;
    border-collapse: collapse;
    margin-bottom: 6px;
  }

  .bsm-trans-table td {
    padding: 4px 8px;
    vertical-align: top;
    border-top: 1px solid var(--background-modifier-border);
  }

  .bsm-trans-table tr:first-child td {
    border-top: none;
  }

  .bsm-trans-id {
    color: var(--text-accent);
    font-weight: 600;
    width: 52px;
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
