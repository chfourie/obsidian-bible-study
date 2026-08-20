<!--
The singleton Search Pane. Typing fills the box and nothing more; Enter runs
the query over the searched translation and the hits below group under their
book. Activating a hit opens the reader at that verse.
-->
<script lang="ts">
  import { activate, opensInNewPane } from '../ui'
  import type { IndexBuildProgress } from './search-index-store'
  import type { SearchPaneModel } from './search-pane-model'
  import type { SearchHitView } from './search-results'

  let { model }: { model: SearchPaneModel } = $props()

  // Initial snapshot only — the model subscription below keeps it fresh.
  // svelte-ignore state_referenced_locally
  let view = $state.raw(model.view)
  $effect(() =>
    model.subscribe(() => {
      view = model.view
    }),
  )

  const indexedPercent = (progress: IndexBuildProgress | null): number =>
    progress === null || progress.total === 0
      ? 0
      : Math.round((progress.done / progress.total) * 100)

  const submitOnEnter = (event: KeyboardEvent): void => {
    if (event.key !== 'Enter') return
    event.preventDefault()
    void model.submit()
  }

  const open = (hit: SearchHitView, event: MouseEvent | KeyboardEvent): void => {
    model.openHit(hit, { newPane: opensInNewPane(event) })
  }
</script>

<div class="bss-pane">
  <div class="bss-search">
    <input
      type="search"
      class="bss-input"
      placeholder="Search words or “a phrase”"
      aria-label="Search query"
      value={view.query}
      oninput={(event) => model.setQuery(event.currentTarget.value)}
      onkeydown={submitOnEnter}
    />
    {#if view.translationLabel !== null}
      <span class="bss-translation">{view.translationLabel}</span>
    {/if}
  </div>

  <div class="bss-body">
    {#if view.status === 'idle'}
      <p class="bss-empty">Type words and press Enter to search.</p>
    {:else if view.status === 'no-translation'}
      <p class="bss-empty">No translation installed.</p>
    {:else if view.status === 'searching'}
      <p class="bss-empty">Searching…</p>
    {:else if view.status === 'indexing'}
      <p class="bss-empty">
        Indexing {view.translationLabel} for search… {indexedPercent(
          view.indexing,
        )}%
      </p>
    {:else if view.status === 'no-results'}
      <p class="bss-empty">Nothing found for {view.submittedQuery}.</p>
    {:else}
      <p class="bss-total">
        {view.totalHits}
        {view.totalHits === 1 ? 'result' : 'results'}
      </p>
      {#each view.books as group (group.book)}
        <section class="bss-book">
          <div class="bss-book-head">
            <span class="bss-book-name">{group.name}</span>
            <span class="bss-book-count">{group.count}</span>
          </div>
          {#each group.hits as hit (hit.verseId)}
            <div
              role="button"
              tabindex="0"
              class="bss-hit"
              onclick={(event) => open(hit, event)}
              onkeydown={activate((event) => open(hit, event))}
            >
              <span class="bss-hit-label">{hit.label}</span>
              <span class="bss-hit-text"
                >{#each hit.segments as segment, index (index)}{#if segment.matched}<mark
                      class="bss-match">{segment.text}</mark
                    >{:else}{segment.text}{/if}{/each}</span
              >
            </div>
          {/each}
        </section>
      {/each}
    {/if}
  </div>
</div>

<style>
  .bss-pane {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    height: 100%;
    min-height: 0;
  }

  .bss-search {
    display: flex;
    flex-shrink: 0;
    align-items: center;
    gap: 0.35rem;
    padding-top: var(--size-4-1);
  }

  .bss-input {
    flex: 1;
    min-width: 0;
  }

  /* Names the module the query ran against — the scope picker will grow out
     of this slot. */
  .bss-translation {
    flex-shrink: 0;
    color: var(--text-muted);
    font-size: var(--font-ui-smaller);
  }

  /* The results scroll on their own so the query box above stays put. */
  .bss-body {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    flex: 1;
    min-height: 0;
    overflow-y: auto;
    padding-bottom: 0.25rem;
  }

  .bss-empty,
  .bss-total {
    margin: 0;
    color: var(--text-muted);
    font-size: var(--font-ui-small);
  }

  .bss-book {
    display: flex;
    flex-direction: column;
    gap: 0.15rem;
  }

  .bss-book-head {
    display: flex;
    align-items: baseline;
    gap: 0.35rem;
    font-size: var(--font-ui-small);
    font-weight: 600;
    color: var(--text-accent);
  }

  .bss-book-count {
    color: var(--text-muted);
    font-weight: 400;
  }

  .bss-hit {
    padding: 0.2rem 0.3rem;
    border-radius: var(--radius-s);
    cursor: pointer;
    font-size: var(--font-ui-small);
  }

  .bss-hit:hover,
  .bss-hit:focus-visible {
    background-color: var(--background-modifier-hover);
  }

  .bss-hit-label {
    margin-right: 0.35rem;
    color: var(--text-muted);
    font-size: var(--font-ui-smaller);
  }

  /* Emphasis only — the matched words keep the text color around them. */
  .bss-match {
    background-color: transparent;
    color: inherit;
    font-weight: 600;
    text-decoration: underline;
    text-decoration-thickness: 2px;
    text-underline-offset: 2px;
  }
</style>
