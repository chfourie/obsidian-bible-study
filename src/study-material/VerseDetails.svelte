<!--
Everything one selected verse offers beside its text: the Strong's entries for
a tapped word, the same verse in every installed translation, and the notes
around it — annotations, cross-references and mentions.
-->
<script lang="ts">
  import type { StudyMaterialSource, VerseDetailsView } from '../contracts'
  import type { VerseSegment } from '../rendering'
  import CrossReferenceList from './CrossReferenceList.svelte'
  import SectionHeading from './SectionHeading.svelte'
  import type { StudyMaterialHost } from './study-material-host'

  let {
    details,
    source,
    host,
    collecting,
    tab,
  }: {
    details: VerseDetailsView
    source: StudyMaterialSource
    host: StudyMaterialHost
    collecting: boolean
    // Which half to show; null stacks both, as the reader's inline expansion
    // does, and folds the verse's cross-references in with the notes.
    tab: 'translations' | 'notes' | null
  } = $props()

  type MarkdownBody = { text: string; path: string }
  const markdown = (el: HTMLElement, body: MarkdownBody) => {
    const render = (value: MarkdownBody): void => {
      el.replaceChildren()
      host.renderMarkdown(el, value.text, value.path)
    }
    render(body)
    return { update: render }
  }
</script>

{#snippet formattedText(segment: VerseSegment)}{#if segment.redLetter || segment.supplied || segment.psalmHeading}<span
      class:scripture-study-red-letter={segment.redLetter}
      class:scripture-study-supplied={segment.supplied}
      class:scripture-study-psalm-heading={segment.psalmHeading}
    >{segment.text}</span>{:else}{segment.text}{/if}{/snippet}

<div class="bsm-details-title">{details.title}</div>

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

{#if tab === null || tab === 'translations'}
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
{/if}

{#if tab === null || tab === 'notes'}
  <SectionHeading
    label="Annotations"
    action="Annotate this verse"
    onAdd={() => host.annotate(source.annotationReference(details.verseId))}
  />
  {#if details.annotations.length === 0}
    <div class="bsm-details-empty">No annotations.</div>
  {:else}
    {#each details.annotations as block, index (block.file)}
      {#if index > 0}<hr class="bsm-anno-sep" />{/if}
      <div class="bsm-anno-block">
        <button
          type="button"
          class="bsm-anno-edit"
          aria-label="Open annotation in editor"
          onclick={() => host.openNote(block.file)}
        >✎</button>
        <div class="bsm-anno-body" use:markdown={{ text: block.body, path: block.file }}></div>
      </div>
    {/each}
  {/if}
  {#if tab === null}
    <CrossReferenceList
      entries={details.crossReferences}
      {source}
      {host}
      {collecting}
    />
  {/if}
  <div class="bsm-group-label bsm-section-label">Mentions</div>
  {#if details.mentions.length === 0}
    <div class="bsm-details-empty">No intersecting notes.</div>
  {:else}
    <ul class="bsm-mention-list">
      {#each details.mentions as note (note.file)}
        <li class="bsm-mention-item">
          <button
            type="button"
            class="bsm-mention-link"
            onclick={() => host.openNote(note.file)}
          >{note.file}</button>
        </li>
      {/each}
    </ul>
  {/if}
{/if}

<style>
  .bsm-details-title {
    font-size: var(--font-smallest);
    color: var(--text-faint);
    margin-bottom: 6px;
  }

  .bsm-details-empty {
    color: var(--text-faint);
    font-size: var(--font-ui-small);
    margin: 6px 0;
  }

  .bsm-group-label {
    display: block;
    margin-top: 8px;
    font-size: var(--font-smallest);
    color: var(--text-faint);
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  .bsm-section-label {
    margin-top: 16px;
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

  .bsm-mention-list {
    margin: 4px 0;
    padding-left: 1.2em;
    font-size: var(--font-ui-small);
  }

  .bsm-mention-item::marker {
    color: var(--text-faint);
  }

  .bsm-mention-link {
    display: inline;
    padding: 0;
    margin: 0;
    border: none;
    border-radius: 0;
    background: none;
    box-shadow: none;
    height: auto;
    font-size: inherit;
    text-align: left;
    color: var(--text-muted);
    cursor: pointer;
  }

  .bsm-mention-link:hover {
    color: var(--text-accent);
    background: none;
    box-shadow: none;
  }

  /* Item-level divider: deliberately subordinate to the section labels, which
     alone delimit the sections. */
  .bsm-anno-sep {
    width: 2.5rem;
    margin: 8px 0;
    border: none;
    border-top: 1px solid var(--background-modifier-border);
  }

  .bsm-anno-block {
    position: relative;
    margin: 4px -4px 8px;
    padding: 2px 24px 2px 4px;
    border-radius: 4px;
    font-size: var(--font-ui-small);
  }

  .bsm-anno-block:hover {
    background: var(--background-modifier-hover);
  }

  /* Rendered markdown brings its own paragraph margins; trimming the outer
     ones keeps the block spaced like the mention list beside it. */
  .bsm-anno-body :global(> :first-child) {
    margin-top: 0;
  }

  .bsm-anno-body :global(> :last-child) {
    margin-bottom: 0;
  }

  .bsm-anno-edit {
    position: absolute;
    top: 4px;
    right: 4px;
    display: flex;
    align-items: flex-start;
    opacity: 0;
    background: none;
    border: none;
    box-shadow: none;
    width: auto;
    height: auto;
    min-height: 0;
    padding: 0;
    line-height: 1;
    color: var(--text-muted);
    cursor: pointer;
  }

  .bsm-anno-block:hover .bsm-anno-edit,
  .bsm-anno-edit:focus-visible {
    opacity: 1;
  }

  .bsm-anno-edit:hover {
    color: var(--text-accent);
  }

  .bsm-anno-body {
    max-height: 240px;
    overflow-y: auto;
    user-select: text;
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
