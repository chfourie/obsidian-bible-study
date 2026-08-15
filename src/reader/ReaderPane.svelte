<script lang="ts">
  import { BOOK_COUNT, bookName, chapterCount } from '../reference'
  import type {
    ReaderPaneModel,
    ReaderToggles,
    VerseDetailsView,
    VerseRowView,
  } from './reader-pane-model'

  let {
    model,
    openNote,
  }: {
    model: ReaderPaneModel
    openNote: (file: string) => void
  } = $props()

  // Initial snapshot only — the model subscription below keeps it fresh.
  // svelte-ignore state_referenced_locally
  let view = $state.raw(model.view)
  $effect(() =>
    model.subscribe(() => {
      view = model.view
    }),
  )

  let openBook: number | null = $state(null)
  let sideTab: 'translations' | 'notes' = $state('translations')

  const books = Array.from({ length: BOOK_COUNT }, (_, index) => index + 1)
  const chaptersOf = (book: number): number[] =>
    Array.from({ length: chapterCount(book) }, (_, index) => index + 1)

  const treeBook = $derived(openBook ?? view.position.book)
  const selectedDetails = $derived(
    view.selectedVerseId === null
      ? null
      : (view.details[view.selectedVerseId] ?? null),
  )

  const toggleGroups: {
    key: keyof ReaderToggles
    label: string
    options: { value: string; label: string }[]
  }[] = [
    {
      key: 'details',
      label: 'Details',
      options: [
        { value: 'inline', label: 'Inline' },
        { value: 'side-panel', label: 'Side panel' },
      ],
    },
    {
      key: 'nav',
      label: 'Nav',
      options: [
        { value: 'tree', label: 'Tree' },
        { value: 'breadcrumb', label: 'Breadcrumb' },
      ],
    },
    {
      key: 'layout',
      label: 'Layout',
      options: [
        { value: 'verse-per-line', label: 'Verse per line' },
        { value: 'continuous', label: 'Continuous' },
      ],
    },
  ]

  const setToggle = (key: keyof ReaderToggles, value: string): void => {
    model.setToggle(key, value as ReaderToggles[typeof key])
  }

  const verseMarks = (row: VerseRowView): { anno: boolean; mentions: number } => ({
    anno: row.annotations > 0,
    mentions: row.mentions,
  })

  const detailsFor = (row: VerseRowView): VerseDetailsView | null =>
    row.expanded ? (view.details[row.verseId] ?? null) : null

  const onBookPicked = (event: Event): void => {
    const book = Number((event.target as HTMLSelectElement).value)
    void model.goTo(book, 1)
  }

  const onChapterPicked = (event: Event): void => {
    void model.goTo(view.position.book, Number((event.target as HTMLSelectElement).value))
  }
</script>

{#snippet detailsBlock(details: VerseDetailsView | null)}
  {#if details === null}
    <div class="bsr-details-empty">Loading…</div>
  {:else}
    <div class="bsr-details-title">{details.title}</div>
    <table class="bsr-trans-table">
      <tbody>
        {#each details.translations as row (row.id)}
          <tr>
            <td class="bsr-trans-id">{row.label}</td>
            <td class="bsr-trans-text">
              {#if row.text === null}
                <span class="bsr-unavailable">Unavailable</span>
              {:else}
                {row.text}
              {/if}
            </td>
          </tr>
        {/each}
      </tbody>
    </table>
    {#if details.notes.length === 0}
      <div class="bsr-details-empty">No annotations or intersecting notes.</div>
    {:else}
      {#each details.notes as note (note.file)}
        <button
          type="button"
          class="bsr-note-card"
          class:bsr-note-anno={note.annotation}
          onclick={() => openNote(note.file)}
        >
          <span class="bsr-note-path">{note.file}</span>
        </button>
      {/each}
    {/if}
  {/if}
{/snippet}

{#snippet verseText(row: VerseRowView)}
  {#each row.segments as segment, index (index)}
    {#if segment.redLetter}
      <span class="bible-study-red-letter">{segment.text}</span>
    {:else}
      {segment.text}
    {/if}
  {/each}
  {#if verseMarks(row).anno}<span class="bsr-mark-anno" title="Annotation">●</span>{/if}
  {#if verseMarks(row).mentions > 0}
    <span class="bsr-mark-inter" title="{verseMarks(row).mentions} intersecting notes">◆{verseMarks(row).mentions > 1 ? verseMarks(row).mentions : ''}</span>
  {/if}
{/snippet}

<div class="bsr-shell">
  {#if view.banner !== null}
    <div class="bsr-banner">
      <span>{view.banner}</span>
      <button type="button" class="bsr-banner-dismiss" aria-label="Dismiss" onclick={() => model.dismissBanner()}>✕</button>
    </div>
  {/if}

  <div class="bsr-toolbar">
    {#each toggleGroups as toggleGroup (toggleGroup.key)}
      <span class="bsr-seg-group">
        <span class="bsr-seg-label">{toggleGroup.label}</span>
        <span class="bsr-seg">
          {#each toggleGroup.options as option (option.value)}
            <button
              type="button"
              class:bsr-on={view.toggles[toggleGroup.key] === option.value}
              onclick={() => setToggle(toggleGroup.key, option.value)}
            >{option.label}</button>
          {/each}
        </span>
      </span>
    {/each}
    <span class="bsr-spacer"></span>
    {#each view.translations as pill (pill.id)}
      <button
        type="button"
        class="bsr-pill"
        class:bsr-on={pill.active}
        onclick={() => void model.setTranslation(pill.id)}
      >{pill.label}</button>
    {/each}
  </div>

  {#if view.toggles.nav === 'breadcrumb'}
    <div class="bsr-crumb">
      <select class="dropdown" value={String(view.position.book)} onchange={onBookPicked}>
        {#each books as book (book)}
          <option value={String(book)}>{bookName(book)}</option>
        {/each}
      </select>
      <span class="bsr-crumb-sep">›</span>
      <select class="dropdown" value={String(view.position.chapter)} onchange={onChapterPicked}>
        {#each chaptersOf(view.position.book) as chapter (chapter)}
          <option value={String(chapter)}>{chapter}</option>
        {/each}
      </select>
      <span class="bsr-spacer"></span>
      <button type="button" class="bsr-step" onclick={() => void model.previousChapter()}>‹ Previous</button>
      <button type="button" class="bsr-step" onclick={() => void model.nextChapter()}>Next ›</button>
    </div>
  {/if}

  <div class="bsr-main">
    {#if view.toggles.nav === 'tree'}
      <div class="bsr-tree">
        {#each books as book (book)}
          {#if book === 1}<div class="bsr-tree-group">Old Testament</div>{/if}
          {#if book === 40}<div class="bsr-tree-group">New Testament</div>{/if}
          <button
            type="button"
            class="bsr-tree-book"
            class:bsr-on={book === view.position.book}
            onclick={() => (openBook = openBook === book ? null : book)}
          >{treeBook === book ? '▾' : '▸'} {bookName(book)}</button>
          {#if treeBook === book}
            <div class="bsr-tree-chapters">
              {#each chaptersOf(book) as chapter (chapter)}
                <button
                  type="button"
                  class="bsr-tree-chapter"
                  class:bsr-on={book === view.position.book && chapter === view.position.chapter}
                  onclick={() => void model.goTo(book, chapter)}
                >{chapter}</button>
              {/each}
            </div>
          {/if}
        {/each}
      </div>
    {/if}

    <div class="bsr-content">
      <div class="bsr-scroll">
        <div class="bsr-inner">
          <h1 class="bsr-title">{view.title}</h1>

          {#if view.status === 'loading'}
            <div class="bible-study-loading">Loading {view.title}…</div>
          {:else if view.status === 'no-translation'}
            <div class="bsr-nudge">
              No translation installed — install one in the Bible Study settings to start reading.
            </div>
          {:else if view.status === 'unavailable'}
            <div class="bsr-nudge">{view.title} is unavailable in this translation.</div>
          {:else if view.toggles.layout === 'verse-per-line'}
            {#each view.rows as row (row.verseId)}
              <div
                class="bsr-verse-line"
                class:bsr-hl={row.highlighted}
                class:bsr-sel={view.toggles.details === 'side-panel' && view.selectedVerseId === row.verseId}
                role="button"
                tabindex="0"
                onclick={() => void model.selectVerse(row.verseId)}
                onkeydown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault()
                    void model.selectVerse(row.verseId)
                  }
                }}
              >
                <span class="bsr-verse-num">{row.label}</span>
                {@render verseText(row)}
              </div>
              {#if view.toggles.details === 'inline' && row.expanded}
                <div class="bsr-expand">{@render detailsBlock(detailsFor(row))}</div>
              {/if}
            {/each}
          {:else}
            <p class="bsr-prose">
              {#each view.rows as row (row.verseId)}
                <span
                  class="bsr-verse-span"
                  class:bsr-hl={row.highlighted}
                  class:bsr-sel={view.toggles.details === 'side-panel' && view.selectedVerseId === row.verseId}
                  role="button"
                  tabindex="0"
                  onclick={() => void model.selectVerse(row.verseId)}
                  onkeydown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault()
                      void model.selectVerse(row.verseId)
                    }
                  }}
                ><sup class="bsr-verse-num">{row.label}</sup>{@render verseText(row)}</span>
                {' '}
              {/each}
            </p>
            {#if view.toggles.details === 'inline'}
              {#each view.rows.filter((row) => row.expanded) as row (row.verseId)}
                <div class="bsr-expand">{@render detailsBlock(detailsFor(row))}</div>
              {/each}
            {/if}
          {/if}

          {#if view.attribution !== null}
            <div class="bible-study-attribution">{view.attribution}</div>
          {/if}
        </div>
      </div>
    </div>

    {#if view.toggles.details === 'side-panel'}
      <div class="bsr-side">
        <div class="bsr-side-tabs">
          <button
            type="button"
            class="bsr-side-tab"
            class:bsr-on={sideTab === 'translations'}
            onclick={() => (sideTab = 'translations')}
          >Translations</button>
          <button
            type="button"
            class="bsr-side-tab"
            class:bsr-on={sideTab === 'notes'}
            onclick={() => (sideTab = 'notes')}
          >Notes</button>
        </div>
        <div class="bsr-side-body">
          {#if view.selectedVerseId === null}
            <div class="bsr-details-empty">Select a verse to see details.</div>
          {:else if selectedDetails === null}
            <div class="bsr-details-empty">Loading…</div>
          {:else if sideTab === 'translations'}
            <div class="bsr-details-title">{selectedDetails.title}</div>
            <table class="bsr-trans-table">
              <tbody>
                {#each selectedDetails.translations as row (row.id)}
                  <tr>
                    <td class="bsr-trans-id">{row.label}</td>
                    <td class="bsr-trans-text">
                      {#if row.text === null}
                        <span class="bsr-unavailable">Unavailable</span>
                      {:else}
                        {row.text}
                      {/if}
                    </td>
                  </tr>
                {/each}
              </tbody>
            </table>
          {:else}
            <div class="bsr-details-title">{selectedDetails.title}</div>
            {#if selectedDetails.notes.length === 0}
              <div class="bsr-details-empty">No annotations or intersecting notes.</div>
            {:else}
              {#each selectedDetails.notes as note (note.file)}
                <button
                  type="button"
                  class="bsr-note-card"
                  class:bsr-note-anno={note.annotation}
                  onclick={() => openNote(note.file)}
                >
                  <span class="bsr-note-path">{note.file}</span>
                </button>
              {/each}
            {/if}
          {/if}
        </div>
      </div>
    {/if}
  </div>
</div>

<style>
  .bsr-shell {
    display: flex;
    flex-direction: column;
    height: 100%;
  }

  .bsr-banner {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 4px 12px;
    background: hsla(var(--interactive-accent-hsl), 0.12);
    border-bottom: 1px solid var(--background-modifier-border);
    color: var(--text-accent);
    font-size: var(--font-ui-small);
  }

  .bsr-banner-dismiss {
    margin-left: auto;
    background: none;
    border: none;
    box-shadow: none;
    padding: 0 4px;
    cursor: pointer;
    color: var(--text-muted);
  }

  .bsr-toolbar {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 10px;
    padding: 6px 12px;
    border-bottom: 1px solid var(--background-modifier-border);
  }

  .bsr-seg-group {
    display: inline-flex;
    align-items: center;
    gap: 4px;
  }

  .bsr-seg-label {
    font-size: var(--font-smallest);
    color: var(--text-faint);
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  .bsr-seg {
    display: inline-flex;
    border: 1px solid var(--background-modifier-border);
    border-radius: var(--radius-s);
    overflow: hidden;
  }

  .bsr-seg button {
    background: var(--background-secondary);
    border: none;
    border-radius: 0;
    box-shadow: none;
    padding: 2px 8px;
    font-size: var(--font-ui-smaller);
    color: var(--text-muted);
    cursor: pointer;
  }

  .bsr-seg button.bsr-on,
  .bsr-pill.bsr-on {
    background: hsla(var(--interactive-accent-hsl), 0.15);
    color: var(--text-accent);
  }

  .bsr-pill {
    background: var(--background-secondary);
    border: 1px solid var(--background-modifier-border);
    border-radius: 999px;
    box-shadow: none;
    padding: 2px 10px;
    font-size: var(--font-ui-smaller);
    color: var(--text-muted);
    cursor: pointer;
  }

  .bsr-pill.bsr-on {
    border-color: var(--text-accent);
  }

  .bsr-spacer {
    flex: 1;
  }

  .bsr-crumb {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 6px 12px;
    border-bottom: 1px solid var(--background-modifier-border);
  }

  .bsr-crumb-sep {
    color: var(--text-faint);
  }

  .bsr-step {
    background: none;
    border: none;
    box-shadow: none;
    padding: 2px 8px;
    border-radius: var(--radius-s);
    color: var(--text-muted);
    cursor: pointer;
  }

  .bsr-step:hover {
    background: var(--background-modifier-hover);
    color: var(--text-normal);
  }

  .bsr-main {
    flex: 1;
    display: flex;
    min-height: 0;
  }

  .bsr-tree {
    width: 200px;
    flex-shrink: 0;
    border-right: 1px solid var(--background-modifier-border);
    overflow-y: auto;
    padding: 8px 0 40px;
    font-size: var(--font-ui-small);
  }

  .bsr-tree-group {
    padding: 4px 12px;
    margin-top: 8px;
    color: var(--text-faint);
    font-size: var(--font-smallest);
    text-transform: uppercase;
    letter-spacing: 0.06em;
  }

  .bsr-tree-book {
    display: block;
    width: 100%;
    text-align: left;
    background: none;
    border: none;
    box-shadow: none;
    padding: 2px 12px;
    color: var(--text-muted);
    cursor: pointer;
  }

  .bsr-tree-book:hover {
    color: var(--text-normal);
    background: var(--background-modifier-hover);
  }

  .bsr-tree-book.bsr-on {
    color: var(--text-accent);
  }

  .bsr-tree-chapters {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
    padding: 4px 12px 8px 20px;
  }

  .bsr-tree-chapter {
    width: 30px;
    height: 26px;
    border: none;
    border-radius: var(--radius-s);
    box-shadow: none;
    background: var(--background-secondary);
    color: var(--text-muted);
    font-size: var(--font-ui-smaller);
    cursor: pointer;
  }

  .bsr-tree-chapter.bsr-on {
    background: hsla(var(--interactive-accent-hsl), 0.15);
    color: var(--text-accent);
    outline: 1px solid var(--text-accent);
  }

  .bsr-content {
    flex: 1;
    display: flex;
    flex-direction: column;
    min-width: 0;
  }

  .bsr-scroll {
    flex: 1;
    overflow-y: auto;
    padding: 16px 24px 60px;
  }

  .bsr-inner {
    max-width: var(--file-line-width);
    margin: 0 auto;
  }

  .bsr-title {
    font-size: var(--h3-size);
    margin: 0 0 12px;
  }

  .bsr-verse-line {
    padding: 3px 8px;
    border-radius: var(--radius-s);
    cursor: pointer;
    line-height: 1.65;
  }

  .bsr-verse-line:hover {
    background: var(--background-modifier-hover);
  }

  .bsr-verse-line.bsr-hl {
    background: hsla(var(--interactive-accent-hsl), 0.1);
    box-shadow: inset 3px 0 0 var(--text-accent);
    border-radius: 0 var(--radius-s) var(--radius-s) 0;
  }

  .bsr-verse-line.bsr-sel,
  .bsr-verse-span.bsr-sel {
    background: hsla(var(--interactive-accent-hsl), 0.18);
  }

  .bsr-verse-num {
    color: var(--text-accent);
    font-size: 0.75em;
    font-weight: 600;
    margin-right: 5px;
  }

  .bsr-prose {
    font-size: var(--font-text-size);
    line-height: 1.85;
  }

  .bsr-verse-span {
    cursor: pointer;
    border-radius: 3px;
    padding: 1px 2px;
  }

  .bsr-verse-span:hover {
    background: var(--background-modifier-hover);
  }

  .bsr-verse-span.bsr-hl {
    background: hsla(var(--interactive-accent-hsl), 0.1);
    box-shadow: -3px 0 0 var(--text-accent);
  }

  .bsr-mark-anno {
    color: var(--color-yellow);
    font-size: 0.7em;
    margin-left: 4px;
    vertical-align: super;
  }

  .bsr-mark-inter {
    color: var(--color-blue);
    font-size: 0.7em;
    margin-left: 3px;
    vertical-align: super;
  }

  .bsr-expand {
    margin: 4px 0 10px 24px;
    border: 1px solid var(--background-modifier-border);
    border-radius: var(--radius-m);
    background: var(--background-secondary);
    padding: 8px 12px;
    font-size: var(--font-ui-small);
  }

  .bsr-details-title {
    font-size: var(--font-smallest);
    color: var(--text-faint);
    margin-bottom: 6px;
  }

  .bsr-details-empty {
    color: var(--text-faint);
    font-size: var(--font-ui-small);
    margin: 6px 0;
  }

  .bsr-trans-table {
    width: 100%;
    border-collapse: collapse;
    margin-bottom: 6px;
  }

  .bsr-trans-table td {
    padding: 4px 8px;
    vertical-align: top;
    border-top: 1px solid var(--background-modifier-border);
  }

  .bsr-trans-table tr:first-child td {
    border-top: none;
  }

  .bsr-trans-id {
    color: var(--text-accent);
    font-weight: 600;
    width: 52px;
  }

  .bsr-unavailable {
    color: var(--text-faint);
    font-style: italic;
  }

  .bsr-note-card {
    display: block;
    width: 100%;
    text-align: left;
    border: 1px solid var(--background-modifier-border);
    border-radius: var(--radius-m);
    background: var(--background-secondary);
    box-shadow: none;
    padding: 6px 10px;
    margin: 6px 0;
    font-size: var(--font-ui-small);
    cursor: pointer;
    border-left: 3px solid var(--color-blue);
  }

  .bsr-note-card:hover {
    border-color: var(--text-accent);
  }

  .bsr-note-card.bsr-note-anno {
    border-left-color: var(--color-yellow);
  }

  .bsr-note-path {
    color: var(--text-muted);
  }

  .bsr-nudge {
    color: var(--text-faint);
    font-style: italic;
    margin: 12px 0;
  }

  .bsr-side {
    width: 300px;
    flex-shrink: 0;
    border-left: 1px solid var(--background-modifier-border);
    display: flex;
    flex-direction: column;
  }

  .bsr-side-tabs {
    display: flex;
    border-bottom: 1px solid var(--background-modifier-border);
  }

  .bsr-side-tab {
    flex: 1;
    background: none;
    border: none;
    border-radius: 0;
    box-shadow: none;
    padding: 8px;
    font-size: var(--font-ui-small);
    color: var(--text-muted);
    border-bottom: 2px solid transparent;
    cursor: pointer;
  }

  .bsr-side-tab.bsr-on {
    color: var(--text-accent);
    border-bottom-color: var(--text-accent);
  }

  .bsr-side-body {
    flex: 1;
    overflow-y: auto;
    padding: 10px 12px 40px;
  }
</style>
