<script lang="ts">
  import {
    BOOK_COUNT,
    bookName,
    chapterCount,
    type VerseRange,
  } from '../reference'
  import type { StudyMaterial, StudyMaterialSource } from '../contracts'
  import {
    paragraphsOf,
    type ReaderPaneModel,
    type ReaderToggles,
    type VerseRowView,
  } from './reader-pane-model'
  import type { VerseSegment } from '../rendering'
  import CollectionStrip from '../study-material/CollectionStrip.svelte'
  import TranslationMenu from './TranslationMenu.svelte'
  import OptionsMenu from './OptionsMenu.svelte'

  let {
    model,
  }: {
    model: ReaderPaneModel
  } = $props()

  // The collect strip reads the pane through the study material contract —
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

  const books = Array.from({ length: BOOK_COUNT }, (_, index) => index + 1)
  const chaptersOf = (book: number): number[] =>
    Array.from({ length: chapterCount(book) }, (_, index) => index + 1)

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

  const onRefClick = (
    event: MouseEvent | KeyboardEvent,
    refs: VerseRange[],
  ): void => {
    event.stopPropagation()
    void model.openRefSpan(refs)
  }

  const inSelectionSpan = (verseId: number): boolean => {
    if (material.selectedVerseId === null || material.selectionEndId === null)
      return false
    const low = Math.min(material.selectedVerseId, material.selectionEndId)
    const high = Math.max(material.selectedVerseId, material.selectionEndId)
    return verseId >= low && verseId <= high
  }

  const verseSelected = (verseId: number): boolean =>
    inSelectionSpan(verseId) || material.selectedVerseId === verseId

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

{#snippet citedText(segment: VerseSegment)}{#if segment.refs !== undefined}<span
      role="link"
      tabindex="0"
      class="bsr-ref-link"
      onclick={(event) => onRefClick(event, segment.refs ?? [])}
      onkeydown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault()
          onRefClick(event, segment.refs ?? [])
        }
      }}
    >{segment.text}</span>{:else}{@render formattedText(segment)}{/if}{/snippet}

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
    >{segment.text}</span>{:else}{@render citedText(segment)}{/if}{/snippet}

{#snippet matchedText(row: VerseRowView, segment: VerseSegment)}{#if segment.emphasized}<mark
      class="bsr-match">{@render segmentText(row, segment)}</mark
    >{:else}{@render segmentText(row, segment)}{/if}{/snippet}

{#snippet verseText(row: VerseRowView)}
  {@const lineStructured = view.toggles.layout === 'verse-per-line' || row.poetry}
  {#each row.segments as segment, index (index)}
    {#if segment.lineBreakBefore && lineStructured}<br />{/if}
    {#if lineStructured && segment.lineStart && segment.indent !== undefined}<span
        class="scripture-study-indent-{segment.indent}"
      >{@render matchedText(row, segment)}</span>{:else}{@render matchedText(row, segment)}{/if}
  {/each}
  {#if row.annotations > 0}
    <span class="bsr-mark-anno" title={row.annotations > 1 ? `${row.annotations} annotations` : 'Annotation'}>●{row.annotations > 1 ? row.annotations : ''}</span>
  {/if}
  {#if row.mentions > 0}
    <span class="bsr-mark-inter" title="{row.mentions} intersecting notes">◆{row.mentions > 1 ? row.mentions : ''}</span>
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
      bookMode={view.book !== null}
      fontScalePercent={view.fontScalePercent}
      onSetToggle={setToggle}
      onIncreaseFontScale={() => model.increaseFontScale()}
      onDecreaseFontScale={() => model.decreaseFontScale()}
      onResetFontScale={() => model.resetFontScale()}
    />
    {#if view.book !== null}
      <span class="bsr-trans">
        <span class="bsr-pill bsr-edition">{view.book.edition}</span>
      </span>
    {:else}
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
    {/if}
  </div>

  {#if material.collection !== null}
    <CollectionStrip collection={material.collection} source={studySource} />
  {/if}

  {#if view.toggles.nav === 'breadcrumb' && view.book !== null}
    <div class="bsr-crumb">
      <span class="bsr-crumb-book">{view.book.title}</span>
      <span class="bsr-crumb-sep">›</span>
      <select class="dropdown" value={String(view.position.chapter)} onchange={onChapterPicked}>
        {#each view.book.sections as section (section.chapter)}
          <option value={String(section.chapter)}>{section.name}</option>
        {/each}
      </select>
      <span class="bsr-spacer"></span>
      <button type="button" class="bsr-step" disabled={!view.hasPreviousChapter} onclick={() => void model.previousChapter()}>‹ Previous</button>
      <button type="button" class="bsr-step" disabled={!view.hasNextChapter} onclick={() => void model.nextChapter()}>Next ›</button>
    </div>
  {:else if view.toggles.nav === 'breadcrumb'}
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
    {#if view.toggles.nav === 'tree' && view.book !== null}
      <div class="bsr-tree">
        <div class="bsr-toc-title">{view.book.title}</div>
        <div class="bsr-toc-author">{view.book.author}</div>
        {#each view.book.sections as section (section.chapter)}
          <button
            type="button"
            class="bsr-toc-item"
            class:bsr-on={section.current}
            onclick={() => void model.goTo(view.position.book, section.chapter)}
          >{section.name}</button>
        {/each}
      </div>
    {:else if view.toggles.nav === 'tree'}
      <div class="bsr-tree">
        {#each books as book (book)}
          {#if book === 1}<div class="bsr-tree-group">Old Testament</div>{/if}
          {#if book === 40}<div class="bsr-tree-group">New Testament</div>{/if}
          <button
            type="button"
            class="bsr-tree-book"
            class:bsr-on={book === view.position.book}
            onclick={() => model.browseBook(book)}
          >{view.treeBook === book ? '▾' : '▸'} {bookName(book)}</button>
          {#if view.treeBook === book}
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
        <div class="bsr-inner" class:bsr-book={view.book !== null}>
          {#if view.book !== null}
            <div class="bsr-book-head">
              <div class="bsr-book-name">{view.book.title}</div>
              <h1 class="bsr-book-title">{view.book.sectionName}</h1>
            </div>
            {#each view.book.epigraphs as epigraph, index (index)}
              <div class="bsr-epigraph">
                {epigraph.quote}
                <span class="bsr-epigraph-src"
                  >—{#each epigraph.attribution as segment, part (part)}{@render citedText(segment)}{/each}</span>
              </div>
            {/each}
          {:else}
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
          {/if}

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
          {:else if view.book !== null}
            {#each view.rows as row (row.verseId)}
              <div
                class="bsr-para"
                class:bsr-para-numbered={view.toggles.paraNumbers === 'on'}
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
                <span class="bsr-gutter-num">{row.label}</span>
                <p class="bsr-book-prose">{@render verseText(row)}</p>
              </div>
            {/each}
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

  /* The words a search hit matched: emphasis only, so it reads apart from a
     user Highlight's fill and from the entry row's tint. */
  .bsr-match {
    background-color: transparent;
    color: inherit;
    font-weight: 600;
    text-decoration: underline;
    text-decoration-thickness: 2px;
    text-underline-offset: 2px;
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

  /* A citation the author himself wrote, kept as prose — accent colour and
     nothing else, so the page still reads as a book (spec-books §8). */
  .bsr-ref-link {
    color: var(--text-accent);
    cursor: pointer;
  }

  .bsr-ref-link:hover {
    text-decoration: underline;
  }

  /* Book mode — variant B of the book-reader prototype: serif prose under a
     centered heading, with the paragraph numbers out in the margin gutter. */
  .bsr-edition {
    cursor: default;
  }

  .bsr-crumb-book {
    font-weight: 600;
  }

  .bsr-toc-title {
    padding: 0 12px 2px;
    font-weight: 600;
  }

  .bsr-toc-author {
    padding: 0 12px 10px;
    margin-bottom: 6px;
    border-bottom: 1px solid var(--background-modifier-border);
    color: var(--text-faint);
    font-size: var(--font-smallest);
    font-style: italic;
  }

  .bsr-toc-item {
    display: block;
    width: 100%;
    text-align: left;
    background: none;
    border: none;
    border-left: 2px solid transparent;
    box-shadow: none;
    padding: 3px 12px;
    color: var(--text-muted);
    cursor: pointer;
  }

  .bsr-toc-item:hover {
    color: var(--text-normal);
    background: var(--background-modifier-hover);
  }

  .bsr-toc-item.bsr-on {
    color: var(--text-accent);
    border-left-color: var(--text-accent);
    background: hsla(var(--interactive-accent-hsl), 0.12);
  }

  .bsr-inner.bsr-book {
    font-family: Georgia, 'Iowan Old Style', 'Times New Roman', serif;
    /* Side padding leaves the margin gutter room to hold the paragraph
       numbers without clipping them against the pane edge. */
    padding: 24px 3em 40px;
  }

  .bsr-book-name {
    text-align: center;
    color: var(--text-faint);
    font-size: 0.8em;
    letter-spacing: 0.25em;
    text-transform: uppercase;
    margin-bottom: 6px;
  }

  .bsr-book-title {
    text-align: center;
    font-size: 1.5em;
    font-weight: 400;
    font-variant: small-caps;
    letter-spacing: 0.04em;
    margin: 0 0 26px;
  }

  .bsr-epigraph {
    max-width: 30rem;
    margin: 0 auto 34px;
    color: var(--text-muted);
    font-style: italic;
    text-align: center;
    line-height: 1.75;
    font-size: 0.95em;
  }

  .bsr-epigraph-src {
    display: block;
    margin-top: 8px;
    font-style: normal;
    font-size: 0.85em;
  }

  .bsr-para {
    position: relative;
    cursor: pointer;
    border-radius: var(--radius-s);
  }

  .bsr-book-prose {
    margin: 0 0 1.1em;
    font-size: inherit;
    line-height: 1.9;
    text-align: justify;
    hyphens: auto;
  }

  .bsr-gutter-num {
    position: absolute;
    left: -2.6em;
    top: 0.3em;
    width: 2em;
    text-align: right;
    color: var(--text-accent);
    font-family: var(--font-interface);
    font-size: 0.7em;
    font-weight: 600;
    opacity: 0;
    transition: opacity 0.12s;
  }

  .bsr-para:hover .bsr-gutter-num,
  .bsr-para.bsr-sel .bsr-gutter-num,
  .bsr-para.bsr-para-numbered .bsr-gutter-num {
    opacity: 1;
  }

  .bsr-para.bsr-hl {
    background: hsla(var(--interactive-accent-hsl), 0.1);
    box-shadow: inset 3px 0 0 var(--text-accent);
  }

  .bsr-para.bsr-sel {
    background: hsla(var(--interactive-accent-hsl), 0.18);
  }

  .bsr-strongs-word:hover {
    background: hsla(var(--interactive-accent-hsl), 0.15);
    border-radius: 2px;
  }
</style>
