<script lang="ts">
  import { BOOK_COUNT, bookName, chapterCount, type Reference } from '../reference'
  import type {
    NavigationOptions,
    StudyMaterial,
    StudyMaterialSource,
    VerseDetailsView,
  } from '../contracts'
  import type { CrossReference } from '../cross-references'
  import {
    paragraphsOf,
    type ReaderPaneModel,
    type ReaderToggles,
    type VerseRowView,
  } from './reader-pane-model'
  import type { VerseSegment } from '../rendering'
  import CollectionStrip from '../study-material/CollectionStrip.svelte'
  import StudyMaterialView from '../study-material/StudyMaterialView.svelte'
  import type { StudyMaterialHost, StudySubTab } from '../study-material'
  import VerseDetails from '../study-material/VerseDetails.svelte'
  import TranslationMenu from './TranslationMenu.svelte'
  import OptionsMenu from './OptionsMenu.svelte'

  let {
    model,
    openNote,
    openReference,
    editCrossReferenceInNewPane,
    onAnnotate,
    renderMarkdown,
  }: {
    model: ReaderPaneModel
    openNote: (file: string) => void
    openReference: (reference: Reference, options?: NavigationOptions) => void
    editCrossReferenceInNewPane: (entry: CrossReference) => void
    onAnnotate: (reference: Reference) => void
    renderMarkdown: (el: HTMLElement, markdown: string, sourcePath: string) => void
  } = $props()

  // The details surfaces read the pane through the study material contract —
  // the same seam the Study Panel consumes — never through reader-only state.
  // svelte-ignore state_referenced_locally
  const studySource: StudyMaterialSource = model

  // Initial snapshots only — the subscription below keeps them fresh.
  // svelte-ignore state_referenced_locally
  let view = $state.raw(model.view)
  // svelte-ignore state_referenced_locally
  let material = $state.raw<StudyMaterial>(studySource.studyMaterial)
  $effect(() =>
    studySource.subscribe(() => {
      view = model.view
      material = studySource.studyMaterial
    }),
  )

  // This pane's own side region: one pane, one sub-tab choice.
  let subTab = $state<StudySubTab>('translations')

  // What the shared study-material surfaces need from the workspace around
  // this pane; everything else they do goes through the study source above.
  const host: StudyMaterialHost = {
    openNote: (file) => openNote(file),
    openReference: (reference, options) => openReference(reference, options),
    editCrossReferenceInNewPane: (entry) => editCrossReferenceInNewPane(entry),
    annotate: (reference) => onAnnotate(reference),
    renderMarkdown: (el, markdown, sourcePath) =>
      renderMarkdown(el, markdown, sourcePath),
  }

  let openBook: number | null = $state(null)

  const books = Array.from({ length: BOOK_COUNT }, (_, index) => index + 1)
  const chaptersOf = (book: number): number[] =>
    Array.from({ length: chapterCount(book) }, (_, index) => index + 1)

  const treeBook = $derived(openBook ?? view.position.book)

  const setToggle = (key: keyof ReaderToggles, value: string): void => {
    model.setToggle(key, value as ReaderToggles[typeof key])
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
    event: MouseEvent | KeyboardEvent,
    verseId: number,
    strongs: string[],
  ): void => {
    event.stopPropagation()
    void model.selectWord(verseId, strongs)
  }

  const inSelectionSpan = (verseId: number): boolean => {
    if (material.selectedVerseId === null || material.selectionEndId === null)
      return false
    const low = Math.min(material.selectedVerseId, material.selectionEndId)
    const high = Math.max(material.selectedVerseId, material.selectionEndId)
    return verseId >= low && verseId <= high
  }

  const verseSelected = (verseId: number): boolean =>
    inSelectionSpan(verseId) ||
    (view.toggles.details === 'side-panel' &&
      material.selectedVerseId === verseId)

  const onBookPicked = (event: Event): void => {
    const book = Number((event.target as HTMLSelectElement).value)
    void model.goTo(book, 1)
  }

  const onChapterPicked = (event: Event): void => {
    void model.goTo(view.position.book, Number((event.target as HTMLSelectElement).value))
  }
</script>

{#snippet formattedText(segment: VerseSegment)}{#if segment.redLetter || segment.supplied || segment.psalmHeading}<span
      class:scripture-study-red-letter={segment.redLetter}
      class:scripture-study-supplied={segment.supplied}
      class:scripture-study-psalm-heading={segment.psalmHeading}
    >{segment.text}</span>{:else}{segment.text}{/if}{/snippet}

{#snippet inlineDetails(row: VerseRowView)}
  {@const details = detailsFor(row)}
  <div class="bsr-expand">
    {#if details === null}
      <div class="bsr-details-empty">Loading…</div>
    {:else}
      <VerseDetails
        {details}
        source={studySource}
        {host}
        collecting={material.collection !== null}
        tab={null}
      />
    {/if}
  </div>
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
    <OptionsMenu
      toggles={view.toggles}
      strongsAvailable={view.strongsAvailable}
      fontScalePercent={view.fontScalePercent}
      onSetToggle={setToggle}
      onIncreaseFontScale={() => model.increaseFontScale()}
      onDecreaseFontScale={() => model.decreaseFontScale()}
      onResetFontScale={() => model.resetFontScale()}
    />
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

  {#if material.collection !== null}
    <CollectionStrip collection={material.collection} source={studySource} />
  {/if}

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
                {@render inlineDetails(row)}
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
                {@render inlineDetails(row)}
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
        <StudyMaterialView
          {material}
          source={studySource}
          {host}
          tab={subTab}
          selectTab={(tab) => (subTab = tab)}
        />
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

  .bsr-details-empty {
    color: var(--text-faint);
    font-size: var(--font-ui-small);
    margin: 6px 0;
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

  .bsr-side {
    width: 300px;
    flex-shrink: 0;
    border-left: 1px solid var(--background-modifier-border);
    display: flex;
    flex-direction: column;
  }
</style>
