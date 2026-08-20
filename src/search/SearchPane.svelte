<!--
The singleton Search Pane. Typing fills the box and nothing more; Enter runs
the query over the Search Scope — one translation, a testament filter and any
subset of the installed Books, or one book alone — and the hits below group
under their book, expandable and collapsible one group or all at once.
Activating a hit opens the reader at that verse or paragraph.
-->
<script lang="ts">
  import { activate, opensInNewPane } from '../ui'
  import type { IndexBuildProgress } from './search-index-store'
  import type { SearchPaneModel } from './search-pane-model'
  import type { SearchHitView } from './search-results'
  import type { TestamentFilter } from './search-scope'

  const TESTAMENTS: { value: TestamentFilter; label: string }[] = [
    { value: 'all', label: 'All' },
    { value: 'ot', label: 'OT' },
    { value: 'nt', label: 'NT' },
  ]

  // The dropdown carries strings, so "every book" needs an option value no
  // book number can collide with.
  const ALL_BOOKS = 'all'

  const chosenBook = (value: string): number | null =>
    value === ALL_BOOKS ? null : Number(value)

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
  </div>

  <div class="bss-scope">
    <select
      class="dropdown bss-scope-translation"
      aria-label="Translation to search"
      value={view.scope.translationId}
      onchange={(event) => model.chooseTranslation(event.currentTarget.value)}
      disabled={view.scope.translations.length === 0}
    >
      {#if view.scope.translationId === null}
        <option value={null}>No translation</option>
      {/if}
      {#each view.scope.translations as translation (translation.id)}
        <option value={translation.id}>{translation.label}</option>
      {/each}
    </select>
    <div class="bss-testaments" role="group" aria-label="Testament to search">
      {#each TESTAMENTS as testament (testament.value)}
        <button
          type="button"
          class="bss-testament"
          class:bss-chosen={view.scope.testament === testament.value}
          aria-pressed={view.scope.testament === testament.value}
          disabled={view.scope.narrowedToBook}
          onclick={() => model.chooseTestament(testament.value)}
        >
          {testament.label}
        </button>
      {/each}
    </div>
  </div>

  <select
    class="dropdown bss-scope-book-choice"
    aria-label="Book to search"
    value={view.scope.bookId === null ? ALL_BOOKS : String(view.scope.bookId)}
    onchange={(event) => model.chooseBook(chosenBook(event.currentTarget.value))}
  >
    <option value={ALL_BOOKS}>All books</option>
    {#each view.scope.bookChoices as choice (choice.bookId)}
      <option value={String(choice.bookId)}>{choice.label}</option>
    {/each}
  </select>

  {#if view.scope.books.length > 0}
    <div class="bss-scope-books">
      {#each view.scope.books as book (book.moduleId)}
        <label
          class="bss-scope-book"
          class:bss-inapplicable={view.scope.narrowedToBook}
        >
          <input
            type="checkbox"
            checked={book.selected}
            disabled={view.scope.narrowedToBook}
            onchange={() => model.toggleBook(book.moduleId)}
          />
          {book.label}
        </label>
      {/each}
    </div>
  {/if}

  <div class="bss-body">
    {#if view.status === 'idle'}
      <p class="bss-empty">Type words and press Enter to search.</p>
    {:else if view.status === 'no-translation'}
      <p class="bss-empty">Nothing installed to search.</p>
    {:else if view.status === 'searching'}
      <p class="bss-empty">Searching…</p>
    {:else if view.status === 'indexing'}
      <p class="bss-empty">
        Indexing {view.indexingLabel} for search… {indexedPercent(
          view.indexing,
        )}%
      </p>
    {:else if view.status === 'no-results'}
      <p class="bss-total">{view.totalLabel}</p>
      <p class="bss-empty">Nothing found for {view.submittedQuery}.</p>
    {:else}
      <div class="bss-results-head">
        <p class="bss-total">{view.totalLabel}</p>
        <div class="bss-fold-all">
          <button
            type="button"
            class="bss-fold-all-button"
            onclick={() => model.expandAllBooks()}
          >
            Expand all
          </button>
          <button
            type="button"
            class="bss-fold-all-button"
            onclick={() => model.collapseAllBooks()}
          >
            Collapse all
          </button>
        </div>
      </div>
      {#each view.books as group (group.book)}
        <section class="bss-book">
          <button
            type="button"
            class="bss-book-head"
            aria-expanded={!group.collapsed}
            onclick={() => model.toggleBookCollapsed(group.book)}
          >
            <span class="bss-book-fold" class:bss-folded={group.collapsed}
              >▾</span
            >
            <span class="bss-book-name">{group.name}</span>
            <span class="bss-book-count">{group.count}</span>
          </button>
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
                      class="scripture-study-match">{segment.text}</mark
                    >{:else}{segment.text}{/if}{/each}</span
              >
            </div>
          {/each}
          {#if group.hiddenHits > 0}
            <button
              type="button"
              class="bss-more"
              onclick={() => model.expandBookHits(group.book)}
            >
              Show {group.hiddenHits} more
            </button>
          {/if}
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

  /* The Search Scope: one translation, a testament filter, and a checkbox per
     installed Book on its own row when there are any. */
  .bss-scope {
    display: flex;
    flex-shrink: 0;
    align-items: center;
    gap: 0.35rem;
  }

  .bss-scope-translation {
    flex: 1;
    min-width: 0;
    font-size: var(--font-ui-small);
  }

  .bss-testaments {
    display: flex;
    flex-shrink: 0;
  }

  .bss-testament {
    padding: 0.15rem 0.45rem;
    border-radius: 0;
    box-shadow: none;
    background-color: var(--background-modifier-form-field);
    color: var(--text-muted);
    font-size: var(--font-ui-smaller);
  }

  .bss-testament:first-child {
    border-radius: var(--radius-s) 0 0 var(--radius-s);
  }

  .bss-testament:last-child {
    border-radius: 0 var(--radius-s) var(--radius-s) 0;
  }

  .bss-testament.bss-chosen {
    background-color: var(--interactive-accent);
    color: var(--text-on-accent);
  }

  .bss-scope-book-choice {
    flex-shrink: 0;
    width: 100%;
    font-size: var(--font-ui-small);
  }

  .bss-scope-books {
    display: flex;
    flex-shrink: 0;
    flex-wrap: wrap;
    gap: 0.15rem 0.75rem;
  }

  .bss-scope-book {
    display: flex;
    align-items: center;
    gap: 0.3rem;
    color: var(--text-muted);
    font-size: var(--font-ui-smaller);
  }

  /* Narrowed to one book, the testament filter and the Book checkboxes have
     nothing to say until every book is searched again. */
  .bss-scope-book.bss-inapplicable,
  .bss-testament:disabled {
    opacity: 0.5;
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

  .bss-results-head {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: 0.5rem;
  }

  .bss-fold-all {
    display: flex;
    gap: 0.15rem;
  }

  .bss-fold-all-button {
    padding: 0.1rem 0.3rem;
    box-shadow: none;
    background-color: transparent;
    cursor: pointer;
    color: var(--text-muted);
    font-size: var(--font-ui-smaller);
  }

  .bss-fold-all-button:hover {
    color: var(--text-normal);
    background-color: var(--background-modifier-hover);
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
    padding: 0.1rem 0.3rem;
    border-radius: var(--radius-s);
    box-shadow: none;
    background-color: transparent;
    cursor: pointer;
    text-align: left;
    font-size: var(--font-ui-small);
    font-weight: 600;
    color: var(--text-accent);
  }

  .bss-book-head:hover {
    background-color: var(--background-modifier-hover);
  }

  .bss-book-fold {
    font-size: var(--font-ui-smaller);
  }

  .bss-book-fold.bss-folded {
    display: inline-block;
    transform: rotate(-90deg);
  }

  .bss-book-count {
    color: var(--text-muted);
    font-weight: 400;
  }

  .bss-more {
    align-self: flex-start;
    padding: 0.1rem 0.3rem;
    box-shadow: none;
    background-color: transparent;
    cursor: pointer;
    color: var(--text-muted);
    font-size: var(--font-ui-smaller);
    text-decoration: underline;
  }

  .bss-more:hover {
    color: var(--text-normal);
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
</style>
