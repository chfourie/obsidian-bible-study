<script lang="ts">
  import { setIcon } from 'obsidian'
  import { BOOK_COUNT, bookName, chapterCount, type Reference } from '../reference'
  import {
    FONT_SCALE_MAX,
    FONT_SCALE_MIN,
    paragraphsOf,
    type ReaderPaneModel,
    type ReaderToggles,
    type VerseDetailsView,
    type VerseRowView,
  } from './reader-pane-model'
  import type { VerseSegment } from '../rendering'
  import TranslationMenu from './TranslationMenu.svelte'

  let {
    model,
    openNote,
    onAnnotate,
    renderMarkdown,
  }: {
    model: ReaderPaneModel
    openNote: (file: string) => void
    onAnnotate: (reference: Reference) => void
    renderMarkdown: (el: HTMLElement, markdown: string, sourcePath: string) => void
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

  type ToggleGroup = {
    key: keyof ReaderToggles
    label: string
    options: { value: string; label: string }[]
  }

  const strongsToggleGroup: ToggleGroup = {
    key: 'strongs',
    label: "Strong's",
    options: [
      { value: 'off', label: 'Off' },
      { value: 'on', label: 'On' },
    ],
  }

  const toggleGroups: ToggleGroup[] = [
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
    {
      key: 'redLetter',
      label: 'Red letter',
      options: [
        { value: 'off', label: 'Off' },
        { value: 'on', label: 'On' },
      ],
    },
  ]

  const setToggle = (key: keyof ReaderToggles, value: string): void => {
    model.setToggle(key, value as ReaderToggles[typeof key])
  }

  const icon = (node: HTMLElement, name: string) => {
    setIcon(node, name)
  }

  const contentFontSize = $derived(
    `calc(var(--font-text-size) * ${view.fontScalePercent / 100})`,
  )

  // The translation pills collapse to a dropdown when their natural width no
  // longer fits the toolbar space left over by the toggle groups. The hidden
  // measurer keeps rendering the pills so the row can expand back.
  let pillSlotEl: HTMLElement | null = $state(null)
  let pillMeasureEl: HTMLElement | null = $state(null)
  let pillsCollapsed = $state(false)

  const remeasurePills = (): void => {
    if (pillSlotEl === null || pillMeasureEl === null) return
    pillsCollapsed = pillMeasureEl.scrollWidth > pillSlotEl.clientWidth
  }

  $effect(() => {
    void view.translations
    remeasurePills()
  })

  $effect(() => {
    if (pillSlotEl === null) return
    const observer = new ResizeObserver(remeasurePills)
    observer.observe(pillSlotEl)
    return () => observer.disconnect()
  })

  const verseMarks = (row: VerseRowView): { anno: boolean; mentions: number } => ({
    anno: row.annotations > 0,
    mentions: row.mentions,
  })

  const detailsFor = (row: VerseRowView): VerseDetailsView | null =>
    row.expanded ? (view.details[row.verseId] ?? null) : null

  const onVerseClick = (event: MouseEvent, verseId: number): void => {
    if (event.shiftKey) model.extendSelectionTo(verseId)
    else void model.selectVerse(verseId)
  }

  const onWordClick = (
    event: MouseEvent,
    verseId: number,
    strongs: string[],
  ): void => {
    event.stopPropagation()
    void model.selectWord(verseId, strongs)
  }

  const inSelectionSpan = (verseId: number): boolean => {
    if (view.selectedVerseId === null || view.selectionEndId === null) return false
    const low = Math.min(view.selectedVerseId, view.selectionEndId)
    const high = Math.max(view.selectedVerseId, view.selectionEndId)
    return verseId >= low && verseId <= high
  }

  const verseSelected = (verseId: number): boolean =>
    inSelectionSpan(verseId) ||
    (view.toggles.details === 'side-panel' && view.selectedVerseId === verseId)

  const annotateVerseBlock = (verseId: number): void => {
    onAnnotate(model.annotationReference(verseId))
  }

  type MarkdownBody = { text: string; path: string }
  const markdown = (el: HTMLElement, body: MarkdownBody) => {
    const render = (value: MarkdownBody): void => {
      el.replaceChildren()
      renderMarkdown(el, value.text, value.path)
    }
    render(body)
    return { update: render }
  }

  const onBookPicked = (event: Event): void => {
    const book = Number((event.target as HTMLSelectElement).value)
    void model.goTo(book, 1)
  }

  const onChapterPicked = (event: Event): void => {
    void model.goTo(view.position.book, Number((event.target as HTMLSelectElement).value))
  }
</script>

{#snippet notesBlock(details: VerseDetailsView)}
  <div class="bsr-notes-head">
    <span class="bsr-group-label">Annotations</span>
    <button type="button" class="bsr-annotate" onclick={() => annotateVerseBlock(details.verseId)}>Annotate</button>
  </div>
  {#if details.annotations.length === 0}
    <div class="bsr-details-empty">No annotations.</div>
  {:else}
    {#each details.annotations as block (block.file)}
      <details class="bsr-anno-block" open>
        <summary class="bsr-anno-summary">
          <span class="bsr-anno-fold" aria-hidden="true">▾</span>
          <button
            type="button"
            class="bsr-anno-title"
            aria-label="Open annotation in editor"
            onclick={(event) => {
              event.preventDefault()
              openNote(block.file)
            }}
          >{block.title}</button>
          <button
            type="button"
            class="bsr-anno-edit"
            aria-label="Open annotation in editor"
            onclick={(event) => {
              event.preventDefault()
              openNote(block.file)
            }}
          >✎</button>
        </summary>
        <div class="bsr-anno-body" use:markdown={{ text: block.body, path: block.file }}></div>
      </details>
    {/each}
  {/if}
  <div class="bsr-group-label">Mentions</div>
  {#if details.mentions.length === 0}
    <div class="bsr-details-empty">No intersecting notes.</div>
  {:else}
    {#each details.mentions as note (note.file)}
      <button
        type="button"
        class="bsr-note-card"
        onclick={() => openNote(note.file)}
      >
        <span class="bsr-note-path">{note.file}</span>
      </button>
    {/each}
  {/if}
{/snippet}

{#snippet strongsBlock(details: VerseDetailsView)}
  {#if details.strongs.length > 0}
    <div class="bsr-group-label">Strong's</div>
    {#each details.strongs as entry (entry.strongs)}
      <div class="bsr-strongs-entry">
        <div class="bsr-strongs-head">
          <span class="bsr-strongs-number">{entry.strongs}</span>
          <span class="bsr-strongs-lemma">{entry.lemma}</span>
          <span class="bsr-strongs-translit">{entry.transliteration}</span>
        </div>
        <div class="bsr-strongs-gloss">{entry.gloss}</div>
        <div class="bsr-strongs-definition">{entry.definition}</div>
      </div>
    {/each}
    {#if details.strongsAttribution !== null}
      <div class="bsr-strongs-attribution">{details.strongsAttribution}</div>
    {/if}
  {/if}
{/snippet}

{#snippet formattedText(segment: VerseSegment)}{#if segment.redLetter || segment.supplied || segment.psalmHeading}<span
      class:scripture-study-red-letter={segment.redLetter}
      class:scripture-study-supplied={segment.supplied}
      class:scripture-study-psalm-heading={segment.psalmHeading}
    >{segment.text}</span>{:else}{segment.text}{/if}{/snippet}

{#snippet detailsBlock(details: VerseDetailsView | null)}
  {#if details === null}
    <div class="bsr-details-empty">Loading…</div>
  {:else}
    <div class="bsr-details-title">{details.title}</div>
    {@render strongsBlock(details)}
    <table class="bsr-trans-table">
      <tbody>
        {#each details.translations as row (row.id)}
          <tr>
            <td class="bsr-trans-id" title={row.name}>{row.label}</td>
            <td class="bsr-trans-text">
              {#if row.segments === null}
                <span class="bsr-unavailable">Unavailable</span>
              {:else}
                {#each row.segments as segment, index (index)}{@render formattedText(segment)}{/each}
              {/if}
            </td>
          </tr>
        {/each}
      </tbody>
    </table>
    {@render notesBlock(details)}
  {/if}
{/snippet}

{#snippet segmentText(row: VerseRowView, segment: VerseSegment)}{#if view.strongsMode && segment.strongs !== undefined}<span
      role="button"
      tabindex="0"
      class="bsr-strongs-word"
      class:scripture-study-red-letter={segment.redLetter}
      class:scripture-study-supplied={segment.supplied}
      class:scripture-study-psalm-heading={segment.psalmHeading}
      onclick={(event) => onWordClick(event, row.verseId, segment.strongs ?? [])}
      onkeydown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault()
          onWordClick(event, row.verseId, segment.strongs ?? [])
        }
      }}
    >{segment.text}</span>{:else}{@render formattedText(segment)}{/if}{/snippet}

{#snippet verseText(row: VerseRowView)}
  {@const lineStructured = view.toggles.layout === 'verse-per-line' || row.poetry}
  {#each row.segments as segment, index (index)}
    {#if segment.lineBreakBefore && lineStructured}<br />{/if}
    {#if lineStructured && segment.lineStart && segment.indent !== undefined}<span
        class="scripture-study-indent-{segment.indent}"
      >{@render segmentText(row, segment)}</span>{:else}{@render segmentText(row, segment)}{/if}
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
    {#each view.strongsAvailable ? [...toggleGroups, strongsToggleGroup] : toggleGroups as toggleGroup (toggleGroup.key)}
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
    <span class="bsr-seg-group">
      <span class="bsr-seg-label">Text</span>
      <span class="bsr-seg">
        <button
          type="button"
          class="bsr-font-btn"
          aria-label="Decrease text size"
          disabled={view.fontScalePercent <= FONT_SCALE_MIN}
          onclick={() => model.decreaseFontScale()}
          use:icon={'a-arrow-down'}
        ></button>
        <button
          type="button"
          class="bsr-font-reset"
          aria-label="Reset text size"
          title="Reset text size"
          onclick={() => model.resetFontScale()}
        >{view.fontScalePercent}%</button>
        <button
          type="button"
          class="bsr-font-btn"
          aria-label="Increase text size"
          disabled={view.fontScalePercent >= FONT_SCALE_MAX}
          onclick={() => model.increaseFontScale()}
          use:icon={'a-arrow-up'}
        ></button>
      </span>
    </span>
    <span class="bsr-trans" bind:this={pillSlotEl}>
      <span class="bsr-trans-measure" aria-hidden="true" bind:this={pillMeasureEl}>
        {#each view.translations as pill (pill.id)}
          <button type="button" class="bsr-pill" tabindex="-1">{pill.label}</button>
        {/each}
      </span>
      {#if pillsCollapsed}
        <TranslationMenu
          options={view.translations}
          onPick={(id) => void model.setTranslation(id)}
        />
      {:else}
        {#each view.translations as pill (pill.id)}
          <button
            type="button"
            class="bsr-pill"
            class:bsr-on={pill.active}
            title={pill.name}
            onclick={() => void model.setTranslation(pill.id)}
          >{pill.label}</button>
        {/each}
      {/if}
    </span>
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
      <button type="button" class="bsr-step" disabled={!view.hasPreviousChapter} onclick={() => void model.previousChapter()}>‹ Previous</button>
      <button type="button" class="bsr-step" disabled={!view.hasNextChapter} onclick={() => void model.nextChapter()}>Next ›</button>
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
      <div class="bsr-scroll" style:font-size={contentFontSize}>
        <div class="bsr-inner">
          <div class="bsr-title-row">
            <h1 class="bsr-title">{view.title}</h1>
            <span class="bsr-title-nav">
              <button
                type="button"
                class="bsr-chapter-step"
                aria-label="Previous chapter"
                disabled={!view.hasPreviousChapter}
                onclick={() => void model.previousChapter()}
              >‹</button>
              <button
                type="button"
                class="bsr-chapter-step"
                aria-label="Next chapter"
                disabled={!view.hasNextChapter}
                onclick={() => void model.nextChapter()}
              >›</button>
            </span>
          </div>

          {#if view.status === 'loading'}
            <div class="scripture-study-loading">Loading {view.title}…</div>
          {:else if view.status === 'no-translation'}
            <div class="bsr-nudge">
              No translation installed — install one in the Scripture Study settings to start reading.
            </div>
            {#if view.installNudge}
              <button
                type="button"
                class="bsr-install-cta mod-cta"
                disabled={view.installNudge.busy}
                onclick={() => void model.installSuggestedTranslation()}
              >
                {view.installNudge.busy
                  ? `Installing ${view.installNudge.translationName}…`
                  : `Install ${view.installNudge.translationName}`}
              </button>
              {#if view.installNudge.error !== null}
                <div class="bsr-install-error">
                  Install failed: {view.installNudge.error}
                </div>
              {/if}
            {/if}
          {:else if view.status === 'unavailable'}
            <div class="bsr-nudge">{view.title} is unavailable in this translation.</div>
          {:else if view.toggles.layout === 'verse-per-line'}
            {#each view.rows as row (row.verseId)}
              <div
                class="bsr-verse-line"
                class:bsr-hl={row.highlighted}
                class:bsr-sel={verseSelected(row.verseId)}
                role="button"
                tabindex="0"
                onclick={(event) => onVerseClick(event, row.verseId)}
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
            {#each paragraphsOf(view.rows) as paragraph (paragraph[0].verseId)}
              <p class="bsr-prose">
                {#each paragraph as row (row.verseId)}
                  <span
                    class="bsr-verse-span"
                    class:bsr-hl={row.highlighted}
                    class:bsr-sel={verseSelected(row.verseId)}
                    role="button"
                    tabindex="0"
                    onclick={(event) => onVerseClick(event, row.verseId)}
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
            {/each}
            {#if view.toggles.details === 'inline'}
              {#each view.rows.filter((row) => row.expanded) as row (row.verseId)}
                <div class="bsr-expand">{@render detailsBlock(detailsFor(row))}</div>
              {/each}
            {/if}
          {/if}

          {#if view.status === 'ok'}
            <div class="bsr-foot-nav">
              <button type="button" class="bsr-step" disabled={!view.hasPreviousChapter} onclick={() => void model.previousChapter()}>‹ Previous</button>
              <button type="button" class="bsr-step" disabled={!view.hasNextChapter} onclick={() => void model.nextChapter()}>Next ›</button>
            </div>
          {/if}

          {#if view.attribution !== null}
            <div class="scripture-study-attribution">{view.attribution}</div>
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
          {:else}
            <div class="bsr-details-title">{selectedDetails.title}</div>
            {@render strongsBlock(selectedDetails)}
            {#if sideTab === 'translations'}
              <table class="bsr-trans-table">
                <tbody>
                  {#each selectedDetails.translations as row (row.id)}
                    <tr>
                      <td class="bsr-trans-id" title={row.name}>{row.label}</td>
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
              {@render notesBlock(selectedDetails)}
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

  .bsr-font-btn {
    display: inline-flex;
    align-items: center;
  }

  .bsr-font-btn :global(svg) {
    width: 14px;
    height: 14px;
  }

  .bsr-font-btn:disabled {
    color: var(--text-faint);
    cursor: default;
  }

  .bsr-font-reset {
    min-width: 42px;
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

  .bsr-trans {
    position: relative;
    flex: 1;
    min-width: 0;
    display: flex;
    justify-content: flex-end;
    align-items: center;
    gap: 10px;
  }

  .bsr-trans-measure {
    position: absolute;
    visibility: hidden;
    pointer-events: none;
    display: flex;
    gap: 10px;
    white-space: nowrap;
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

  .bsr-title-row {
    display: flex;
    align-items: center;
    gap: 8px;
    margin: 0 0 12px;
  }

  .bsr-title {
    font-size: var(--h3-size);
    margin: 0;
  }

  .bsr-title-nav {
    display: inline-flex;
    gap: 2px;
  }

  .bsr-chapter-step {
    background: none;
    border: none;
    box-shadow: none;
    width: 26px;
    height: 26px;
    padding: 0;
    border-radius: var(--radius-s);
    color: var(--text-muted);
    font-size: 1.2em;
    line-height: 1;
    cursor: pointer;
  }

  .bsr-chapter-step:hover:not(:disabled) {
    background: var(--background-modifier-hover);
    color: var(--text-normal);
  }

  .bsr-chapter-step:disabled,
  .bsr-step:disabled {
    color: var(--text-faint);
    cursor: default;
  }

  .bsr-step:disabled:hover {
    background: none;
  }

  .bsr-foot-nav {
    display: flex;
    justify-content: space-between;
    margin-top: 20px;
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
    font-size: inherit;
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

  .bsr-note-path {
    color: var(--text-muted);
  }

  .bsr-notes-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-top: 8px;
  }

  .bsr-group-label {
    display: block;
    margin-top: 8px;
    font-size: var(--font-smallest);
    color: var(--text-faint);
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  .bsr-notes-head .bsr-group-label {
    margin-top: 0;
  }

  .bsr-annotate {
    background: hsla(var(--interactive-accent-hsl), 0.15);
    border: none;
    border-radius: var(--radius-s);
    box-shadow: none;
    padding: 2px 10px;
    font-size: var(--font-ui-smaller);
    color: var(--text-accent);
    cursor: pointer;
  }

  .bsr-anno-block {
    border: 1px solid var(--background-modifier-border);
    border-left: 3px solid var(--color-yellow);
    border-radius: var(--radius-m);
    background: var(--background-secondary);
    margin: 6px 0;
    padding: 4px 10px;
    font-size: var(--font-ui-small);
  }

  .bsr-anno-summary {
    display: flex;
    align-items: center;
    gap: 6px;
    cursor: pointer;
    list-style: none;
  }

  .bsr-anno-fold {
    color: var(--text-faint);
    font-size: 0.8em;
  }

  .bsr-anno-block:not([open]) .bsr-anno-fold {
    rotate: -90deg;
  }

  .bsr-anno-title {
    flex: 1;
    background: none;
    border: none;
    box-shadow: none;
    padding: 0;
    text-align: left;
    color: var(--text-normal);
    font-weight: 600;
    font-size: inherit;
    cursor: pointer;
  }

  .bsr-anno-title:hover {
    color: var(--text-accent);
  }

  .bsr-anno-edit {
    background: none;
    border: none;
    box-shadow: none;
    padding: 0 4px;
    color: var(--text-muted);
    cursor: pointer;
  }

  .bsr-anno-edit:hover {
    color: var(--text-accent);
  }

  .bsr-anno-body {
    max-height: 240px;
    overflow-y: auto;
    padding: 4px 0 6px;
    user-select: text;
  }

  .bsr-nudge {
    color: var(--text-faint);
    font-style: italic;
    margin: 12px 0;
  }

  .bsr-install-cta {
    margin: 4px 0 12px;
    cursor: pointer;
  }

  .bsr-install-error {
    color: var(--text-error);
    font-size: var(--font-smallest);
    margin-bottom: 12px;
  }

  .bsr-strongs-word {
    cursor: pointer;
  }

  .bsr-strongs-word:hover {
    background: hsla(var(--interactive-accent-hsl), 0.15);
    border-radius: 2px;
  }

  .bsr-strongs-entry {
    border: 1px solid var(--background-modifier-border);
    border-left: 3px solid var(--text-accent);
    border-radius: var(--radius-m);
    background: var(--background-secondary);
    margin: 6px 0;
    padding: 6px 10px;
    font-size: var(--font-ui-small);
  }

  .bsr-strongs-head {
    display: flex;
    align-items: baseline;
    gap: 8px;
  }

  .bsr-strongs-number {
    color: var(--text-accent);
    font-weight: 600;
    font-size: var(--font-ui-smaller);
  }

  .bsr-strongs-lemma {
    font-size: 1.1em;
  }

  .bsr-strongs-translit {
    color: var(--text-muted);
    font-style: italic;
  }

  .bsr-strongs-gloss {
    font-weight: 600;
    margin-top: 2px;
  }

  .bsr-strongs-definition {
    margin-top: 4px;
    color: var(--text-muted);
    white-space: pre-line;
    max-height: 200px;
    overflow-y: auto;
    user-select: text;
  }

  .bsr-strongs-attribution {
    color: var(--text-faint);
    font-size: var(--font-smallest);
    margin: 4px 0 8px;
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
